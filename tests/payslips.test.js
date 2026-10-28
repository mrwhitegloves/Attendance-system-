import { describe, expect, it } from 'vitest';
import { amountInWords, numberInWords } from '@/server/lib/amountInWords.js';
import {
  createPayslip,
  updatePayslip,
  finalisePayslip,
  reopenPayslip,
  getPayslip,
  listPayslips,
} from '@/server/services/payslips.service.js';
import { proposeSalary, decideSalary } from '@/server/services/salary.service.js';
import { updateKycItem } from '@/server/services/kyc.service.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { Payslip } from '@/server/models/payslip.model.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { AuditLog } from '@/server/models/system.models.js';
import { GET as slipRoute } from '@/app/api/payslips/[id]/route.js';
import { call, makeUser } from './helpers.js';

const paise = (rupees) => rupees * 100;

describe('amount in words', () => {
  it('writes amounts the Indian way, like the MWG slip', () => {
    expect(amountInWords(paise(27000))).toBe('Rupees Twenty-Seven Thousand Only');
    expect(amountInWords(paise(1234567) + 50)).toBe(
      'Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paise Only',
    );
    expect(numberInWords(10000000)).toBe('One Crore');
    expect(amountInWords(0)).toBe('Rupees Zero Only');
  });
});

async function setup() {
  const hr = await makeUser({ roleKey: 'hr_admin' });
  const finance = await makeUser({ roleKey: 'finance' });
  const staff = await makeUser({
    name: 'Vivek Pradhan',
    employeeCode: 'MWG-FSD-25-001',
    designation: 'Full Stack Developer',
    joiningDate: '2025-08-12',
  });
  await proposeSalary(hr, staff._id, {
    effectiveFrom: '2025-08-12',
    reason: 'Joining',
    components: { basic: paise(27000) },
  });
  await decideSalary(finance, (await SalaryStructure.findOne({ userId: staff._id }))._id, {
    decision: 'approved',
    note: '',
  });
  await updateKycItem(hr, staff._id, 'pan', { number: 'GSXPP9354P', nameOnPan: 'Vivek Pradhan' });
  await updateKycItem(hr, staff._id, 'bank', {
    accountHolderName: 'Vivek Pradhan',
    bankName: 'State Bank of India',
    ifsc: 'SBIN0001234',
    accountNumber: '11091926261',
  });
  return { hr, finance, staff };
}

describe('salary slips', () => {
  it('starts from the employee file, KYC, salary and attendance', async () => {
    const { hr, staff } = await setup();
    await Attendance.create([
      { employeeId: staff.employeeId, date: '2026-09-01', time: '09:20 AM', status: 'Checked In' },
      { employeeId: staff.employeeId, date: '2026-09-02', time: '09:45 AM', status: 'Late' },
      { employeeId: staff.employeeId, date: '2026-09-03', time: '09:00 AM', status: 'Leave' },
    ]);
    const slip = await createPayslip(hr, staff._id, '2026-09');
    expect(slip.employee).toMatchObject({
      name: 'Vivek Pradhan',
      code: 'MWG-FSD-25-001',
      designation: 'Full Stack Developer',
      bankName: 'State Bank of India',
      panLast4: '354P',
      accountLast4: '6261',
    });
    // September 2026: 30 days, 4 Sundays (the default weekly off) → 26 working days. 1 full, 1 half (free), 1 leave
    // (not marked: counted as paid); the other 23 working days have no punch → absent.
    expect(slip.attendance).toMatchObject({
      totalWorkingDays: 26,
      fullDays: 1,
      halfDays: 1,
      leavesTaken: 1,
    });
    expect(slip.calculation).toMatchObject({
      absentDays: 23,
      perDayPaise: paise(900),
      lossOfPayDays: 23,
    });
    expect(slip.earnings.basic).toBe(paise(27000));
    expect(slip.deductions.lossOfPay).toBe(paise(23 * 900));
    expect(slip.totals.net).toBe(paise(27000 - 23 * 900));
    expect(slip.netInWords).toBe('Rupees Six Thousand Three Hundred Only');
    await expect(createPayslip(hr, staff._id, '2026-09')).rejects.toMatchObject({ code: 'exists' });
  });

  it('every field can be changed on a draft; totals follow', async () => {
    const { hr, staff } = await setup();
    const slip = await createPayslip(hr, staff._id, '2026-09');
    const view = await updatePayslip(hr, slip._id, {
      employee: { designation: 'Senior Developer', pan: 'ABCDE1234F' },
      attendance: { halfDays: 1, balanceLeaves: 0 },
      earnings: { incentive: paise(2000) },
      // Loss of pay set to 0 by hand: any filled-in value can be overridden.
      deductions: { penalty: paise(500), lossOfPay: 0 },
    });
    expect(view.employee).toMatchObject({ designation: 'Senior Developer', pan: '******234F' });
    expect(view.totals).toEqual({
      earnings: paise(29000),
      deductions: paise(500),
      net: paise(28500),
    });
    expect(view.netInWords).toBe('Rupees Twenty-Eight Thousand Five Hundred Only');
  });

  it('the last person who changed it cannot make it final; a final slip is locked', async () => {
    const { hr, finance, staff } = await setup();
    const slip = await createPayslip(finance, staff._id, '2026-09');
    await expect(finalisePayslip(finance, slip._id)).rejects.toMatchObject({ status: 403 });
    await expect(finalisePayslip(hr, slip._id)).rejects.toMatchObject({ status: 403 });
    const ceo = await makeUser({ roleKey: 'ceo' });
    await finalisePayslip(ceo, slip._id);
    await expect(updatePayslip(hr, slip._id, { notes: 'x' })).rejects.toMatchObject({
      status: 409,
    });
    expect((await Payslip.findById(slip._id).lean()).company).toBeTruthy();
    await reopenPayslip(ceo, slip._id, { reason: 'Incentive was missing' });
    expect((await Payslip.findById(slip._id).lean()).status).toBe('draft');
    expect(await AuditLog.countDocuments({ action: 'payslip.reopened' })).toBe(1);
  });

  it('employees see only their own final slips, with their full PAN', async () => {
    const { hr, finance, staff } = await setup();
    const other = await makeUser();
    const slip = await createPayslip(hr, staff._id, '2026-09');
    expect((await call(slipRoute, { user: staff, params: { id: String(slip._id) } })).status).toBe(
      404,
    );
    await finalisePayslip(finance, slip._id);
    expect((await call(slipRoute, { user: other, params: { id: String(slip._id) } })).status).toBe(
      404,
    );
    const own = await getPayslip(staff, slip._id, { full: true });
    expect(own.employee).toMatchObject({ pan: 'GSXPP9354P', account: '11091926261' });
    const masked = await getPayslip(staff, slip._id);
    expect(masked.employee.pan).toBe('******354P');
    expect((await listPayslips(staff, { page: 1 })).items).toHaveLength(1);
    expect(JSON.stringify(masked)).not.toContain('Sealed');
  });
});
