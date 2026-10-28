import { describe, expect, it } from 'vitest';
import { GET as reportRoute } from '@/app/api/reports/[report]/route.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { Payslip } from '@/server/models/payslip.model.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { reportsFor } from '@/server/services/reports.service.js';
import { SESSION_COOKIE, createSession } from '@/server/auth/session.js';
import { at, makeUser } from './helpers.js';

async function download(user, report, query = '') {
  const cookie = `${SESSION_COOKIE}=${await createSession(user._id)}`;
  const response = await reportRoute(
    new Request(`http://localhost/api/reports/${report}${query}`, { headers: { cookie } }),
    { params: Promise.resolve({ report }) },
  );
  return { status: response.status, text: response.status === 200 ? await response.text() : '' };
}

describe('reports', () => {
  it('HR sees every report except the audit log; an employee sees none', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    expect(reportsFor(hr).map((report) => report.key)).toEqual([
      'payroll',
      'cost',
      'attendance',
      'leave',
      'files',
      'hiring',
      'exits',
      'expenses',
    ]);
    expect(reportsFor(staff)).toEqual([]);
    expect((await download(staff, 'files')).status).toBe(403);
    expect((await download(hr, 'audit')).status).toBe(403);
  });

  it('the salary register of a month and the cost by department', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser({ name: 'Sunil Field', department: 'Operations' });
    await Payslip.create({
      userId: staff._id,
      employeeId: staff.employeeId,
      month: '2026-09',
      status: 'final',
      employee: { name: 'Sunil Field', code: staff.employeeId, department: 'Operations' },
      earnings: { basic: 2700000 },
      deductions: { lossOfPay: 360000 },
      totals: { earnings: 2700000, deductions: 360000, net: 2340000 },
      payout: { status: 'paid', paidOn: '2026-10-08' },
      preparedBy: hr._id,
    });
    await SalaryStructure.create({
      userId: staff._id,
      employeeId: staff.employeeId,
      version: 1,
      effectiveFrom: '2026-01-01',
      status: 'approved',
      components: { basic: 2700000 },
      totals: { monthlyGross: 2700000 },
      preparedBy: hr._id,
    });
    const payroll = await download(hr, 'payroll', '?month=2026-09');
    expect(payroll.text).toContain('Sunil Field');
    expect(payroll.text).toContain('23400.00,final,paid,2026-10-08');
    const cost = await download(hr, 'cost');
    // HR is in Operations too (test default) and has no salary: 2 people, 1 with a salary.
    expect(cost.text).toContain('Operations,2,1,27000.00,324000.00');
    expect((await download(hr, 'payroll')).status).toBe(400);
  });

  it('the attendance summary counts the chosen days only, with overtime', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser({
      name: 'Pooja Staff',
      expectedInTime: '10:00',
      expectedOutTime: '19:00',
    });
    const punch = (date, clock, status) =>
      Attendance.create({
        employeeId: staff.employeeId,
        userId: staff._id,
        userName: staff.name,
        date,
        time: clock,
        at: at(date, clock),
        status,
      });
    await punch('2026-10-05', '10:00', 'Checked In');
    await punch('2026-10-05', '20:00', 'Checked Out');
    await punch('2026-10-06', '10:20', 'Late');
    await punch('2026-09-30', '10:00', 'Checked In');
    const report = await download(hr, 'attendance', '?range=custom&from=2026-10-01&to=2026-10-31');
    expect(report.text).toContain(`${staff.employeeId},Pooja Staff,Operations,2,1,0,1.00`);
  });
});
