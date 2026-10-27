import { describe, expect, it } from 'vitest';
import { calculateMonth } from '@/server/lib/payslipRules.js';
import { buildMonthDays } from '@/server/services/attendance.service.js';
import { requestLeave, decideLeave } from '@/server/services/leaves.service.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { makeUser } from './helpers.js';

const paise = (rupees) => rupees * 100;
const days = (counts) =>
  Object.entries(counts).flatMap(([countedAs, number]) =>
    Array.from({ length: number }, () => ({ countedAs })),
  );

describe('salary rules from attendance (founder, 2026-10-27)', () => {
  it('one day = monthly salary ÷ days in the month (30 days: ₹900)', () => {
    const result = calculateMonth({
      days: days({ full: 25, unpaidLeave: 1, sunday: 4 }),
      monthlyGrossPaise: paise(27000),
      calendarDays: 30,
    });
    expect(result.perDayPaise).toBe(paise(900));
    expect(result.lossOfPayPaise).toBe(paise(900));
    expect(result.workingDays).toBe(26);
  });

  it('a 31-day month: one day is ₹870.97', () => {
    const result = calculateMonth({
      days: days({ full: 26, unpaidLeave: 1, sunday: 4 }),
      monthlyGrossPaise: paise(27000),
      calendarDays: 31,
    });
    expect(result.lossOfPayPaise).toBe(87097);
  });

  it('the first 3 half days are free; each further one costs half a day', () => {
    const three = calculateMonth({
      days: days({ half: 3, full: 23 }),
      monthlyGrossPaise: paise(27000),
      calendarDays: 30,
    });
    expect(three.lossOfPayPaise).toBe(0);
    const five = calculateMonth({
      days: days({ half: 5, full: 21 }),
      monthlyGrossPaise: paise(27000),
      calendarDays: 30,
    });
    expect(five).toMatchObject({
      chargedHalfDays: 2,
      lossOfPayDays: 1,
      lossOfPayPaise: paise(900),
    });
  });

  it('paid leave costs nothing; unpaid leave and absence cost a full day each', () => {
    const result = calculateMonth({
      days: days({ paidLeave: 2, unpaidLeave: 1, absent: 2, full: 21 }),
      monthlyGrossPaise: paise(30000),
      calendarDays: 30,
    });
    expect(result).toMatchObject({
      paidLeaveDays: 2,
      lossOfPayDays: 3,
      lossOfPayPaise: paise(3000),
    });
  });

  it('days after today are not counted', () => {
    const result = calculateMonth({
      days: days({ full: 10, future: 16, sunday: 4 }),
      monthlyGrossPaise: paise(27000),
      calendarDays: 30,
    });
    expect(result.lossOfPayPaise).toBe(0);
  });
});

describe('how each day of a month is counted', () => {
  it('Sundays off, late is a half day, approved leave carries paid or unpaid', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await Attendance.create([
      { employeeId: staff.employeeId, date: '2026-09-01', time: '09:20 AM', status: 'Checked In' },
      { employeeId: staff.employeeId, date: '2026-09-02', time: '09:45 AM', status: 'Late' },
      { employeeId: staff.employeeId, date: '2026-09-06', time: '10:00 AM', status: 'Checked In' },
    ]);
    const paidLeave = await requestLeave(staff, {
      startDate: '2026-09-03',
      endDate: '2026-09-03',
      reason: 'Family function',
    });
    await decideLeave(hr, paidLeave._id, { decision: 'approved', note: '', paid: true });
    const unpaidLeave = await requestLeave(staff, {
      startDate: '2026-09-04',
      endDate: '2026-09-04',
      reason: 'Personal work',
    });
    await expect(
      decideLeave(hr, unpaidLeave._id, { decision: 'approved', note: '' }),
    ).rejects.toMatchObject({ status: 400 });
    await decideLeave(hr, unpaidLeave._id, { decision: 'approved', note: '', paid: false });

    const month = await buildMonthDays(staff, '2026-09', new Date('2026-10-05T12:00:00+05:30'));
    const on = (date) => month.find((day) => day.date === date).countedAs;
    expect(on('2026-09-01')).toBe('full');
    expect(on('2026-09-02')).toBe('half');
    expect(on('2026-09-03')).toBe('paidLeave');
    expect(on('2026-09-04')).toBe('unpaidLeave');
    expect(on('2026-09-05')).toBe('absent');
    expect(on('2026-09-06')).toBe('sunday');
    expect(month.find((day) => day.date === '2026-09-01').punchIn.time).toBe('09:20 AM');
  });
});
