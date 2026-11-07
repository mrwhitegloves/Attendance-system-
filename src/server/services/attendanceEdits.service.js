import { Attendance } from '../models/attendance.model.js';
import { AttendanceEdit } from '../models/attendanceEdit.model.js';
import { User } from '../models/user.model.js';
import { Payslip } from '../models/payslip.model.js';
import { canSeeEmployee, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { clockToMinutes, indiaClock, indiaDay, indiaMinutes } from '../lib/dates.js';
import { recordAudit } from './audit.service.js';
import { dayStatus, isPunchIn, punchInStatus, recordMinutes } from './attendance.service.js';
import { refreshSlipAttendance } from './payslips.service.js';

// Correcting a day's punch times (founder, 2026-11-07). HR or the CEO sets the punch-in and
// punch-out of any past day (or today) of an employee, with a reason:
// - an absent day gets punches, and its "Absent" mark is removed;
// - late or on time is worked out again from the employee's expected time;
// - the photo and place of an existing punch stay; only its time changes;
// - not on a leave day, not when that month's salary slip is final, never your own attendance;
// - every edit is kept in `attendance_edits` (the screen shows how often a month was edited) and
//   in the audit log; a draft salary slip of that month is worked out again.

const momentOf = (date, clock) => new Date(`${date}T${clock}:00+05:30`);
const sameMinute = (record, clock) =>
  record ? Boolean(clock) && recordMinutes(record) === clockToMinutes(clock) : !clock;

/**
 * Sets the punch-in (required) and punch-out (optional; empty removes it) of one day.
 * → { ok, editsThisMonth }
 */
export async function editAttendanceDay(
  actor,
  userId,
  { date, punchInTime, punchOutTime, reason },
  { ip, now = new Date() } = {},
) {
  requirePermission(actor, 'attendance.edit');
  const person = await User.findById(userId)
    .lean()
    .catch(() => null);
  if (!person || !(await canSeeEmployee(actor, 'attendance.view', person.employeeId)))
    throw notFound('Employee');
  if (String(person._id) === String(actor._id)) {
    throw createAppError(403, 'Your own attendance is corrected by someone else.');
  }

  const today = indiaDay(now);
  if (date > today) throw createAppError(400, 'date: the day cannot be in the future');
  if (date === today && clockToMinutes(punchOutTime || punchInTime) > indiaMinutes(now)) {
    throw createAppError(400, 'The time cannot be later than now.');
  }
  if (punchOutTime && clockToMinutes(punchOutTime) <= clockToMinutes(punchInTime)) {
    throw createAppError(400, 'The punch-out must be after the punch-in.');
  }
  const month = date.slice(0, 7);
  if (await Payslip.exists({ employeeId: person.employeeId, month, status: 'final' })) {
    throw createAppError(409, 'The salary slip of that month is final. Re-open it first.');
  }

  const records = await Attendance.find({ employeeId: person.employeeId, date })
    .sort({ createdAt: 1 })
    .lean();
  if (records.some((record) => record.status === 'Leave')) {
    throw createAppError(409, 'That day is a leave day. Change the leave on the Leave screen.');
  }
  const ins = records.filter(isPunchIn);
  const outs = records.filter((record) => record.status === 'Checked Out');
  const existingIn = ins[0] ?? null;
  const existingOut = outs.at(-1) ?? null;
  if (
    sameMinute(existingIn, punchInTime) &&
    sameMinute(existingOut, punchOutTime) &&
    !records.some((record) => record.status === 'Absent')
  ) {
    throw createAppError(400, 'Nothing changed: the times are the same as before.');
  }
  const before = {
    status: dayStatus(records, false),
    punchIn: existingIn?.time ?? '',
    punchOut: existingOut?.time ?? '',
  };

  const write = async (existing, clock, status) => {
    const at = momentOf(date, clock);
    const fields = { time: indiaClock(at), at, status, source: 'admin', remark: reason };
    if (existing) {
      await Attendance.updateOne({ _id: existing._id }, { $set: fields });
      return fields.time;
    }
    await Attendance.create({
      ...fields,
      employeeId: person.employeeId,
      userId: person._id,
      userName: person.name,
      date,
      location: `Entered by ${actor.name}`,
    });
    return fields.time;
  };

  const inStatus = punchInStatus(person, clockToMinutes(punchInTime));
  const after = {
    status: inStatus === 'Late' ? 'Late' : 'Present',
    punchIn: await write(existingIn, punchInTime, inStatus),
    punchOut: punchOutTime ? await write(existingOut, punchOutTime, 'Checked Out') : '',
  };
  // One punch-in and one punch-out a day: extra old ones, a removed punch-out and the day's
  // "Absent" mark go.
  const remove = [
    ...ins.slice(1),
    ...(punchOutTime ? outs.filter((record) => record !== existingOut) : outs),
    ...records.filter((record) => record.status === 'Absent'),
  ].map((record) => record._id);
  if (remove.length) await Attendance.deleteMany({ _id: { $in: remove } });

  await AttendanceEdit.create({
    userId: person._id,
    employeeId: person.employeeId,
    date,
    month,
    before,
    after,
    reason,
    editedBy: actor._id,
    editedByName: actor.name,
  });
  const show = (punches) =>
    `${punches.status}, in ${punches.punchIn || '—'}, out ${punches.punchOut || '—'}`;
  await recordAudit(actor, {
    action: 'attendance.edited',
    entity: 'attendance',
    entityId: person._id,
    summary: `${person.name} (${person.employeeId}), ${date}: ${show(before)} → ${show(after)}. ${reason}`,
    ip,
  });

  const draft = await Payslip.findOne({
    employeeId: person.employeeId,
    month,
    status: 'draft',
  }).lean();
  if (draft) await refreshSlipAttendance(actor, draft, person);

  return {
    ok: true,
    editsThisMonth: await AttendanceEdit.countDocuments({ employeeId: person.employeeId, month }),
  };
}
