import { Exit } from '../models/exit.model.js';
import { Payslip } from '../models/payslip.model.js';
import { User } from '../models/user.model.js';
import { canSeeEmployee, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { daysBetween, indiaDay, monthBounds } from '../lib/dates.js';
import { PAY_MODES, needsReference } from '../../config/payoutOptions.js';
import { recordAudit } from './audit.service.js';
import { salaryInForce } from './salary.service.js';
import { leaveBalanceOf } from './leaveRules.service.js';

// The full-and-final settlement of an exit (founder, 2026-10-28). Rules:
// - HR prepares it (exits.manage); two lines are suggested and can be changed or removed:
//   paid leave not taken (balance × one day's salary) and, for a resignation, the notice days
//   not served (taken back); HR adds any other line;
// - one day = monthly gross ÷ days in the month of the last working day (as on salary slips);
// - the salary of the last month is paid on its normal salary slip, not here;
// - the CEO approves it (payouts.approve, never for themselves); after that it cannot change;
// - HR or Finance records the payment, or the money recovered, with a reference (payouts.manage);
// - an exit can be closed only once its settlement is approved.

const rupees = (paise) => (paise / 100).toFixed(2);

function totalsOf(lines) {
  const add = lines
    .filter((line) => line.kind === 'add')
    .reduce((sum, line) => sum + line.amountPaise, 0);
  const deduct = lines
    .filter((line) => line.kind === 'deduct')
    .reduce((sum, line) => sum + line.amountPaise, 0);
  return { add, deduct, net: add - deduct };
}

/** The exit whose settlement is being worked on: the open one, or the last closed one. */
async function loadExit(actor, userId, permission) {
  requirePermission(actor, permission);
  const person = await User.findById(userId, 'name employeeId')
    .lean()
    .catch(() => null);
  if (!person || !(await canSeeEmployee(actor, 'exits.view', person.employeeId))) {
    throw notFound('Employee');
  }
  const exit = await Exit.findOne({ userId: person._id, status: { $in: ['notice', 'completed'] } })
    .sort({ createdAt: -1 })
    .lean();
  if (!exit) throw createAppError(409, 'There is no exit for this employee.');
  return { person, exit };
}

/** Suggested lines and how they were worked out. */
async function suggestions(exit, noticeDays) {
  const lastDay = exit.lastWorkingDay;
  const month = lastDay.slice(0, 7);
  const [structure, balance] = await Promise.all([
    salaryInForce(exit.userId, lastDay),
    leaveBalanceOf(exit.userId, month),
  ]);
  const monthlyGrossPaise = structure?.totals?.monthlyGross ?? 0;
  const daysInMonth = Number(monthBounds(month).last.slice(8));
  const perDayPaise = Math.round(monthlyGrossPaise / daysInMonth);
  const servedDays = daysBetween(exit.noticeDate, lastDay).length;
  const shortDays = exit.type === 'resignation' ? Math.max(0, noticeDays - servedDays) : 0;
  const lines = [];
  if (balance > 0) {
    lines.push({
      kind: 'add',
      label: `Paid leave not taken (${balance} days)`,
      amountPaise: Math.round(balance * perDayPaise),
      note: 'Remove this line if leave is not paid out.',
    });
  }
  if (shortDays > 0) {
    lines.push({
      kind: 'deduct',
      label: `Notice period not served (${shortDays} days)`,
      amountPaise: shortDays * perDayPaise,
      note: `${servedDays} of ${noticeDays} days served.`,
    });
  }
  return {
    lines,
    basis: {
      monthlyGrossPaise,
      daysInMonth,
      perDayPaise,
      leaveBalance: balance,
      servedDays,
      shortDays,
    },
  };
}

/** Final slips of this employee that are not paid yet (shown as a warning). */
const unpaidSlips = (userId) =>
  Payslip.find(
    { userId, status: 'final', 'payout.status': { $ne: 'paid' } },
    'month totals.net payout.status',
  ).lean();

export async function getSettlement(actor, userId) {
  const { exit } = await loadExit(actor, userId, 'exits.view');
  return {
    exitId: exit._id,
    settlement: exit.settlement,
    unpaidSlips: await unpaidSlips(exit.userId),
  };
}

/** Starts (or starts again, while a draft) the settlement with the suggested lines. */
export async function prepareSettlement(actor, userId, { noticeDays = 30 } = {}, { ip } = {}) {
  const { person, exit } = await loadExit(actor, userId, 'exits.manage');
  if (exit.settlement && exit.settlement.status !== 'draft') {
    throw createAppError(409, 'The settlement is already approved.');
  }
  const { lines, basis } = await suggestions(exit, noticeDays);
  const settlement = {
    status: 'draft',
    noticeDays,
    lines,
    totals: totalsOf(lines),
    basis,
    preparedBy: actor._id,
    preparedByName: actor.name,
    preparedAt: new Date(),
  };
  await Exit.updateOne({ _id: exit._id }, { settlement });
  await recordAudit(actor, {
    action: 'settlement.prepared',
    entity: 'user',
    entityId: person._id,
    summary: `Full and final of ${person.name} prepared: net Rs. ${rupees(settlement.totals.net)}`,
    ip,
  });
  return getSettlement(actor, userId);
}

/** HR changes the lines of a draft. */
export async function saveSettlement(actor, userId, { lines, noticeDays }, { ip } = {}) {
  const { person, exit } = await loadExit(actor, userId, 'exits.manage');
  if (!exit.settlement) throw createAppError(409, 'Prepare the settlement first.');
  if (exit.settlement.status !== 'draft')
    throw createAppError(409, 'The settlement is already approved.');
  const clean = lines.map((line) => ({
    kind: line.kind,
    label: line.label,
    amountPaise: Math.round(line.amount * 100),
    note: line.note ?? '',
  }));
  const totals = totalsOf(clean);
  await Exit.updateOne(
    { _id: exit._id, 'settlement.status': 'draft' },
    {
      'settlement.lines': clean,
      'settlement.totals': totals,
      ...(noticeDays !== undefined ? { 'settlement.noticeDays': noticeDays } : {}),
      'settlement.preparedBy': actor._id,
      'settlement.preparedByName': actor.name,
      'settlement.preparedAt': new Date(),
    },
  );
  await recordAudit(actor, {
    action: 'settlement.edited',
    entity: 'user',
    entityId: person._id,
    summary: `Full and final of ${person.name} changed: net Rs. ${rupees(totals.net)}`,
    ip,
  });
  return getSettlement(actor, userId);
}

/** The CEO approves the settlement (never their own, never the one they prepared). */
export async function approveSettlement(actor, userId, { ip } = {}) {
  const { person, exit } = await loadExit(actor, userId, 'payouts.approve');
  if (String(person._id) === String(actor._id)) {
    throw createAppError(403, 'You cannot approve your own settlement.');
  }
  if (!exit.settlement || exit.settlement.status !== 'draft') {
    throw createAppError(409, 'There is no settlement waiting for approval.');
  }
  if (String(exit.settlement.preparedBy) === String(actor._id)) {
    throw createAppError(403, 'You prepared this settlement, so someone else must approve it.');
  }
  const updated = await Exit.updateOne(
    { _id: exit._id, 'settlement.status': 'draft' },
    {
      'settlement.status': exit.settlement.totals.net === 0 ? 'paid' : 'approved',
      'settlement.approvedBy': actor._id,
      'settlement.approvedByName': actor.name,
      'settlement.approvedAt': new Date(),
    },
  );
  if (!updated.modifiedCount)
    throw createAppError(409, 'The settlement was just changed by someone else.');
  await recordAudit(actor, {
    action: 'settlement.approved',
    entity: 'user',
    entityId: person._id,
    summary: `Full and final of ${person.name} approved: net Rs. ${rupees(exit.settlement.totals.net)}`,
    ip,
  });
  return getSettlement(actor, userId);
}

/** HR or Finance records the payment (net > 0) or the money recovered (net < 0). */
export async function recordSettlementPayment(
  actor,
  userId,
  { paidOn, mode, reference, note },
  { ip } = {},
) {
  const { person, exit } = await loadExit(actor, userId, 'payouts.manage');
  if (exit.settlement?.status !== 'approved') {
    throw createAppError(409, 'The settlement must be approved, and not yet paid.');
  }
  if (paidOn > indiaDay()) throw createAppError(400, 'paidOn: the day cannot be in the future');
  if (needsReference(mode) && !reference) {
    throw createAppError(400, 'reference: enter the UTR, UPI or cheque number');
  }
  if (!needsReference(mode) && !note)
    throw createAppError(400, 'note: write who gave or got the cash');
  await Exit.updateOne(
    { _id: exit._id, 'settlement.status': 'approved' },
    {
      'settlement.status': 'paid',
      'settlement.paidOn': paidOn,
      'settlement.mode': mode,
      'settlement.reference': reference ?? '',
      'settlement.note': note ?? '',
      'settlement.paidByName': actor.name,
    },
  );
  const recovered = exit.settlement.totals.net < 0;
  await recordAudit(actor, {
    action: 'settlement.paid',
    entity: 'user',
    entityId: person._id,
    summary: `Full and final of ${person.name}: Rs. ${rupees(Math.abs(exit.settlement.totals.net))} ${recovered ? 'recovered' : 'paid'} on ${paidOn} by ${PAY_MODES[mode]}${reference ? ` (${reference})` : ''}`,
    ip,
  });
  return getSettlement(actor, userId);
}

/** For the exit rules: is the settlement of this exit approved (or paid)? */
export const settlementDone = (exit) => ['approved', 'paid'].includes(exit.settlement?.status);
