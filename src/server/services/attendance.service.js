import { Attendance, PUNCH_IN_STATUSES } from '../models/attendance.model.js';
import { User } from '../models/user.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { Payslip } from '../models/payslip.model.js';
import { canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { runListQuery } from '../lib/pagination.js';
import { isWeeklyOff } from '../../config/employeeOptions.js';
import {
  indiaDay,
  indiaClock,
  indiaMinutes,
  clockToMinutes,
  textTimeToMinutes,
  daysBetween,
  monthBounds,
  daysInMonth,
} from '../lib/dates.js';
import { isStorageConfigured, putFile, signedUrl } from '../infra/storage.js';
import { decodeImageDataUrl } from '../lib/images.js';
import { notifyActiveEmployees } from './push.service.js';
import { compOffsBetween, holidaysBetween } from './leaveRules.service.js';
import { dayCondition } from '../lib/dateFilter.js';

// Attendance rules (CEO, 2026-10-27), enforced by the server:
// - one punch-in and one punch-out a day, at any hour; the time is the server's, in India time;
// - 5 minutes of grace: expected 10:00 → up to 10:05:59 is on time, from 10:06 it is "Late";
// - after 3 late days in a month the person is warned, and must confirm a further late punch;
// - a missed punch-out is never turned into "Absent" automatically.

export const LATE_GRACE_MINUTES = 5;
export const MONTHLY_LATE_LIMIT = 3;

const isPunchIn = (record) => PUNCH_IN_STATUSES.includes(record.status);

/** "Late" from the 6th minute after the person's expected time, else "Checked In". */
const punchInStatus = (person, minutes) => {
  const expected = clockToMinutes(person.expectedInTime) ?? clockToMinutes('09:30');
  return minutes > expected + LATE_GRACE_MINUTES ? 'Late' : 'Checked In';
};

/**
 * Minutes since midnight of a record: from `at` when present, else from the old text time
 * ("09:41 AM" or "19:09"), else from when the record was saved.
 */
const recordMinutes = (record) => {
  if (record.at) return indiaMinutes(new Date(record.at));
  const fromText = textTimeToMinutes(record.time);
  if (fromText !== null) return fromText;
  return record.createdAt ? indiaMinutes(new Date(record.createdAt)) : null;
};

async function photoUrl(record) {
  if (record.selfieKey) return signedUrl(record.selfieKey);
  return record.selfie || null;
}

/** A record as the screens see it. */
export async function toView(record) {
  return {
    _id: record._id,
    employeeId: record.employeeId,
    userName: record.userName,
    date: record.date,
    time: record.time,
    status: record.status,
    source: record.source || 'app',
    location: record.location,
    lat: record.lat ?? null,
    lon: record.lon ?? null,
    remark: record.remark,
    photoUrl: await photoUrl(record),
  };
}

async function lateDaysThisMonth(employeeId, today) {
  const days = await Attendance.distinct('date', {
    employeeId,
    status: 'Late',
    date: { $gte: `${today.slice(0, 7)}-01`, $lte: today },
  });
  return days.length;
}

/** The person's own day: what they did today and what the next punch will be. */
export async function getMyDay(actor, now = new Date()) {
  requirePermission(actor, 'attendance.punch');
  const today = indiaDay(now);
  const records = await Attendance.find({ employeeId: actor.employeeId, date: today })
    .sort({ createdAt: 1 })
    .lean();
  const punchIn = records.find(isPunchIn) ?? null;
  const punchOut = records.find((record) => record.status === 'Checked Out') ?? null;
  const onLeave = records.some((record) => record.status === 'Leave');
  return {
    date: today,
    expectedInTime: actor.expectedInTime,
    expectedOutTime: actor.expectedOutTime,
    punchIn: punchIn ? await toView(punchIn) : null,
    punchOut: punchOut ? await toView(punchOut) : null,
    onLeave,
    next: punchOut ? 'done' : punchIn ? 'out' : 'in',
    lateDaysThisMonth: await lateDaysThisMonth(actor.employeeId, today),
    lateLimit: MONTHLY_LATE_LIMIT,
    graceMinutes: LATE_GRACE_MINUTES,
  };
}

/** Punch in or out (decided by the server from today's records). */
export async function punch(actor, input, now = new Date()) {
  requirePermission(actor, 'attendance.punch');
  const today = indiaDay(now);
  const minutes = indiaMinutes(now);
  const records = await Attendance.find({ employeeId: actor.employeeId, date: today }).lean();
  if (records.some((record) => record.status === 'Checked Out')) {
    throw createAppError(409, 'You have already punched out today.', 'already_done');
  }
  const isOut = records.some(isPunchIn);

  let status = 'Checked Out';
  if (!isOut) {
    status = punchInStatus(actor, minutes);
    if (status === 'Late' && !input.confirmLate) {
      const lateDays = await lateDaysThisMonth(actor.employeeId, today);
      if (lateDays >= MONTHLY_LATE_LIMIT) {
        throw createAppError(
          409,
          `You already have ${lateDays} late days this month (the limit is ${MONTHLY_LATE_LIMIT}). This punch-in will be marked late. Please inform your manager.`,
          'late_limit',
        );
      }
    }
  }

  const photo = decodeImageDataUrl(input.selfie);
  let selfieKey = null;
  if (isStorageConfigured()) {
    selfieKey = await putFile(
      `selfies/${today.slice(0, 7)}/${actor.employeeId}/${today}-${isOut ? 'out' : 'in'}-${now.getTime()}.${photo.extension}`,
      photo.bytes,
      photo.contentType,
    );
  }

  const record = await Attendance.create({
    employeeId: actor.employeeId,
    userId: actor._id,
    userName: actor.name,
    date: today,
    time: indiaClock(now),
    at: now,
    status,
    source: 'app',
    lat: input.lat,
    lon: input.lon,
    location: input.location || 'Location not available',
    remark: selfieKey ? 'Selfie verified' : 'Photo not stored (storage not set up)',
    selfieKey,
  });

  const verb = {
    'Checked In': 'punched in',
    Late: 'punched in (late)',
    'Checked Out': 'punched out',
  }[status];
  notifyActiveEmployees(
    {
      title: `${actor.name} ${verb}`,
      body: `${record.time} · ${record.location}`,
      icon: '/logo.png',
      data: { url: `/attendance?date=${today}` },
    },
    { except: actor._id },
  ).catch(() => {});

  return toView(record.toObject());
}

/** Every record in the person's scope, newest first, with filters. */
export async function listAttendance(actor, query) {
  const filter = { ...(await employeeScopeFilter(actor, 'attendance.view')) };
  if (query.employeeId) {
    if (!(await canSeeEmployee(actor, 'attendance.view', query.employeeId)))
      return emptyPage(query.page);
    filter.employeeId = query.employeeId;
  }
  const days = dayCondition(query);
  if (days) filter.date = days;
  if (query.status) filter.status = query.status;
  const result = await runListQuery(Attendance, {
    filter,
    sort: { date: -1, createdAt: -1 },
    page: query.page,
    pageSize: 50,
  });
  return { ...result, items: await Promise.all(result.items.map(toView)) };
}

const emptyPage = (page) => ({ items: [], total: 0, page, pageSize: 50, pages: 1 });

function hoursBetween(first, last) {
  const start = first ? recordMinutes(first) : null;
  const end = last ? recordMinutes(last) : null;
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

/** Minutes a person is expected to work a day (expected out-time minus in-time). */
function expectedMinutes(person) {
  const start = clockToMinutes(person.expectedInTime) ?? clockToMinutes('09:30');
  const end = clockToMinutes(person.expectedOutTime) ?? clockToMinutes('18:30');
  return Math.max(0, end - start);
}

/** Minutes worked beyond the expected day (0 when not more, or no punch-out). */
const overtimeOf = (person, minutesWorked) =>
  minutesWorked ? Math.max(0, minutesWorked - expectedMinutes(person)) : 0;

/**
 * Overtime of each person from the 1st of the month up to a day (founder, 2026-10-28: it is not
 * paid and not on the salary slip; the attendance screens show it). → Map employeeId → minutes.
 */
async function overtimeThisMonth(people, upTo) {
  if (!upTo) return new Map();
  const records = await Attendance.find({
    employeeId: { $in: people.map((person) => person.employeeId) },
    date: { $gte: `${upTo.slice(0, 7)}-01`, $lte: upTo },
    status: { $in: [...PUNCH_IN_STATUSES, 'Checked Out'] },
  })
    .sort({ createdAt: 1 })
    .lean();
  const byPersonDay = Map.groupBy(records, (record) => `${record.employeeId}|${record.date}`);
  const personOf = new Map(people.map((person) => [person.employeeId, person]));
  const totals = new Map();
  for (const [key, own] of byPersonDay) {
    const person = personOf.get(key.split('|')[0]);
    const first = own.find(isPunchIn) ?? null;
    const last = own.findLast((record) => record.status === 'Checked Out') ?? null;
    const extra = overtimeOf(person, hoursBetween(first, last));
    totals.set(person.employeeId, (totals.get(person.employeeId) ?? 0) + extra);
  }
  return totals;
}

/**
 * The days of a viewed day's month that have passed (founder, 2026-10-29): the current month up
 * to today, an earlier month in full, a later month none. → { upTo, total }
 */
export function monthSoFar(date, today = indiaDay()) {
  const month = date.slice(0, 7);
  if (month < today.slice(0, 7)) {
    const total = daysInMonth(month);
    return { upTo: `${month}-${String(total).padStart(2, '0')}`, total };
  }
  if (month === today.slice(0, 7)) return { upTo: today, total: Number(today.slice(8, 10)) };
  return { upTo: null, total: 0 };
}

/** Days with a punch-in in the month so far, per person. → Map employeeId → days. */
async function daysPresent(people, month, upTo) {
  if (!upTo) return new Map();
  const rows = await Attendance.aggregate([
    {
      $match: {
        employeeId: { $in: people.map((person) => person.employeeId) },
        date: { $gte: `${month}-01`, $lte: upTo },
        status: { $in: [...PUNCH_IN_STATUSES, 'Checked Out'] },
      },
    },
    { $group: { _id: { employeeId: '$employeeId', date: '$date' } } },
    { $group: { _id: '$_id.employeeId', days: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.days]));
}

/** Status of one person on one day, from that day's records. */
function dayStatus(records, pendingLeave) {
  if (records.some((record) => record.status === 'Leave')) return 'Leave';
  if (records.some((record) => record.status === 'Late')) return 'Late';
  if (records.some((record) => record.status === 'Checked In' || record.status === 'Checked Out'))
    return 'Present';
  if (records.some((record) => record.status === 'Absent')) return 'Absent';
  if (pendingLeave) return 'Leave pending';
  return 'No punch';
}

/**
 * The person's own last `count` days, newest first (dashboard history): punches with their
 * photo and place, the day's status and the hours worked.
 */
export async function getMyRecentDays(actor, count = 7, now = new Date()) {
  requirePermission(actor, 'attendance.punch');
  const today = indiaDay(now);
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (count - 1));
  const days = daysBetween(start.toISOString().slice(0, 10), today).reverse();
  const records = await Attendance.find({
    employeeId: actor.employeeId,
    date: { $gte: days.at(-1), $lte: today },
  })
    .sort({ createdAt: 1 })
    .lean();
  const byDay = Map.groupBy(records, (record) => record.date);
  return Promise.all(
    days.map(async (date) => {
      const own = byDay.get(date) ?? [];
      const first = own.find(isPunchIn) ?? null;
      const last = own.findLast((record) => record.status === 'Checked Out') ?? null;
      return {
        date,
        status: isWeeklyOff(actor, date) && !first ? 'Weekly off' : dayStatus(own, false),
        punchIn: first ? await toView(first) : null,
        punchOut: last ? await toView(last) : null,
        minutesWorked: hoursBetween(first, last),
        remark: own.find((record) => record.remark)?.remark ?? '',
      };
    }),
  );
}

/** One day for everyone in scope: who came, when, from where. */
export async function getDailySheet(actor, date = indiaDay()) {
  const scope = await employeeScopeFilter(actor, 'attendance.view');
  const [people, records, pending] = await Promise.all([
    User.find(
      { ...scope, status: 'active' },
      '_id name employeeId department staffType expectedInTime expectedOutTime',
    )
      .sort({ name: 1 })
      .lean(),
    Attendance.find({ ...scope, date })
      .sort({ createdAt: 1 })
      .lean(),
    LeaveRequest.find(
      { ...scope, status: 'pending', startDate: { $lte: date }, endDate: { $gte: date } },
      'employeeId',
    ).lean(),
  ]);
  const byEmployee = Map.groupBy(records, (record) => record.employeeId);
  const pendingIds = new Set(pending.map((leave) => leave.employeeId));
  const month = monthSoFar(date);
  const [overtime, present] = await Promise.all([
    // Overtime: an earlier month in full (founder, 2026-10-29), else up to the viewed day.
    overtimeThisMonth(people, date.slice(0, 7) < indiaDay().slice(0, 7) ? month.upTo : date),
    daysPresent(people, date.slice(0, 7), month.upTo),
  ]);

  const rows = await Promise.all(
    people.map(async (person) => {
      const own = byEmployee.get(person.employeeId) ?? [];
      const first = own.find(isPunchIn) ?? null;
      const last = own.findLast((record) => record.status === 'Checked Out') ?? null;
      return {
        user: person,
        status: dayStatus(own, pendingIds.has(person.employeeId)),
        punchIn: first ? await toView(first) : null,
        punchOut: last ? await toView(last) : null,
        minutesWorked: hoursBetween(first, last),
        overtimeThisMonth: overtime.get(person.employeeId) ?? 0,
        daysPresent: present.get(person.employeeId) ?? 0,
        remark:
          own.find((record) => record.status === 'Absent' || record.status === 'Leave')?.remark ??
          '',
      };
    }),
  );

  const count = (status) => rows.filter((row) => row.status === status).length;
  return {
    date,
    today: indiaDay(),
    monthDays: month.total,
    summary: {
      people: rows.length,
      present: count('Present') + count('Late'),
      late: count('Late'),
      leave: count('Leave'),
      absent: count('Absent'),
      noPunch: count('No punch') + count('Leave pending'),
      stillIn: rows.filter((row) => row.punchIn && !row.punchOut).length,
    },
    rows,
  };
}

/** One person's month as a calendar, with totals. */
export async function getMonthCalendar(actor, userId, month = indiaDay().slice(0, 7)) {
  const person = await User.findById(
    userId,
    '_id name employeeId expectedInTime expectedOutTime weeklyOffs createdAt',
  )
    .lean()
    .catch(() => null);
  if (!person || !(await canSeeEmployee(actor, 'attendance.view', person.employeeId)))
    throw notFound('Employee');
  const { first, last } = monthBounds(month);
  const [records, leaves] = await Promise.all([
    Attendance.find({ employeeId: person.employeeId, date: { $gte: first, $lte: last } })
      .sort({ createdAt: 1 })
      .lean(),
    LeaveRequest.find({
      employeeId: person.employeeId,
      status: 'pending',
      startDate: { $lte: last },
      endDate: { $gte: first },
    }).lean(),
  ]);
  const byDay = Map.groupBy(records, (record) => record.date);
  const today = indiaDay();

  const days = await Promise.all(
    daysBetween(first, last).map(async (date) => {
      const own = byDay.get(date) ?? [];
      const pendingLeave = leaves.some((leave) => leave.startDate <= date && leave.endDate >= date);
      const firstIn = own.find(isPunchIn) ?? null;
      const lastOut = own.findLast((record) => record.status === 'Checked Out') ?? null;
      return {
        date,
        future: date > today,
        status: date > today ? null : dayStatus(own, pendingLeave),
        punchIn: firstIn ? await toView(firstIn) : null,
        punchOut: lastOut ? await toView(lastOut) : null,
        minutesWorked: hoursBetween(firstIn, lastOut),
        overtimeMinutes: overtimeOf(person, hoursBetween(firstIn, lastOut)),
        weeklyOff: isWeeklyOff(person, date),
        remark: own.find((record) => record.remark && record.status !== 'Checked In')?.remark ?? '',
      };
    }),
  );
  const count = (status) => days.filter((day) => day.status === status).length;
  return {
    user: person,
    month,
    days,
    totals: {
      present: count('Present') + count('Late'),
      late: count('Late'),
      leave: count('Leave'),
      absent: count('Absent'),
      overtimeMinutes: days.reduce((total, day) => total + day.overtimeMinutes, 0),
    },
  };
}

// ---- One month, day by day, as the salary slip counts it ----

/** How a day counts for the salary slip (rules in lib/payslipRules.js). */
function countDay(date, own, today, { holiday, compOff, person }) {
  if (date > today) return 'future';
  if (isWeeklyOff(person, date)) {
    return own.some(isPunchIn) ? 'weeklyOffWorked' : 'weeklyOff';
  }
  if (holiday) return 'holiday';
  if (compOff) return 'compOff';
  const leave = own.find((record) => record.status === 'Leave');
  if (leave)
    return leave.paidLeave === false
      ? 'unpaidLeave'
      : leave.paidLeave === true
        ? 'paidLeave'
        : 'unmarkedLeave';
  if (own.some((record) => record.status === 'Late')) return 'half';
  if (own.some((record) => record.status === 'Checked In')) return 'full';
  return 'absent';
}

/**
 * Every day of a month for one employee, with its punches and how it counts. No permission
 * check: callers load the employee (or the slip) with its access check first.
 */
export async function buildMonthDays(person, month, now = new Date()) {
  const { first, last } = monthBounds(month);
  const records = await Attendance.find({
    employeeId: person.employeeId,
    date: { $gte: first, $lte: last },
  })
    .sort({ createdAt: 1 })
    .lean();
  const byDay = Map.groupBy(records, (record) => record.date);
  const today = indiaDay(now);
  const [holidays, compOffs] = await Promise.all([
    holidaysBetween(first, last),
    compOffsBetween(person.employeeId, first, last),
  ]);
  const holidayOn = new Map(holidays.map((holiday) => [holiday.date, holiday]));
  const compOffOn = new Map(compOffs.map((compOff) => [compOff.offOn, compOff]));
  const workedFor = new Map(compOffs.map((compOff) => [compOff.workedOn, compOff]));
  return Promise.all(
    daysBetween(first, last).map(async (date) => {
      const own = byDay.get(date) ?? [];
      const firstIn = own.find(isPunchIn) ?? null;
      const lastOut = own.findLast((record) => record.status === 'Checked Out') ?? null;
      const leave = own.find((record) => record.status === 'Leave');
      return {
        date,
        countedAs: countDay(date, own, today, {
          person,
          holiday: holidayOn.get(date),
          compOff: compOffOn.get(date),
        }),
        holiday: holidayOn.get(date)?.name ?? null,
        compOffFor: compOffOn.get(date)?.workedOn ?? null,
        compOffOn: workedFor.get(date)?.offOn ?? null,
        punchIn: firstIn ? await toView(firstIn) : null,
        punchOut: lastOut ? await toView(lastOut) : null,
        minutesWorked: hoursBetween(firstIn, lastOut),
        remark: (leave ?? own.find((record) => record.status === 'Absent'))?.remark ?? '',
      };
    }),
  );
}

// ---- Missed punches (regularization), added when HR approves the employee's request ----

const momentOf = (date, clock) => new Date(`${date}T${clock}:00+05:30`);

/**
 * Checks that a missed punch-in and/or punch-out can be added to a past day. Throws a 400/409
 * error with a plain reason. Rules: not in the future; not on a leave day; not when that month's
 * salary slip is final; never a second punch-in or punch-out; a punch-out needs a punch-in
 * before it.
 */
export async function checkMissedPunch(
  person,
  { date, punchInTime, punchOutTime },
  now = new Date(),
) {
  if (!punchInTime && !punchOutTime)
    throw createAppError(400, 'Enter the punch-in or punch-out time.');
  if (date > indiaDay(now)) throw createAppError(400, 'date: the day cannot be in the future');
  if (date === indiaDay(now)) {
    const latest = clockToMinutes(punchOutTime || punchInTime);
    if (latest > indiaMinutes(now)) throw createAppError(400, 'The time cannot be later than now.');
  }
  const finalSlip = await Payslip.exists({
    employeeId: person.employeeId,
    month: date.slice(0, 7),
    status: 'final',
  });
  if (finalSlip) {
    throw createAppError(409, 'The salary slip of that month is final. HR must reopen it first.');
  }
  const records = await Attendance.find({ employeeId: person.employeeId, date }).lean();
  if (records.some((record) => record.status === 'Leave')) {
    throw createAppError(409, 'That day is a leave day.');
  }
  const existingIn = records.find(isPunchIn);
  if (punchInTime && existingIn) {
    throw createAppError(409, `There is already a punch-in on that day (${existingIn.time}).`);
  }
  if (punchOutTime && records.some((record) => record.status === 'Checked Out')) {
    throw createAppError(409, 'There is already a punch-out on that day.');
  }
  if (punchOutTime) {
    const inMinutes = punchInTime
      ? clockToMinutes(punchInTime)
      : existingIn
        ? recordMinutes(existingIn)
        : null;
    if (inMinutes === null) {
      throw createAppError(409, 'There is no punch-in on that day. Ask for both punches.');
    }
    if (clockToMinutes(punchOutTime) <= inMinutes) {
      throw createAppError(400, 'The punch-out must be after the punch-in.');
    }
  }
}

/** Writes the approved missed punches. Safe to run twice (one punch-in and one punch-out a day). */
export async function writeMissedPunch(person, { date, punchInTime, punchOutTime }, { note }) {
  const write = async (clock, status, match) => {
    const at = momentOf(date, clock);
    await Attendance.updateOne(
      { employeeId: person.employeeId, date, status: match },
      {
        $setOnInsert: {
          employeeId: person.employeeId,
          userId: person._id,
          userName: person.name,
          date,
          time: indiaClock(at),
          at,
          status,
          source: 'regularization',
          location: 'Missed punch (added by HR)',
          remark: note,
        },
      },
      { upsert: true },
    );
  };
  if (punchInTime) {
    await write(punchInTime, punchInStatus(person, clockToMinutes(punchInTime)), {
      $in: PUNCH_IN_STATUSES,
    });
  }
  if (punchOutTime) await write(punchOutTime, 'Checked Out', 'Checked Out');
}
