import { Payslip } from '../models/payslip.model.js';
import { Kyc } from '../models/kyc.model.js';
import { can, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { indiaDay } from '../lib/dates.js';
import { containsRegex } from '../lib/pagination.js';
import { open } from '../lib/secretBox.js';
import { toCsv } from '../lib/csv.js';
import { dayCondition, dayRange, monthCondition } from '../lib/dateFilter.js';
import { PAY_MODES, needsReference, salaryDueOn } from '../../config/payoutOptions.js';
import { recordAudit } from './audit.service.js';
import { notifyUsers } from './push.service.js';

// Salary payouts (CEO answers, 2026-10-28). Rules:
// - only a final salary slip is paid; the CEO approves every payout (payouts.approve), never
//   their own salary;
// - HR or Finance pays by hand and records it (payouts.manage): the day it was paid (not in the
//   future), how, and the reference (UTR, UPI or cheque number; a note for cash);
// - a paid slip cannot be re-opened; nothing here moves money;
// - the bank upload file lists the approved, unpaid slips of a month with the full account
//   numbers (audited).

const PAYOUT_VIEW = (actor) => can(actor, 'payouts.manage') || can(actor, 'payouts.approve');

function requirePayoutAccess(actor) {
  if (!PAYOUT_VIEW(actor)) throw createAppError(403, 'You do not have access to this.');
}

const rupees = (paise) => (paise / 100).toFixed(2);

/** The filter of the payouts screen: status, salary month, payment date range, search. */
function payoutFilter(query) {
  const filter = { status: 'final' };
  if (query.status) filter['payout.status'] = query.status;
  if (query.month) filter.month = query.month;
  // The date filter is on the day paid for paid slips, on the salary month for the rest.
  if (dayRange(query)) {
    if (query.status === 'paid' || !query.status) {
      filter['payout.paidOn'] = dayCondition(query);
    } else {
      filter.month = monthCondition(query);
    }
  }
  if (query.q) {
    const pattern = containsRegex(query.q);
    filter.$or = [
      { 'employee.name': pattern },
      { employeeId: pattern },
      { 'employee.code': pattern },
    ];
  }
  return filter;
}

const LIST_FIELDS =
  'userId employeeId month employee.name employee.code employee.designation employee.brandKey totals.net payout';

/** Payouts with the totals of the same filter (how much the company paid, and what is left). */
export async function listPayouts(actor, query) {
  requirePayoutAccess(actor);
  const filter = payoutFilter(query);
  const pageSize = 25;
  const page = Math.max(1, query.page ?? 1);
  const [items, total, sums] = await Promise.all([
    Payslip.find(filter, LIST_FIELDS)
      .sort({ 'payout.paidOn': -1, month: -1, 'employee.name': 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Payslip.countDocuments(filter),
    // Paid: inside the date filter. Waiting and approved: whatever their date (still to do).
    Payslip.aggregate([
      {
        $match: {
          $or: [
            { ...payoutFilter({ ...query, status: 'paid' }) },
            {
              ...payoutFilter({
                ...query,
                status: undefined,
                range: undefined,
                from: undefined,
                to: undefined,
              }),
              'payout.status': { $in: ['unpaid', 'approved'] },
            },
          ],
        },
      },
      { $group: { _id: '$payout.status', count: { $sum: 1 }, net: { $sum: '$totals.net' } } },
    ]),
  ]);
  const totals = Object.fromEntries(
    ['unpaid', 'approved', 'paid'].map((status) => {
      const row = sums.find((item) => item._id === status);
      return [status, { count: row?.count ?? 0, net: row?.net ?? 0 }];
    }),
  );
  const today = indiaDay();
  return {
    items: items.map((item) => ({
      ...item,
      dueOn: salaryDueOn(item.month),
      overdue: item.payout?.status !== 'paid' && salaryDueOn(item.month) < today,
    })),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    totals,
    // Paid per salary month inside the filter (the "how much did we pay" view).
    byMonth: await Payslip.aggregate([
      { $match: { ...filter, 'payout.status': 'paid' } },
      { $group: { _id: '$month', count: { $sum: 1 }, net: { $sum: '$totals.net' } } },
      { $sort: { _id: -1 } },
    ]),
    canApprove: Boolean(can(actor, 'payouts.approve')),
    canPay: Boolean(can(actor, 'payouts.manage')),
  };
}

/** The CEO approves the payment of final slips (one or many). Returns how many were approved. */
export async function approvePayouts(actor, ids, { ip } = {}) {
  requirePermission(actor, 'payouts.approve');
  const slips = await Payslip.find(
    { _id: { $in: ids }, status: 'final', 'payout.status': 'unpaid' },
    'userId month employee.name totals.net',
  ).lean();
  const own = slips.filter((slip) => String(slip.userId) === String(actor._id));
  if (own.length) throw createAppError(403, 'You cannot approve your own salary.');
  if (!slips.length)
    throw createAppError(409, 'Nothing to approve: choose final slips waiting for approval.');
  await Payslip.updateMany(
    { _id: { $in: slips.map((slip) => slip._id) }, 'payout.status': 'unpaid' },
    {
      'payout.status': 'approved',
      'payout.approvedBy': actor._id,
      'payout.approvedByName': actor.name,
      'payout.approvedAt': new Date(),
    },
  );
  const total = slips.reduce((sum, slip) => sum + slip.totals.net, 0);
  await recordAudit(actor, {
    action: 'payout.approved',
    entity: 'payslip',
    summary: `Approved the payment of ${slips.length} salary slip(s), Rs. ${rupees(total)}: ${slips
      .map((slip) => `${slip.employee.name} ${slip.month}`)
      .join(', ')}`,
    ip,
  });
  return { approved: slips.length, total };
}

/** HR or Finance records that a slip was paid. */
export async function recordPayment(actor, id, { paidOn, mode, reference, note }, { ip } = {}) {
  requirePermission(actor, 'payouts.manage');
  const slip = await Payslip.findById(id, 'userId month employee.name totals.net status payout')
    .lean()
    .catch(() => null);
  if (!slip || slip.status !== 'final') throw notFound('Salary slip');
  if (slip.payout?.status === 'paid')
    throw createAppError(409, 'This salary is already recorded as paid.');
  if (slip.payout?.status !== 'approved') {
    throw createAppError(409, 'The CEO must approve this payout first.');
  }
  if (paidOn > indiaDay())
    throw createAppError(400, 'paidOn: the day paid cannot be in the future');
  if (needsReference(mode) && !reference) {
    throw createAppError(400, 'reference: enter the UTR, UPI or cheque number');
  }
  if (!needsReference(mode) && !note) {
    throw createAppError(400, 'note: write who received the cash');
  }
  const updated = await Payslip.findOneAndUpdate(
    { _id: id, 'payout.status': 'approved' },
    {
      'payout.status': 'paid',
      'payout.paidOn': paidOn,
      'payout.mode': mode,
      'payout.reference': reference ?? '',
      'payout.note': note ?? '',
      'payout.paidBy': actor._id,
      'payout.paidByName': actor.name,
      'payout.recordedAt': new Date(),
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw createAppError(409, 'This payout was just changed by someone else.');
  await recordAudit(actor, {
    action: 'payout.paid',
    entity: 'payslip',
    entityId: id,
    summary: `Salary ${slip.month} of ${slip.employee.name}: Rs. ${rupees(slip.totals.net)} paid on ${paidOn} by ${PAY_MODES[mode]}${reference ? ` (${reference})` : ''}`,
    ip,
  });
  notifyUsers([slip.userId], {
    title: 'Salary paid',
    body: `Your salary for ${slip.month} was paid on ${paidOn}.`,
    icon: '/logo.png',
    data: { url: `/payslips/${id}` },
  }).catch(() => {});
  return updated.payout;
}

/**
 * The bank upload file of a month: approved, unpaid slips with the bank details from KYC.
 * Full account numbers: only for payouts.manage, and every download is audited.
 */
export async function bankFile(actor, month, { ip } = {}) {
  requirePermission(actor, 'payouts.manage');
  const slips = await Payslip.find(
    { month, status: 'final', 'payout.status': 'approved' },
    'userId employeeId month employee.name employee.code totals.net',
  )
    .sort({ 'employee.name': 1 })
    .lean();
  if (!slips.length) throw createAppError(409, 'No approved, unpaid salaries for this month.');
  const kycs = await Kyc.find(
    { userId: { $in: slips.map((slip) => slip.userId) } },
    'userId bank',
  ).lean();
  const bankOf = new Map(kycs.map((kyc) => [String(kyc.userId), kyc.bank ?? {}]));
  const rows = slips.map((slip) => {
    const bank = bankOf.get(String(slip.userId)) ?? {};
    return [
      bank.accountHolderName || slip.employee.name,
      open(bank.accountSealed) ?? '',
      bank.ifsc ?? '',
      bank.bankName ?? '',
      rupees(slip.totals.net),
      `Salary ${month} ${slip.employee.code || slip.employeeId}`,
    ];
  });
  const missing = rows.filter((row) => !row[1] || !row[2]).length;
  await recordAudit(actor, {
    action: 'payout.bank_file',
    entity: 'payslip',
    summary: `Bank upload file for ${month}: ${rows.length} salaries${missing ? `, ${missing} without bank details` : ''}`,
    ip,
  });
  return {
    fileName: `salary-bank-file-${month}.csv`,
    text: toCsv(
      ['Beneficiary name', 'Account number', 'IFSC', 'Bank', 'Amount', 'Narration'],
      rows,
    ),
  };
}

/** The payouts register for the CA (no bank numbers), with the same filters as the screen. */
export async function payoutRegister(actor, query, { ip } = {}) {
  requirePayoutAccess(actor);
  const slips = await Payslip.find(payoutFilter(query), LIST_FIELDS)
    .sort({ month: -1, 'employee.name': 1 })
    .limit(5000)
    .lean();
  await recordAudit(actor, {
    action: 'payout.exported',
    entity: 'payslip',
    summary: `Payouts register exported (${slips.length} rows)`,
    ip,
  });
  return {
    fileName: `salary-payouts-${indiaDay()}.csv`,
    text: toCsv(
      [
        'Salary month',
        'Employee ID',
        'Name',
        'Designation',
        'Net salary',
        'Status',
        'Paid on',
        'Mode',
        'Reference',
        'Approved by',
        'Paid by (recorded)',
      ],
      slips.map((slip) => [
        slip.month,
        slip.employee.code || slip.employeeId,
        slip.employee.name,
        slip.employee.designation,
        rupees(slip.totals.net),
        slip.payout?.status ?? 'unpaid',
        slip.payout?.paidOn ?? '',
        PAY_MODES[slip.payout?.mode] ?? '',
        slip.payout?.reference ?? '',
        slip.payout?.approvedByName ?? '',
        slip.payout?.paidByName ?? '',
      ]),
    ),
  };
}

/** For the dashboard: payouts waiting for the CEO, approved ones not yet paid. */
export async function payoutCounts(actor) {
  if (!PAYOUT_VIEW(actor)) return null;
  const [waiting, approved] = await Promise.all([
    Payslip.countDocuments({ status: 'final', 'payout.status': 'unpaid' }),
    Payslip.countDocuments({ status: 'final', 'payout.status': 'approved' }),
  ]);
  return { waiting, approved };
}
