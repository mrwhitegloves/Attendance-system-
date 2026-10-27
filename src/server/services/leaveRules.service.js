import { CompOff, Holiday, HOLIDAY_KINDS, LeaveBalanceEntry } from '../models/leaveRules.model.js';
import { User } from '../models/user.model.js';
import { canSeeEmployee, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { daysBetween } from '../lib/dates.js';
import { recordAudit } from './audit.service.js';

// Holidays, comp-offs and the paid leave balance (founder, 2026-10-27).
// - A holiday on a working day is a paid day for everyone.
// - A comp-off: the employee worked on a Sunday; the day off taken in exchange is paid.
// - The paid leave balance: HR gives days at any time; an approved paid leave can be taken from it
//   for a chosen month. The balance may go below zero (HR decides); screens show it in red.

const isSunday = (day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0;

// ---- Holidays (Settings → Holidays) ----

export async function listHolidays(year) {
  return Holiday.find({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } })
    .sort({ date: 1 })
    .lean();
}

export async function holidaysBetween(first, last) {
  return Holiday.find({ date: { $gte: first, $lte: last } }).lean();
}

export async function addHoliday(actor, { date, name, kind }, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  if (await Holiday.exists({ date }))
    throw createAppError(409, `There is already a holiday on ${date}.`);
  const holiday = await Holiday.create({ date, name, kind, createdBy: actor._id });
  await recordAudit(actor, {
    action: 'holiday.added',
    entity: 'holiday',
    entityId: holiday._id,
    summary: `${date}: ${name} (${HOLIDAY_KINDS[kind]})`,
    ip,
  });
  return holiday.toObject();
}

export async function removeHoliday(actor, id, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const holiday = await Holiday.findByIdAndDelete(id)
    .lean()
    .catch(() => null);
  if (!holiday) throw notFound('Holiday');
  await recordAudit(actor, {
    action: 'holiday.removed',
    entity: 'holiday',
    entityId: id,
    summary: `${holiday.date}: ${holiday.name}`,
    ip,
  });
  return { ok: true };
}

// ---- Comp-offs (worked a Sunday, a day off in exchange) ----

async function loadEmployee(actor, userId, permission) {
  const user = await User.findById(userId, '_id name employeeId')
    .lean()
    .catch(() => null);
  if (!user || !(await canSeeEmployee(actor, permission, user.employeeId)))
    throw notFound('Employee');
  return user;
}

export async function compOffsBetween(employeeId, first, last) {
  return CompOff.find({
    employeeId,
    $or: [{ offOn: { $gte: first, $lte: last } }, { workedOn: { $gte: first, $lte: last } }],
  }).lean();
}

export async function listCompOffs(actor, userId) {
  const user = await loadEmployee(actor, userId, 'leave.view');
  return CompOff.find({ userId: user._id }).sort({ workedOn: -1 }).lean();
}

export async function addCompOff(actor, userId, { workedOn, offOn, note }, { ip } = {}) {
  requirePermission(actor, 'leave.decide');
  const user = await loadEmployee(actor, userId, 'leave.decide');
  if (!isSunday(workedOn)) throw createAppError(400, 'workedOn: choose the Sunday that was worked');
  if (isSunday(offOn)) throw createAppError(400, 'offOn: the day off cannot be a Sunday');
  if (await Holiday.exists({ date: offOn }))
    throw createAppError(400, 'offOn: that day is already a holiday');
  if (await CompOff.exists({ userId: user._id, workedOn }))
    throw createAppError(409, `A comp-off for the Sunday ${workedOn} already exists.`);
  if (await CompOff.exists({ userId: user._id, offOn }))
    throw createAppError(409, `${offOn} is already a comp-off day.`);
  const compOff = await CompOff.create({
    userId: user._id,
    employeeId: user.employeeId,
    workedOn,
    offOn,
    note,
    createdBy: actor._id,
  });
  await recordAudit(actor, {
    action: 'compoff.added',
    entity: 'compoff',
    entityId: user._id,
    summary: `${user.name}: worked Sunday ${workedOn}, day off ${offOn}${note ? ` (${note})` : ''}`,
    ip,
  });
  return compOff.toObject();
}

export async function removeCompOff(actor, id, { ip } = {}) {
  requirePermission(actor, 'leave.decide');
  const compOff = await CompOff.findById(id)
    .lean()
    .catch(() => null);
  if (!compOff || !(await canSeeEmployee(actor, 'leave.decide', compOff.employeeId)))
    throw notFound('Comp-off');
  await CompOff.deleteOne({ _id: id });
  await recordAudit(actor, {
    action: 'compoff.removed',
    entity: 'compoff',
    entityId: compOff.userId,
    summary: `Comp-off removed: Sunday ${compOff.workedOn}, day off ${compOff.offOn}`,
    ip,
  });
  return { ok: true };
}

// ---- Paid leave balance ----

/** The balance at the end of a month (every entry up to and including it); no month: all entries. */
export async function leaveBalanceOf(userId, month = null) {
  const match = { userId, ...(month ? { month: { $lte: month } } : {}) };
  const [row] = await LeaveBalanceEntry.aggregate([
    { $match: match },
    { $group: { _id: null, days: { $sum: '$days' } } },
  ]);
  return row?.days ?? 0;
}

export async function getLeaveBalance(actor, userId) {
  const user = await loadEmployee(actor, userId, 'leave.view');
  const entries = await LeaveBalanceEntry.find({ userId: user._id })
    .sort({ month: -1, createdAt: -1 })
    .lean();
  const names = await User.find(
    { _id: { $in: entries.map((entry) => entry.createdBy) } },
    'name',
  ).lean();
  const nameOf = (id) => names.find((person) => String(person._id) === String(id))?.name ?? '';
  return {
    balance: entries.reduce((sum, entry) => sum + entry.days, 0),
    entries: entries.map((entry) => ({ ...entry, createdByName: nameOf(entry.createdBy) })),
  };
}

/** HR gives (or, with a negative number, takes back) paid leave days. */
export async function adjustLeaveBalance(actor, userId, { days, month, reason }, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const user = await loadEmployee(actor, userId, 'users.view');
  if (!days) throw createAppError(400, 'days: enter the number of days');
  await LeaveBalanceEntry.create({
    userId: user._id,
    employeeId: user.employeeId,
    days,
    month,
    reason,
    createdBy: actor._id,
  });
  await recordAudit(actor, {
    action: 'leave_balance.adjusted',
    entity: 'leave_balance',
    entityId: user._id,
    summary: `${user.name}: ${days > 0 ? '+' : ''}${days} paid leave day(s) for ${month}. ${reason}`,
    ip,
  });
  return getLeaveBalance(actor, userId);
}

/** Working days of a leave (Sundays and holidays are not taken from the balance). */
export async function leaveWorkingDays(startDate, endDate) {
  const holidays = new Set(
    (await holidaysBetween(startDate, endDate)).map((holiday) => holiday.date),
  );
  return daysBetween(startDate, endDate).filter((day) => !isSunday(day) && !holidays.has(day))
    .length;
}

/** Takes an approved paid leave from the balance, once (the leave id is unique in the ledger). */
export async function takeFromBalance(actor, leave, month) {
  const days = await leaveWorkingDays(leave.startDate, leave.endDate);
  if (!days) return 0;
  await LeaveBalanceEntry.updateOne(
    { leaveRequestId: leave._id },
    {
      $setOnInsert: {
        userId: leave.userId,
        employeeId: leave.employeeId,
        days: -days,
        month,
        reason: `Paid leave ${leave.startDate} to ${leave.endDate}`,
        leaveRequestId: leave._id,
        createdBy: actor._id,
      },
    },
    { upsert: true },
  );
  return days;
}
