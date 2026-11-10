import { describe, expect, it } from 'vitest';
import { createPayslip, finalisePayslip } from '@/server/services/payslips.service.js';
import { proposeSalary, decideSalary } from '@/server/services/salary.service.js';
import { leaveBalanceOf } from '@/server/services/leaveRules.service.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { Payslip } from '@/server/models/payslip.model.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { LeaveRequest } from '@/server/models/leaveRequest.model.js';
import { LeaveBalanceEntry } from '@/server/models/leaveRules.model.js';
import { POST as slipAction } from '@/app/api/payslips/[id]/[action]/route.js';
import { call, makeUser } from './helpers.js';

const paise = (rupees) => rupees * 100;
// September 2026: 30 days, Sundays are 6, 13, 20, 27 (weekly off). No punches: every working day
// is absent at first. 1 Sep 2026 is a Tuesday.
const MONTH = '2026-09';

async function setup() {
  const hr = await makeUser({ roleKey: 'hr_admin' });
  const finance = await makeUser({ roleKey: 'finance' });
  const staff = await makeUser({ name: 'Riya', weeklyOffs: [0], joiningDate: '2025-01-01' });
  await proposeSalary(hr, staff._id, {
    effectiveFrom: '2025-01-01',
    reason: 'Joining',
    components: { basic: paise(30000) },
  });
  await decideSalary(finance, (await SalaryStructure.findOne({ userId: staff._id }))._id, {
    decision: 'approved',
    note: '',
  });
  // Punches on the 1st and 2nd; the 3rd is absent.
  for (const date of ['2026-09-01', '2026-09-02']) {
    await Attendance.create({
      employeeId: staff.employeeId,
      date,
      time: '09:20 AM',
      status: 'Checked In',
    });
  }
  await LeaveBalanceEntry.create({
    userId: staff._id,
    employeeId: staff.employeeId,
    days: 2,
    month: '2026-08',
    reason: 'Opening balance',
    createdBy: hr._id,
  });
  const slip = await createPayslip(hr, staff._id, MONTH);
  return { hr, finance, staff, slip };
}

const markLeave = (user, slip, body) =>
  call(slipAction, { method: 'POST', user, params: { id: slip._id, action: 'mark-leave' }, body });

describe('marking an absent day of a salary slip as leave', () => {
  it('paid leave: the day is no longer absent, the pay cut drops, the balance goes down', async () => {
    const { hr, staff, slip } = await setup();
    const before = await Payslip.findById(slip._id).lean();
    // Typed by hand: must stay.
    await Payslip.updateOne({ _id: slip._id }, { $set: { 'earnings.incentive': paise(500) } });

    const result = await markLeave(hr, slip, {
      date: '2026-09-03',
      paid: true,
      useBalance: true,
      reason: 'Sick, told the manager by phone',
    });
    expect(result.status).toBe(200);

    const after = await Payslip.findById(slip._id).lean();
    expect(after.calculation.absentDays).toBe(before.calculation.absentDays - 1);
    expect(after.calculation.paidLeaveDays).toBe(before.calculation.paidLeaveDays + 1);
    expect(after.calculation.lossOfPayDays).toBe(before.calculation.lossOfPayDays - 1);
    // Earnings by paid days (founder, 2026-11-10): the day is paid under "Paid Leave"; no loss
    // of pay is subtracted.
    expect(after.earnings.paidLeave).toBe(
      before.earnings.paidLeave + before.calculation.perDayPaise,
    );
    expect(after.deductions.lossOfPay).toBe(
      before.deductions.lossOfPay - before.calculation.perDayPaise,
    );
    expect(after.totals.net).toBe(before.totals.net + before.calculation.perDayPaise + paise(500));
    expect(after.earnings.incentive).toBe(paise(500));
    // Loss of Pay is shown, not subtracted again (founder, 2026-11-10).
    expect(after.totals.net).toBe(
      after.totals.earnings - after.totals.deductions + after.deductions.lossOfPay,
    );
    expect(String(after.lastEditedBy)).toBe(String(hr._id));

    const leave = await LeaveRequest.findOne({ employeeId: staff.employeeId }).lean();
    expect(leave).toMatchObject({
      status: 'approved',
      paid: true,
      startDate: '2026-09-03',
      endDate: '2026-09-03',
    });
    const day = await Attendance.findOne({
      employeeId: staff.employeeId,
      date: '2026-09-03',
    }).lean();
    expect(day).toMatchObject({ status: 'Leave', paidLeave: true });
    expect(await leaveBalanceOf(staff._id)).toBe(1);

    // The day is leave now: marking it again is refused.
    const again = await markLeave(hr, slip, { date: '2026-09-03', paid: true, reason: 'twice' });
    expect(again.status).toBe(409);
  });

  it('unpaid leave: counted as unpaid leave, the pay cut stays, the balance is untouched', async () => {
    const { hr, staff, slip } = await setup();
    const before = await Payslip.findById(slip._id).lean();
    const result = await markLeave(hr, slip, {
      date: '2026-09-04',
      paid: false,
      useBalance: true,
      reason: 'Family function',
    });
    expect(result.status).toBe(200);
    const after = await Payslip.findById(slip._id).lean();
    expect(after.calculation.absentDays).toBe(before.calculation.absentDays - 1);
    expect(after.calculation.unpaidLeaveDays).toBe(before.calculation.unpaidLeaveDays + 1);
    expect(after.calculation.lossOfPayDays).toBe(before.calculation.lossOfPayDays);
    expect(await leaveBalanceOf(staff._id)).toBe(2);
  });

  it('only absent days of the month, only on a draft slip, only by people who prepare slips', async () => {
    const { hr, finance, staff, slip } = await setup();
    const reason = 'Was on leave';
    // A worked day, a weekly off, another month.
    expect((await markLeave(hr, slip, { date: '2026-09-01', paid: true, reason })).status).toBe(
      409,
    );
    expect((await markLeave(hr, slip, { date: '2026-09-06', paid: true, reason })).status).toBe(
      409,
    );
    expect((await markLeave(hr, slip, { date: '2026-10-05', paid: true, reason })).status).toBe(
      400,
    );
    expect((await markLeave(hr, slip, { date: '2026-09-03', paid: true, reason: '' })).status).toBe(
      400,
    );
    // An employee does not prepare slips: refused.
    expect((await markLeave(staff, slip, { date: '2026-09-03', paid: true, reason })).status).toBe(
      403,
    );

    await finalisePayslip(finance, slip._id);
    expect((await markLeave(hr, slip, { date: '2026-09-03', paid: true, reason })).status).toBe(
      409,
    );
  });
});
