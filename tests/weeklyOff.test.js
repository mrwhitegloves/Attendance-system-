import { describe, expect, it } from 'vitest';
import { Attendance } from '@/server/models/attendance.model.js';
import {
  buildMonthDays,
  getDailySheet,
  getMonthCalendar,
} from '@/server/services/attendance.service.js';
import { addCompOff } from '@/server/services/leaveRules.service.js';
import { calculateMonth } from '@/server/lib/payslipRules.js';
import { at, makeUser } from './helpers.js';

const NOW = new Date('2026-12-05T12:00:00+05:30');

const punch = (person, date, clock, status) =>
  Attendance.create({
    employeeId: person.employeeId,
    userId: person._id,
    userName: person.name,
    date,
    time: clock,
    at: at(date, clock),
    status,
  });

describe('weekly off of each employee (founder, 2026-10-28)', () => {
  it('a Tuesday-off employee works Sundays; Tuesdays are not working days', async () => {
    const staff = await makeUser({ weeklyOffs: [2] });
    const days = await buildMonthDays(staff, '2026-11', NOW);
    const on = (date) => days.find((day) => day.date === date).countedAs;
    expect(on('2026-11-03')).toBe('weeklyOff'); // Tuesday
    expect(on('2026-11-01')).toBe('absent'); // Sunday, a working day for this person
    const result = calculateMonth({ days, monthlyGrossPaise: 3000000, calendarDays: 30 });
    expect(result.workingDays).toBe(30 - 4); // November 2026 has 4 Tuesdays
  });

  it('two weekly offs: both days are off', async () => {
    const staff = await makeUser({ weeklyOffs: [0, 2] });
    const days = await buildMonthDays(staff, '2026-11', NOW);
    const result = calculateMonth({ days, monthlyGrossPaise: 3000000, calendarDays: 30 });
    expect(result.workingDays).toBe(30 - 5 - 4); // 5 Sundays and 4 Tuesdays
  });

  it('a comp-off needs the weekly off of that employee', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser({ weeklyOffs: [2] });
    await expect(
      addCompOff(hr, staff._id, { workedOn: '2026-11-01', offOn: '2026-11-05' }),
    ).rejects.toMatchObject({ status: 400 });
    await addCompOff(hr, staff._id, { workedOn: '2026-11-03', offOn: '2026-11-05' });
  });
});

describe('overtime (shown, never paid)', () => {
  it('adds the minutes beyond the expected day, for the month so far', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser({ expectedInTime: '10:00', expectedOutTime: '19:00' });
    // 9 hours expected. 2 Nov: 10:00–20:30 → 1h 30m. 3 Nov: 10:00–19:30 → 30m. 4 Nov: short day.
    await punch(staff, '2026-11-02', '10:00', 'Checked In');
    await punch(staff, '2026-11-02', '20:30', 'Checked Out');
    await punch(staff, '2026-11-03', '10:00', 'Checked In');
    await punch(staff, '2026-11-03', '19:30', 'Checked Out');
    await punch(staff, '2026-11-04', '10:00', 'Checked In');
    await punch(staff, '2026-11-04', '17:00', 'Checked Out');

    const calendar = await getMonthCalendar(hr, staff._id, '2026-11');
    expect(calendar.totals.overtimeMinutes).toBe(120);

    const sheet = await getDailySheet(hr, '2026-11-03');
    const row = sheet.rows.find((item) => item.user.employeeId === staff.employeeId);
    expect(row.overtimeThisMonth).toBe(120);
  });
});
