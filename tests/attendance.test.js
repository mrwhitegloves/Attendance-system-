import { describe, expect, it } from 'vitest';
import { punch, getDailySheet, getMyDay } from '@/server/services/attendance.service.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { POST as punchRoute, GET as listRoute } from '@/app/api/attendance/route.js';
import { call, makeUser, PHOTO, at } from './helpers.js';

const DAY = '2026-10-26';

describe('punch', () => {
  it('gives 5 minutes of grace: 10:05:59 is on time, 10:06 is late', async () => {
    const onTime = await makeUser({ expectedInTime: '10:00' });
    const late = await makeUser({ expectedInTime: '10:00' });
    const a = await punch(onTime, { selfie: PHOTO }, new Date('2026-10-26T10:05:59+05:30'));
    const b = await punch(late, { selfie: PHOTO }, at(DAY, '10:06'));
    expect(a).toMatchObject({ status: 'Checked In', date: DAY, time: '10:05 AM' });
    expect(b.status).toBe('Late');
  });

  it('ignores a time or status sent by the browser', async () => {
    const person = await makeUser();
    const result = await call(punchRoute, {
      method: 'POST',
      user: person,
      body: { selfie: PHOTO, status: 'Checked In', time: '08:00 AM' },
    });
    expect(result.status).toBe(400);
  });

  it('allows one punch-in and one punch-out a day', async () => {
    const person = await makeUser();
    await punch(person, { selfie: PHOTO }, at(DAY, '09:00'));
    const out = await punch(person, { selfie: PHOTO }, at(DAY, '18:40'));
    expect(out.status).toBe('Checked Out');
    await expect(punch(person, { selfie: PHOTO }, at(DAY, '19:00'))).rejects.toMatchObject({
      status: 409,
    });
  });

  it('allows punch-in and punch-out after 7:30 PM', async () => {
    const person = await makeUser();
    const punchIn = await punch(person, { selfie: PHOTO }, at(DAY, '20:15'));
    const punchOut = await punch(person, { selfie: PHOTO }, at(DAY, '23:10'));
    expect(punchIn.status).toBe('Late');
    expect(punchOut.status).toBe('Checked Out');
  });

  it('asks for confirmation after the monthly late limit', async () => {
    const person = await makeUser({ expectedInTime: '09:30' });
    for (const day of ['2026-10-05', '2026-10-06', '2026-10-07']) {
      await punch(person, { selfie: PHOTO }, at(day, '10:00'));
    }
    await expect(punch(person, { selfie: PHOTO }, at(DAY, '10:00'))).rejects.toMatchObject({
      code: 'late_limit',
    });
    const confirmed = await punch(person, { selfie: PHOTO, confirmLate: true }, at(DAY, '10:00'));
    expect(confirmed.status).toBe('Late');
  });

  it('reports the next punch for the person', async () => {
    const person = await makeUser();
    const before = await getMyDay(person, at(DAY, '08:00'));
    expect(before.next).toBe('in');
    await punch(person, { selfie: PHOTO }, at(DAY, '09:00'));
    const after = await getMyDay(person, at(DAY, '09:05'));
    expect(after.next).toBe('out');
  });
});

describe('who sees what', () => {
  it('an employee sees only their own records', async () => {
    const me = await makeUser();
    const other = await makeUser();
    await punch(me, { selfie: PHOTO }, at(DAY, '09:00'));
    await punch(other, { selfie: PHOTO }, at(DAY, '09:00'));
    const result = await call(listRoute, {
      user: me,
      url: `/api/attendance?employeeId=${other.employeeId}`,
    });
    expect(result.body.items).toHaveLength(0);
    const own = await call(listRoute, { user: me });
    expect(own.body.items.map((item) => item.employeeId)).toEqual([me.employeeId]);
  });

  it('the daily sheet shows everyone for HR', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser({ expectedInTime: '09:30' });
    await punch(staff, { selfie: PHOTO }, at(DAY, '09:45'));
    const sheet = await getDailySheet(hr, DAY);
    const row = sheet.rows.find((item) => item.user.employeeId === staff.employeeId);
    expect(row.status).toBe('Late');
    expect(sheet.summary.late).toBe(1);
  });
});

describe('missed punch-out', () => {
  it('is never marked Absent automatically', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const person = await makeUser();
    await punch(person, { selfie: PHOTO }, at('2026-10-25', '09:00'));
    await getDailySheet(hr, DAY);
    expect(await Attendance.countDocuments({ status: 'Absent' })).toBe(0);
  });
});
