import { describe, expect, it } from 'vitest';
import {
  addHoliday,
  addCompOff,
  adjustLeaveBalance,
  getLeaveBalance,
  leaveBalanceOf,
} from '@/server/services/leaveRules.service.js';
import { requestLeave, decideLeave } from '@/server/services/leaves.service.js';
import { buildMonthDays } from '@/server/services/attendance.service.js';
import { calculateMonth } from '@/server/lib/payslipRules.js';
import { createPayslip } from '@/server/services/payslips.service.js';
import { proposeSalary, decideSalary } from '@/server/services/salary.service.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { makeUser } from './helpers.js';

const NOW = new Date('2026-12-05T12:00:00+05:30');

describe('holidays and comp-offs are paid days', () => {
  it('a holiday and a comp-off day cost nothing; the Sunday worked is shown', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await addHoliday(hr, { date: '2026-11-09', name: 'Diwali', kind: 'festival' });
    await Attendance.create({
      employeeId: staff.employeeId,
      date: '2026-11-15',
      time: '10:00 AM',
      status: 'Checked In',
    });
    await addCompOff(hr, staff._id, {
      workedOn: '2026-11-15',
      offOn: '2026-11-16',
      note: 'Stock count',
    });
    const days = await buildMonthDays(staff, '2026-11', NOW);
    const on = (date) => days.find((day) => day.date === date);
    expect(on('2026-11-09')).toMatchObject({ countedAs: 'holiday', holiday: 'Diwali' });
    expect(on('2026-11-15')).toMatchObject({ countedAs: 'sundayWorked', compOffOn: '2026-11-16' });
    expect(on('2026-11-16')).toMatchObject({ countedAs: 'compOff', compOffFor: '2026-11-15' });
    const result = calculateMonth({ days, monthlyGrossPaise: 3000000, calendarDays: 30 });
    expect(result).toMatchObject({ holidayDays: 1, compOffDays: 1, sundaysWorked: 1 });
    // Every other working day of November has no punch: absent. Holiday and comp-off are not.
    expect(result.absentDays).toBe(result.workingDays - 2);
  });

  it('a comp-off needs a Sunday worked and a weekday off, each used once', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await expect(
      addCompOff(hr, staff._id, { workedOn: '2026-11-16', offOn: '2026-11-17' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      addCompOff(hr, staff._id, { workedOn: '2026-11-15', offOn: '2026-11-22' }),
    ).rejects.toMatchObject({ status: 400 });
    await addCompOff(hr, staff._id, { workedOn: '2026-11-15', offOn: '2026-11-17' });
    await expect(
      addCompOff(hr, staff._id, { workedOn: '2026-11-22', offOn: '2026-11-17' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('only people who decide leave record comp-offs', async () => {
    const staff = await makeUser();
    await expect(
      addCompOff(staff, staff._id, { workedOn: '2026-11-15', offOn: '2026-11-17' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('paid leave balance', () => {
  it('HR gives days; an approved paid leave is taken from it for the chosen month, once', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await adjustLeaveBalance(hr, staff._id, {
      days: 2,
      month: '2026-11',
      reason: 'Two paid leaves this year',
    });
    const leave = await requestLeave(staff, {
      startDate: '2026-11-13',
      endDate: '2026-11-16',
      reason: 'Trip home',
    });
    // 13 (Fri), 14 (Sat), 15 (Sun), 16 (Mon): 3 working days.
    await decideLeave(hr, leave._id, {
      decision: 'approved',
      note: '',
      paid: true,
      useBalance: true,
      balanceMonth: '2026-11',
    });
    expect(await leaveBalanceOf(staff._id)).toBe(-1);
    expect(await leaveBalanceOf(staff._id, '2026-10')).toBe(0);
    const view = await getLeaveBalance(staff, staff._id);
    expect(view.entries.map((entry) => entry.days).sort()).toEqual([-3, 2]);
  });

  it('only HR and the CEO change the balance', async () => {
    const manager = await makeUser({ roleKey: 'manager' });
    const staff = await makeUser({ managerId: manager._id });
    await expect(
      adjustLeaveBalance(manager, staff._id, { days: 1, month: '2026-11', reason: 'x' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('the slip shows the balance at the end of its month', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const finance = await makeUser({ roleKey: 'finance' });
    const staff = await makeUser();
    await proposeSalary(hr, staff._id, {
      effectiveFrom: '2026-01-01',
      reason: 'Joining',
      components: { basic: 2700000 },
    });
    await decideSalary(finance, (await SalaryStructure.findOne({ userId: staff._id }))._id, {
      decision: 'approved',
      note: '',
    });
    await adjustLeaveBalance(hr, staff._id, {
      days: 3,
      month: '2026-09',
      reason: 'Yearly paid leave',
    });
    await adjustLeaveBalance(hr, staff._id, { days: 2, month: '2026-12', reason: 'Later' });
    const slip = await createPayslip(hr, staff._id, '2026-09');
    expect(slip.attendance.balanceLeaves).toBe(3);
  });
});
