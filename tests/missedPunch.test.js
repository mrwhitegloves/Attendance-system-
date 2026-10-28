import { describe, expect, it } from 'vitest';
import { POST as createRoute } from '@/app/api/requests/route.js';
import { POST as decideRoute } from '@/app/api/requests/[id]/decide/route.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { buildMonthDays } from '@/server/services/attendance.service.js';
import { Payslip } from '@/server/models/payslip.model.js';
import { AuditLog } from '@/server/models/system.models.js';
import { call, makeUser, at } from './helpers.js';

const DAY = '2026-10-20';

const send = (user, body) =>
  call(createRoute, { method: 'POST', user, body: { kind: 'regularization', ...body } });
const decide = (user, id, body) =>
  call(decideRoute, { method: 'POST', user, params: { id }, body });

async function people() {
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  const staff = await makeUser({ name: 'Sunil Field', expectedInTime: '10:00' });
  return { hr, staff };
}

const punchIn = (person, clock, status = 'Checked In') =>
  Attendance.create({
    employeeId: person.employeeId,
    userId: person._id,
    userName: person.name,
    date: DAY,
    time: clock,
    at: at(DAY, clock),
    status,
  });

describe('missed punch', () => {
  it('adds a missed punch-out when HR approves, and never before', async () => {
    const { hr, staff } = await people();
    await punchIn(staff, '09:55');
    const sent = await send(staff, { category: 'punch_out', date: DAY, punchOutTime: '18:40' });
    expect(sent.status).toBe(200);
    expect(sent.body.request.subject).toBe(`Missed punch-out on ${DAY}`);
    expect(await Attendance.exists({ employeeId: staff.employeeId, status: 'Checked Out' })).toBe(
      null,
    );

    const approved = await decide(hr, sent.body.request._id, { decision: 'approved' });
    expect(approved.status).toBe(200);
    expect(approved.body.request.approvedPunchOutTime).toBe('18:40');
    const out = await Attendance.findOne({ employeeId: staff.employeeId, status: 'Checked Out' });
    expect(out).toMatchObject({ date: DAY, time: '06:40 PM', source: 'regularization' });
    expect(out.remark).toContain('approved by Ravi HR');
  });

  it('marks a missed punch-in late by the same rule; HR may correct the time', async () => {
    const { hr, staff } = await people();
    const late = await send(staff, {
      category: 'both',
      date: DAY,
      punchInTime: '10:20',
      punchOutTime: '19:00',
    });
    await decide(hr, late.body.request._id, { decision: 'approved', punchInTime: '10:05' });
    const records = await Attendance.find({ employeeId: staff.employeeId }).lean();
    expect(records.map((record) => record.status).sort()).toEqual(['Checked In', 'Checked Out']);
    const audit = await AuditLog.findOne({ action: 'request.approved' }).lean();
    expect(audit.changes.punchInTime).toEqual({ from: '10:20', to: '10:05' });

    const other = await makeUser({ expectedInTime: '10:00' });
    const sent = await send(other, { category: 'punch_in', date: DAY, punchInTime: '10:06' });
    await decide(hr, sent.body.request._id, { decision: 'approved' });
    const record = await Attendance.findOne({ employeeId: other.employeeId }).lean();
    expect(record.status).toBe('Late');
    // The salary slip counts it like any late punch-in: a half day.
    const days = await buildMonthDays(other, '2026-10', at('2026-10-27', '12:00'));
    expect(days.find((day) => day.date === DAY).countedAs).toBe('half');
  });

  it('refuses days and times that cannot be right', async () => {
    const { staff } = await people();
    const future = await send(staff, {
      category: 'punch_in',
      date: '2099-01-01',
      punchInTime: '10:00',
    });
    const noOut = await send(staff, { category: 'punch_out', date: DAY, punchOutTime: '18:00' });
    const backwards = await send(staff, {
      category: 'both',
      date: DAY,
      punchInTime: '10:00',
      punchOutTime: '09:00',
    });
    const noTime = await send(staff, { category: 'punch_in', date: DAY });
    expect(future.status).toBe(400);
    expect(noOut.status).toBe(409);
    expect(backwards.status).toBe(400);
    expect(noTime.status).toBe(400);

    await punchIn(staff, '09:50');
    const second = await send(staff, { category: 'punch_in', date: DAY, punchInTime: '09:00' });
    expect(second.status).toBe(409);
  });

  it('refuses a month whose salary slip is final, and a leave day', async () => {
    const { staff } = await people();
    await Payslip.collection.insertOne({
      userId: staff._id,
      employeeId: staff.employeeId,
      month: '2026-09',
      status: 'final',
    });
    const finalMonth = await send(staff, {
      category: 'punch_in',
      date: '2026-09-15',
      punchInTime: '10:00',
    });
    expect(finalMonth.status).toBe(409);
    expect(finalMonth.body.error).toContain('final');

    await punchIn(staff, '09:00', 'Leave');
    const leaveDay = await send(staff, { category: 'punch_in', date: DAY, punchInTime: '10:00' });
    expect(leaveDay.status).toBe(409);
  });

  it('checks the day again at approval', async () => {
    const { hr, staff } = await people();
    const sent = await send(staff, { category: 'punch_in', date: DAY, punchInTime: '09:58' });
    await punchIn(staff, '10:01');
    const approved = await decide(hr, sent.body.request._id, { decision: 'approved' });
    expect(approved.status).toBe(409);
    expect(await Attendance.countDocuments({ employeeId: staff.employeeId })).toBe(1);
  });
});
