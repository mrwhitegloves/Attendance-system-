import { Attendance, PUNCH_IN_STATUSES } from '../models/attendance.model.js';
import { User } from '../models/user.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { runListQuery } from '../lib/pagination.js';
import {
  indiaDay,
  indiaClock,
  indiaMinutes,
  clockToMinutes,
  twelveHourToMinutes,
  daysBetween,
  monthBounds,
} from '../lib/dates.js';
import { isStorageConfigured, putFile, signedUrl } from '../infra/storage.js';
import { decodeImageDataUrl } from '../lib/images.js';
import { notifyActiveEmployees } from './push.service.js';
import { compOffsBetween, holidaysBetween } from './leaveRules.service.js';

// Attendance rules (CEO, 2026-10-27), enforced by the server:
// - one punch-in and one punch-out a day, at any hour; the time is the server's, in India time;
// - 5 minutes of grace: expected 10:00 → up to 10:05:59 is on time, from 10:06 it is "Late";
// - after 3 late days in a month the person is warned, and must confirm a further late punch;
// - a missed punch-out is never turned into "Absent" automatically.

export const LATE_GRACE_MINUTES = 5;
export const MONTHLY_LATE_LIMIT = 3;

const isPunchIn = (record) => PUNCH_IN_STATUSES.includes(record.status);

/** Minutes since midnight of a record: from `at` when present, else from the old text time. */
const recordMinutes = (record) =>
  record.at ? indiaMinutes(new Date(record.at)) : twelveHourToMinutes(record.time);

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
    const expected = clockToMinutes(actor.expectedInTime) ?? clockToMinutes('09:30');
    status = minutes > expected + LATE_GRACE_MINUTES ? 'Late' : 'Checked In';
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
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) filter.date.$lte = query.to;
  }
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

/** One day for everyone in scope: who came, when, from where. */
export async function getDailySheet(actor, date = indiaDay()) {
  const scope = await employeeScopeFilter(actor, 'attendance.view');
  const [people, records, pending] = await Promise.all([
    User.find(
      { ...scope, status: 'active' },
      '_id name employeeId department staffType expectedInTime',
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
        remark:
          own.find((record) => record.status === 'Absent' || record.status === 'Leave')?.remark ??
          '',
      };
    }),
  );

  const count = (status) => rows.filter((row) => row.status === status).length;
  return {
    date,
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
  const person = await User.findById(userId, '_id name employeeId expectedInTime createdAt')
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
    },
  };
}

// ---- One month, day by day, as the salary slip counts it ----

/** How a day counts for the salary slip (rules in lib/payslipRules.js). */
function countDay(date, own, today, { holiday, compOff }) {
  if (date > today) return 'future';
  if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) {
    return own.some(isPunchIn) ? 'sundayWorked' : 'sunday';
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
