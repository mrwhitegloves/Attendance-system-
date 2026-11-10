import { describe, expect, it } from 'vitest';
import { attendanceEarnings, calculateMonth } from '@/server/lib/payslipRules.js';
import { getMonthCalendar } from '@/server/services/attendance.service.js';
import { createPayslip, finalisePayslip } from '@/server/services/payslips.service.js';
import { proposeSalary, decideSalary } from '@/server/services/salary.service.js';
import { restoreFromTrash } from '@/server/services/trash.service.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { Payslip } from '@/server/models/payslip.model.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { Holiday } from '@/server/models/leaveRules.model.js';
import { DeletedItem } from '@/server/models/deletedItem.model.js';
import { DELETE as deleteRoute } from '@/app/api/payslips/[id]/route.js';
import { at, call, makeUser } from './helpers.js';

const paise = (rupees) => rupees * 100;
const days = (counts) =>
  Object.entries(counts).flatMap(([countedAs, number]) =>
    Array.from({ length: number }, () => ({ countedAs })),
  );

describe('earnings by paid days (founder, 2026-11-10)', () => {
  it('the agreed example: ₹31,000, 31 days → Basic ₹27,000, Paid Leave ₹1,000, HD ₹1,500', () => {
    const calculation = calculateMonth({
      days: days({ full: 20, weeklyOff: 4, holiday: 1, half: 4, paidLeave: 1, absent: 1 }),
      monthlyGrossPaise: paise(31000),
      calendarDays: 31,
    });
    expect(calculation).toMatchObject({
      perDayPaise: paise(1000),
      slipWorkingDays: 24, // full + half
      leavesTaken: 6, // 4 weekly offs + 1 holiday + 1 paid leave
      earnedDays: 27, // 20 + 4 + 1 + 4 × ½
      paidLeavePaise: paise(1000),
      hdAllowancePaise: paise(1500), // the first 3 half days, ½ day each
      lossOfPayDays: 1.5, // the absent day + the 4th half day's unpaid half
      lossOfPayPaise: paise(1500),
    });
    const earnings = attendanceEarnings({ basic: paise(31000) }, calculation);
    expect(earnings).toEqual({
      basic: paise(27000),
      paidLeave: paise(1000),
      hdAllowance: paise(1500),
    });
    // ₹29,500 = ₹31,000 less the absent day and half of the 4th half day.
    expect(earnings.basic + earnings.paidLeave + earnings.hdAllowance).toBe(paise(29500));
  });

  it('every fixed earning is paid for its share of the paid days', () => {
    const calculation = calculateMonth({
      days: days({ full: 26, weeklyOff: 4 }),
      monthlyGrossPaise: paise(30000),
      calendarDays: 30,
    });
    expect(attendanceEarnings({ basic: paise(20000), hra: paise(10000) }, calculation)).toEqual({
      basic: paise(20000),
      hra: paise(10000),
      paidLeave: 0,
      hdAllowance: 0,
    });
  });

  it('days before joining are not counted at all', () => {
    const calculation = calculateMonth({
      days: days({ notJoined: 13, full: 10, half: 4, weeklyOff: 3, holiday: 1 }),
      monthlyGrossPaise: paise(31000),
      calendarDays: 31,
    });
    expect(calculation).toMatchObject({
      notJoinedDays: 13,
      absentDays: 0,
      slipWorkingDays: 14,
      leavesTaken: 4,
      earnedDays: 16,
    });
  });
});

async function joinedMidMonth() {
  const hr = await makeUser({ roleKey: 'hr_admin' });
  const finance = await makeUser({ roleKey: 'finance' });
  // Like the October 2026 slip of an employee who joined on the 14th.
  const staff = await makeUser({
    name: 'Amit',
    joiningDate: '2026-10-14',
    weeklyOffs: [0],
    expectedInTime: '09:30',
  });
  await proposeSalary(hr, staff._id, {
    effectiveFrom: '2026-10-14',
    reason: 'Joining',
    components: { basic: paise(31000) },
  });
  await decideSalary(finance, (await SalaryStructure.findOne({ userId: staff._id }))._id, {
    decision: 'approved',
    note: '',
  });
  await Holiday.create([
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-20', name: 'Dussehra' },
  ]);
  // 14th: on time; 15th: late; 16th: no punch (absent).
  await Attendance.create([
    {
      employeeId: staff.employeeId,
      date: '2026-10-14',
      time: '09:20 AM',
      at: at('2026-10-14', '09:20'),
      status: 'Checked In',
    },
    {
      employeeId: staff.employeeId,
      date: '2026-10-15',
      time: '09:54 AM',
      at: at('2026-10-15', '09:54'),
      status: 'Late',
    },
  ]);
  return { hr, finance, staff };
}

describe('a slip of the month the employee joined', () => {
  it('counts from the joining date: no absence or holiday before it', async () => {
    const { hr, staff } = await joinedMidMonth();
    const slip = await createPayslip(hr, staff._id, '2026-10');
    // 1–13 Oct: not joined (the 2nd's holiday and the 4th's and 11th's Sundays included).
    // 14–31: 18 days = 1 full, 1 half, 1 holiday (20th), 2 Sundays (18th, 25th), 13 absent.
    expect(slip.calculation).toMatchObject({
      notJoinedDays: 13,
      fullDays: 1,
      halfDays: 1,
      holidayDays: 1,
      weeklyOffs: 2,
      absentDays: 13,
      perDayPaise: paise(1000),
      earnedDays: 4.5, // 1 full + 2 Sundays + 1 holiday + ½
    });
    expect(slip.attendance).toMatchObject({
      totalWorkingDays: 2,
      leavesTaken: 3, // 2 weekly offs + 1 holiday
      unpaidDays: 13,
    });
    expect(slip.earnings).toMatchObject({
      basic: paise(4500),
      hdAllowance: paise(500),
      paidLeave: 0,
    });
    expect(slip.deductions.lossOfPay).toBe(0);
    expect(slip.totals.net).toBe(paise(5000));

    // The calendar shows the days before joining as "Not joined".
    const calendar = await getMonthCalendar(hr, staff._id, '2026-10');
    expect(calendar.days.find((day) => day.date === '2026-10-02').status).toBe('Not joined');
    expect(calendar.days.find((day) => day.date === '2026-10-14').status).toBe('Present');
  });
});

describe('deleting a salary slip', () => {
  it('a draft goes to Recently deleted and can be restored; a final slip cannot be deleted', async () => {
    const { hr, finance, staff } = await joinedMidMonth();
    const slip = await createPayslip(hr, staff._id, '2026-10');
    const remove = (user) =>
      call(deleteRoute, { method: 'DELETE', user, params: { id: slip._id } });

    expect((await remove(staff)).status).toBe(403);
    expect((await remove(hr)).status).toBe(200);
    expect(await Payslip.exists({ _id: slip._id })).toBeNull();
    const item = await DeletedItem.findOne({ kind: 'payslip' }).lean();
    expect(item.label).toContain('2026-10');

    // A new slip can be made for the month; restoring the old one is then refused.
    const again = await createPayslip(hr, staff._id, '2026-10');
    await expect(restoreFromTrash(hr, item._id)).rejects.toMatchObject({ status: 409 });
    await Payslip.deleteOne({ _id: again._id });
    await restoreFromTrash(hr, item._id);
    expect(await Payslip.exists({ _id: slip._id })).toBeTruthy();

    await finalisePayslip(finance, slip._id);
    expect((await remove(hr)).status).toBe(409);
  });
});
