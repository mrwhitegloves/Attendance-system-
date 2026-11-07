import { describe, expect, it } from 'vitest';
import { getMonthCalendar } from '@/server/services/attendance.service.js';
import { createPayslip, finalisePayslip } from '@/server/services/payslips.service.js';
import { proposeSalary, decideSalary } from '@/server/services/salary.service.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { Payslip } from '@/server/models/payslip.model.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { AttendanceEdit } from '@/server/models/attendanceEdit.model.js';
import { AuditLog } from '@/server/models/system.models.js';
import { POST as editRoute } from '@/app/api/attendance/edit/[userId]/route.js';
import { at, call, makeUser } from './helpers.js';

const paise = (rupees) => rupees * 100;
// September 2026, all in the past. Sundays are weekly offs. Expected 09:30 → late from 09:36.
const MONTH = '2026-09';

async function setup() {
  const ceo = await makeUser({ roleKey: 'ceo' });
  const hr = await makeUser({ roleKey: 'hr_admin' });
  const finance = await makeUser({ roleKey: 'finance' });
  const staff = await makeUser({
    name: 'Muskan',
    weeklyOffs: [0],
    joiningDate: '2025-01-01',
    expectedInTime: '09:30',
    expectedOutTime: '18:30',
  });
  await proposeSalary(hr, staff._id, {
    effectiveFrom: '2025-01-01',
    reason: 'Joining',
    components: { basic: paise(30000) },
  });
  await decideSalary(finance, (await SalaryStructure.findOne({ userId: staff._id }))._id, {
    decision: 'approved',
    note: '',
  });
  // The 1st: a late punch-in with a photo place, and a punch-out. The 3rd: an "Absent" mark.
  await Attendance.create([
    {
      employeeId: staff.employeeId,
      userId: staff._id,
      date: '2026-09-01',
      time: '10:15 AM',
      at: at('2026-09-01', '10:15'),
      status: 'Late',
      location: 'Office gate',
    },
    {
      employeeId: staff.employeeId,
      userId: staff._id,
      date: '2026-09-01',
      time: '06:30 PM',
      at: at('2026-09-01', '18:30'),
      status: 'Checked Out',
    },
    {
      employeeId: staff.employeeId,
      userId: staff._id,
      date: '2026-09-03',
      time: '11:59 PM',
      status: 'Absent',
      source: 'system',
    },
  ]);
  return { ceo, hr, finance, staff };
}

const edit = (user, staff, body) =>
  call(editRoute, { method: 'POST', user, params: { userId: staff._id }, body });

describe('editing the punch times of a day', () => {
  it('an absent day gets punches, its Absent mark goes everywhere, the draft slip follows', async () => {
    const { hr, staff } = await setup();
    const slip = await createPayslip(hr, staff._id, MONTH);
    const before = await Payslip.findById(slip._id).lean();
    const calendarBefore = await getMonthCalendar(hr, staff._id, MONTH);
    expect(calendarBefore.days.find((day) => day.date === '2026-09-03').status).toBe('Absent');

    const result = await edit(hr, staff, {
      date: '2026-09-03',
      punchInTime: '09:25',
      punchOutTime: '18:40',
      reason: 'Forgot to punch, was in the office',
    });
    expect(result.status).toBe(200);
    expect(result.body.editsThisMonth).toBe(1);

    const rows = await Attendance.find({ employeeId: staff.employeeId, date: '2026-09-03' }).lean();
    expect(rows.map((row) => row.status).sort()).toEqual(['Checked In', 'Checked Out']);
    expect(rows.every((row) => row.source === 'admin')).toBe(true);
    expect(rows.find((row) => row.status === 'Checked In').time).toBe('09:25 AM');

    const calendar = await getMonthCalendar(hr, staff._id, MONTH);
    const day = calendar.days.find((item) => item.date === '2026-09-03');
    expect(day.status).toBe('Present');
    expect(day.minutesWorked).toBe(9 * 60 + 15);
    expect(calendar.totals.absent).toBe(0);
    expect(calendar.canEdit).toBe(true);
    expect(calendar.edits).toHaveLength(1);
    expect(calendar.edits[0]).toMatchObject({
      date: '2026-09-03',
      before: { status: 'Absent', punchIn: '', punchOut: '' },
      after: { status: 'Present', punchIn: '09:25 AM', punchOut: '06:40 PM' },
      reason: 'Forgot to punch, was in the office',
    });

    // The draft slip: one absent day less, one day less of pay cut.
    const after = await Payslip.findById(slip._id).lean();
    expect(after.calculation.absentDays).toBe(before.calculation.absentDays - 1);
    expect(after.deductions.lossOfPay).toBeLessThan(before.deductions.lossOfPay);
    expect(after.totals.net).toBe(after.totals.earnings - after.totals.deductions);

    expect(await AuditLog.exists({ action: 'attendance.edited' })).toBeTruthy();
  });

  it('changes the times of a punched day: late becomes on time, the photo place stays', async () => {
    const { ceo, staff } = await setup();
    const result = await edit(ceo, staff, {
      date: '2026-09-01',
      punchInTime: '09:30',
      punchOutTime: '19:00',
      reason: 'Was at a client site from 9:30',
    });
    expect(result.status).toBe(200);
    const rows = await Attendance.find({ employeeId: staff.employeeId, date: '2026-09-01' }).lean();
    expect(rows).toHaveLength(2);
    const punchIn = rows.find((row) => row.status !== 'Checked Out');
    expect(punchIn).toMatchObject({
      status: 'Checked In',
      time: '09:30 AM',
      location: 'Office gate',
    });
    expect(rows.find((row) => row.status === 'Checked Out').time).toBe('07:00 PM');

    // A second edit of the same month: the count goes up. An empty punch-out removes it.
    const second = await edit(ceo, staff, {
      date: '2026-09-01',
      punchInTime: '09:30',
      punchOutTime: '',
      reason: 'The punch-out was wrong',
    });
    expect(second.body.editsThisMonth).toBe(2);
    expect(
      await Attendance.countDocuments({
        employeeId: staff.employeeId,
        date: '2026-09-01',
        status: 'Checked Out',
      }),
    ).toBe(0);

    // The same times again: nothing to save.
    const same = await edit(ceo, staff, {
      date: '2026-09-01',
      punchInTime: '09:30',
      reason: 'again',
    });
    expect(same.status).toBe(400);
    expect(await AttendanceEdit.countDocuments({ employeeId: staff.employeeId })).toBe(2);
  });

  it('refuses wrong input, leave days, final slips, own attendance and people without the right', async () => {
    const { hr, finance, staff } = await setup();
    const reason = 'Corrected after checking';
    const ok = { date: '2026-09-04', punchInTime: '09:30', reason };
    // No reason, punch-out before punch-in, a future day.
    expect((await edit(hr, staff, { ...ok, reason: '' })).status).toBe(400);
    expect((await edit(hr, staff, { ...ok, punchOutTime: '09:00' })).status).toBe(400);
    expect((await edit(hr, staff, { ...ok, date: '2099-01-01' })).status).toBe(400);
    // Finance and the employee cannot edit; HR cannot edit their own attendance.
    expect((await edit(finance, staff, ok)).status).toBe(403);
    expect((await edit(staff, staff, ok)).status).toBe(403);
    expect((await edit(hr, hr, ok)).status).toBe(403);
    expect((await getMonthCalendar(staff, staff._id, MONTH)).canEdit).toBe(false);
    expect((await getMonthCalendar(staff, staff._id, MONTH)).edits).toEqual([]);

    // A leave day.
    await Attendance.create({
      employeeId: staff.employeeId,
      date: '2026-09-05',
      time: '12:00 AM',
      status: 'Leave',
      paidLeave: true,
    });
    expect((await edit(hr, staff, { ...ok, date: '2026-09-05' })).status).toBe(409);

    // A final slip of that month.
    const slip = await createPayslip(hr, staff._id, MONTH);
    await finalisePayslip(finance, slip._id);
    expect((await edit(hr, staff, ok)).status).toBe(409);
    expect(await AttendanceEdit.countDocuments({})).toBe(0);
  });
});
