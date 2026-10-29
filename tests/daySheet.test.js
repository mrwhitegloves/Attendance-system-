import { describe, expect, it } from 'vitest';
import { getDailySheet, monthSoFar } from '@/server/services/attendance.service.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { textTimeToMinutes } from '@/server/lib/dates.js';
import { makeUser } from './helpers.js';

// Records as the first version of the app saved them: text time only, no `at`.
const oldRecord = (person, date, time, status) => ({
  employeeId: person.employeeId,
  userName: person.name,
  date,
  time,
  status,
});

describe('text times of old records', () => {
  it('reads 12-hour and 24-hour times', () => {
    expect(textTimeToMinutes('09:41 AM')).toBe(581);
    expect(textTimeToMinutes('07:12 pm')).toBe(19 * 60 + 12);
    expect(textTimeToMinutes('12:05 AM')).toBe(5);
    expect(textTimeToMinutes('19:09')).toBe(19 * 60 + 9);
    expect(textTimeToMinutes('9:41:30')).toBe(581);
    expect(textTimeToMinutes('25:00')).toBeNull();
    expect(textTimeToMinutes('Unknown')).toBeNull();
  });
});

describe('days of the month so far', () => {
  it('current month up to today, an earlier month in full, a later month none', () => {
    expect(monthSoFar('2026-10-15', '2026-10-29')).toEqual({ upTo: '2026-10-29', total: 29 });
    expect(monthSoFar('2026-09-23', '2026-10-29')).toEqual({ upTo: '2026-09-30', total: 30 });
    expect(monthSoFar('2026-02-03', '2026-10-29')).toEqual({ upTo: '2026-02-28', total: 28 });
    expect(monthSoFar('2026-11-02', '2026-10-29')).toEqual({ upTo: null, total: 0 });
  });
});

describe('day sheet', () => {
  it('works out hours and overtime for 24-hour records and counts days present', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const amit = await makeUser({
      name: 'Amit',
      expectedInTime: '09:30',
      expectedOutTime: '18:30',
    });
    await Attendance.insertMany([
      oldRecord(amit, '2026-09-23', '09:41', 'Late'),
      oldRecord(amit, '2026-09-23', '19:09', 'Checked Out'),
      oldRecord(amit, '2026-09-24', '09:20 AM', 'Checked In'),
      oldRecord(amit, '2026-09-24', '06:50 PM', 'Checked Out'),
      // Two punch records on one day count as one day.
      oldRecord(amit, '2026-09-25', '09:25', 'Checked In'),
      oldRecord(amit, '2026-09-25', '09:26', 'Checked In'),
      oldRecord(amit, '2026-09-26', '10:00 AM', 'Leave'),
    ]);
    const sheet = await getDailySheet(hr, '2026-09-23');
    const row = sheet.rows.find((item) => item.user.employeeId === amit.employeeId);
    expect(row.minutesWorked).toBe(9 * 60 + 28);
    // An earlier month counts in full: 30 days, and the overtime of the whole month
    // (23 Sep: 28 minutes, 24 Sep: 30 minutes), whichever day of it is viewed.
    expect(sheet.monthDays).toBe(30);
    expect(row.daysPresent).toBe(3);
    expect(row.overtimeThisMonth).toBe(28 + 30);
    const earlier = await getDailySheet(hr, '2026-09-01');
    const first = earlier.rows.find((item) => item.user.employeeId === amit.employeeId);
    expect(first).toMatchObject({ overtimeThisMonth: 28 + 30, daysPresent: 3 });

    const other = sheet.rows.find((item) => item.user.employeeId === hr.employeeId);
    expect(other).toMatchObject({ minutesWorked: null, overtimeThisMonth: 0, daysPresent: 0 });
  });
});
