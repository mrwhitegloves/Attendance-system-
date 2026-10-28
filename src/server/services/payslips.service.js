import { Payslip } from '../models/payslip.model.js';
import { User } from '../models/user.model.js';
import { Kyc } from '../models/kyc.model.js';
import { DEDUCTIONS, EARNINGS } from '../../config/payslipFields.js';
import { signedUrl } from '../infra/storage.js';
import { can, canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { monthBounds } from '../lib/dates.js';
import { seal, open } from '../lib/secretBox.js';
import { amountInWords } from '../lib/amountInWords.js';
import { containsRegex } from '../lib/pagination.js';
import { recordAudit } from './audit.service.js';
import { salaryInForce } from './salary.service.js';
import { buildMonthDays } from './attendance.service.js';
import { leaveBalanceOf } from './leaveRules.service.js';
import { calculateMonth } from '../lib/payslipRules.js';
import { getCompany } from './settings.service.js';
import { notifyUsers } from './push.service.js';
import { brandKeyOf } from '../../config/brands.js';

// Salary slips. Rules:
// - one slip per employee and month; it starts as a draft filled from the employee file, KYC,
//   the salary structure in force and the month's attendance; every field can then be changed;
// - totals and the amount in words are always worked out by the server;
// - a final slip is locked; the person who last changed it cannot make it final (maker-checker);
// - re-opening a final slip needs a reason and is audited;
// - employees see only their own final slips.
// Attendance numbers and loss of pay follow the founder's rules in lib/payslipRules.js.

const sum = (values, lines) => lines.reduce((total, line) => total + (values?.[line.key] ?? 0), 0);

function withTotals(slip) {
  const earnings = sum(slip.earnings, EARNINGS);
  const deductions = sum(slip.deductions, DEDUCTIONS);
  return {
    totals: { earnings, deductions, net: earnings - deductions },
    netInWords: amountInWords(earnings - deductions),
  };
}

async function loadEmployee(actor, userId) {
  const user = await User.findById(userId)
    .lean()
    .catch(() => null);
  if (!user || !(await canSeeEmployee(actor, 'payslips.view', user.employeeId)))
    throw notFound('Employee');
  return user;
}

async function loadSlip(actor, id) {
  const slip = await Payslip.findById(id)
    .lean()
    .catch(() => null);
  if (!slip || !(await canSeeEmployee(actor, 'payslips.view', slip.employeeId)))
    throw notFound('Salary slip');
  // A draft is HR's work in progress.
  if (slip.status === 'draft' && !can(actor, 'payslips.manage')) throw notFound('Salary slip');
  return slip;
}

/** First values for a month: employee file, KYC, salary structure in force, attendance counts. */
async function prefill(user, month, now = new Date()) {
  const { last } = monthBounds(month);
  const [kyc, structure, days, balance] = await Promise.all([
    Kyc.findOne({ userId: user._id }).lean(),
    salaryInForce(user._id, last),
    buildMonthDays(user, month, now),
    leaveBalanceOf(user._id, month),
  ]);
  const fixed = (lines) =>
    Object.fromEntries(
      lines.map((line) => [line.key, line.fixed ? (structure?.components?.[line.key] ?? 0) : 0]),
    );
  const earnings = fixed(EARNINGS);
  const calculation = calculateMonth({
    days,
    monthlyGrossPaise: sum(
      earnings,
      EARNINGS.filter((line) => line.fixed),
    ),
    calendarDays: Number(last.slice(8)),
  });
  return {
    employee: {
      name: user.name,
      code: user.employeeCode || user.employeeId,
      designation: user.designation ?? '',
      department: user.department ?? '',
      joiningDate: user.joiningDate ?? '',
      bankName: kyc?.bank?.bankName ?? '',
      brandKey: brandKeyOf(user),
      panSealed: kyc?.pan?.sealed ?? null,
      panLast4: kyc?.pan?.last4 ?? '',
      accountSealed: kyc?.bank?.accountSealed ?? null,
      accountLast4: kyc?.bank?.accountLast4 ?? '',
    },
    attendance: {
      totalWorkingDays: calculation.workingDays,
      fullDays: calculation.fullDays,
      halfDays: calculation.halfDays,
      leavesTaken: calculation.paidLeaveDays + calculation.unpaidLeaveDays,
      // Paid leave balance at the end of the month (never shown below zero on the slip).
      balanceLeaves: Math.max(0, balance),
    },
    earnings,
    deductions: { ...fixed(DEDUCTIONS), lossOfPay: calculation.lossOfPayPaise },
    calculation,
    salaryStructureId: structure?._id ?? null,
    salaryVersion: structure?.version ?? null,
  };
}

/** The slip as the screens see it. Full PAN and account only with `full` and permission. */
async function toView(actor, slip, { full = false, ip } = {}) {
  const isOwner = String(slip.userId) === String(actor._id);
  const mayReveal = full && (isOwner || Boolean(can(actor, 'kyc.reveal')));
  let pan = slip.employee.panLast4 ? `******${slip.employee.panLast4}` : '';
  let account = slip.employee.accountLast4 ? `XXXXXX${slip.employee.accountLast4}` : '';
  if (mayReveal) {
    pan = open(slip.employee.panSealed) ?? pan;
    account = open(slip.employee.accountSealed) ?? account;
    if (!isOwner) {
      await recordAudit(actor, {
        action: 'payslip.viewed_full',
        entity: 'payslip',
        entityId: slip._id,
        summary: `Salary slip ${slip.month} of ${slip.employee.name} opened with full PAN and account`,
        ip,
      });
    }
  }
  const employee = { ...slip.employee };
  delete employee.panSealed;
  delete employee.accountSealed;
  const lastEditor = slip.lastEditedBy ?? slip.preparedBy;
  return {
    ...slip,
    employee: { ...employee, pan, account },
    permissions: {
      edit: slip.status === 'draft' && Boolean(can(actor, 'payslips.manage')),
      finalise:
        slip.status === 'draft' &&
        Boolean(can(actor, 'payslips.finalise')) &&
        String(lastEditor) !== String(actor._id),
      reopen: slip.status === 'final' && Boolean(can(actor, 'payslips.finalise')),
      lastEditedByYou: String(lastEditor) === String(actor._id),
    },
  };
}

export async function getPayslip(actor, id, options = {}) {
  const slip = await loadSlip(actor, id);
  const view = await toView(actor, slip, options);
  // Company details: frozen on a final slip, current ones on a draft.
  view.company = slip.company ?? (await getCompany());
  if (options.withStamp) {
    view.company = {
      ...view.company,
      stampUrl: view.company.stampKey ? await signedUrl(view.company.stampKey) : null,
    };
  }
  return view;
}

/** The slip's month day by day, and the numbers the rules give today (for checking by hand). */
export async function getPayslipAttendance(actor, id) {
  const slip = await loadSlip(actor, id);
  const user = await User.findById(slip.userId).lean();
  const days = await buildMonthDays(user, slip.month);
  const { last } = monthBounds(slip.month);
  return {
    days,
    calculation: calculateMonth({
      days,
      monthlyGrossPaise:
        slip.calculation?.monthlyGrossPaise ??
        sum(
          slip.earnings,
          EARNINGS.filter((line) => line.fixed),
        ),
      calendarDays: Number(last.slice(8)),
    }),
    expectedInTime: user.expectedInTime,
  };
}

export async function createPayslip(actor, userId, month, { ip } = {}) {
  requirePermission(actor, 'payslips.manage');
  const user = await loadEmployee(actor, userId);
  const existing = await Payslip.findOne({ userId: user._id, month }, '_id').lean();
  if (existing) throw createAppError(409, `A salary slip for ${month} already exists.`, 'exists');
  const values = await prefill(user, month);
  const slip = await Payslip.create({
    userId: user._id,
    employeeId: user.employeeId,
    month,
    ...values,
    ...withTotals(values),
    preparedBy: actor._id,
  });
  await recordAudit(actor, {
    action: 'payslip.created',
    entity: 'payslip',
    entityId: slip._id,
    summary: `Salary slip ${month} started for ${user.name} (${user.employeeId})`,
    ip,
  });
  return slip.toObject();
}

/** Changes any field of a draft; totals and words are worked out again. */
export async function updatePayslip(actor, id, input, { ip } = {}) {
  requirePermission(actor, 'payslips.manage');
  const slip = await loadSlip(actor, id);
  if (slip.status !== 'draft') throw createAppError(409, 'This slip is final. Re-open it first.');
  const set = {};
  for (const [key, value] of Object.entries(input.employee ?? {})) {
    if (key === 'pan') {
      set['employee.panSealed'] = value ? seal(value) : null;
      set['employee.panLast4'] = value ? value.slice(-4) : '';
    } else if (key === 'accountNumber') {
      set['employee.accountSealed'] = value ? seal(value) : null;
      set['employee.accountLast4'] = value ? value.slice(-4) : '';
    } else {
      set[`employee.${key}`] = value;
    }
  }
  for (const group of ['attendance', 'earnings', 'deductions']) {
    for (const [key, value] of Object.entries(input[group] ?? {})) set[`${group}.${key}`] = value;
  }
  if (input.notes !== undefined) set.notes = input.notes;
  const merged = {
    earnings: { ...slip.earnings, ...(input.earnings ?? {}) },
    deductions: { ...slip.deductions, ...(input.deductions ?? {}) },
  };
  const { totals, netInWords } = withTotals(merged);
  Object.assign(set, { totals, netInWords, lastEditedBy: actor._id, lastEditedAt: new Date() });
  await Payslip.updateOne({ _id: id, status: 'draft' }, { $set: set });
  const changedFields = [
    ...Object.keys(input.employee ?? {}).map((key) => `employee.${key}`),
    ...['attendance', 'earnings', 'deductions'].flatMap((group) =>
      Object.keys(input[group] ?? {}).map((key) => `${group}.${key}`),
    ),
  ];
  await recordAudit(actor, {
    action: 'payslip.edited',
    entity: 'payslip',
    entityId: id,
    summary: `Salary slip ${slip.month} of ${slip.employee.name} changed: ${changedFields.join(', ') || 'notes'}; net ${amountInWords(totals.net)}`,
    ip,
  });
  return getPayslip(actor, id);
}

/** Fills the draft again from the current employee file, KYC, salary and attendance. */
export async function prefillAgain(actor, id, { ip } = {}) {
  requirePermission(actor, 'payslips.manage');
  const slip = await loadSlip(actor, id);
  if (slip.status !== 'draft') throw createAppError(409, 'This slip is final. Re-open it first.');
  const user = await User.findById(slip.userId).lean();
  const values = await prefill(user, slip.month);
  await Payslip.updateOne(
    { _id: id },
    {
      $set: { ...values, ...withTotals(values), lastEditedBy: actor._id, lastEditedAt: new Date() },
    },
  );
  await recordAudit(actor, {
    action: 'payslip.prefilled',
    entity: 'payslip',
    entityId: id,
    summary: `Salary slip ${slip.month} of ${slip.employee.name} filled again from the records`,
    ip,
  });
  return getPayslip(actor, id);
}

export async function finalisePayslip(actor, id, { ip } = {}) {
  requirePermission(actor, 'payslips.finalise');
  const slip = await loadSlip(actor, id);
  if (slip.status !== 'draft') throw createAppError(409, 'This slip is already final.');
  if (String(slip.lastEditedBy ?? slip.preparedBy) === String(actor._id)) {
    throw createAppError(
      403,
      'You made the last change to this slip, so someone else must make it final.',
    );
  }
  if (slip.totals.net < 0)
    throw createAppError(400, 'The net salary is below zero. Check the deductions.');
  const company = await getCompany();
  await Payslip.updateOne(
    { _id: id, status: 'draft' },
    { status: 'final', finalisedBy: actor._id, finalisedAt: new Date(), company },
  );
  await recordAudit(actor, {
    action: 'payslip.finalised',
    entity: 'payslip',
    entityId: id,
    summary: `Salary slip ${slip.month} of ${slip.employee.name} made final: ${slip.netInWords}`,
    ip,
  });
  notifyUsers([slip.userId], {
    title: 'Your salary slip is ready',
    body: `Salary slip for ${slip.month}`,
    icon: '/logo.png',
    data: { url: `/payslips/${id}` },
  }).catch(() => {});
  return getPayslip(actor, id);
}

export async function reopenPayslip(actor, id, { reason }, { ip } = {}) {
  requirePermission(actor, 'payslips.finalise');
  const slip = await loadSlip(actor, id);
  if (slip.status !== 'final') throw createAppError(409, 'This slip is not final.');
  await Payslip.updateOne(
    { _id: id },
    {
      status: 'draft',
      finalisedBy: null,
      finalisedAt: null,
      lastEditedBy: actor._id,
      lastEditedAt: new Date(),
    },
  );
  await recordAudit(actor, {
    action: 'payslip.reopened',
    entity: 'payslip',
    entityId: id,
    summary: `Salary slip ${slip.month} of ${slip.employee.name} re-opened: ${reason}`,
    ip,
  });
  return getPayslip(actor, id);
}

/** Slips in scope with filters (month, status, employee search). */
export async function listPayslips(actor, query) {
  const filter = { ...(await employeeScopeFilter(actor, 'payslips.view')) };
  if (!can(actor, 'payslips.manage')) filter.status = 'final';
  else if (query.status) filter.status = query.status;
  if (query.month) filter.month = query.month;
  if (query.userId) filter.userId = query.userId;
  if (query.q) {
    const pattern = containsRegex(query.q);
    filter.$or = [
      { 'employee.name': pattern },
      { employeeId: pattern },
      { 'employee.code': pattern },
    ];
  }
  const pageSize = 25;
  const page = Math.max(1, query.page ?? 1);
  const [items, total] = await Promise.all([
    Payslip.find(filter, '-employee.panSealed -employee.accountSealed -company')
      .sort({ month: -1, 'employee.name': 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Payslip.countDocuments(filter),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
