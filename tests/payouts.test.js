import { describe, expect, it } from 'vitest';
import { GET as listRoute } from '@/app/api/payouts/route.js';
import { POST as approveRoute } from '@/app/api/payouts/approve/route.js';
import { POST as paidRoute } from '@/app/api/payslips/[id]/paid/route.js';
import { GET as bankFileRoute } from '@/app/api/payouts/bank-file/route.js';
import { Payslip } from '@/server/models/payslip.model.js';
import { Kyc } from '@/server/models/kyc.model.js';
import { EmployeeRequest } from '@/server/models/request.model.js';
import { seal } from '@/server/lib/secretBox.js';
import { SESSION_COOKIE, createSession } from '@/server/auth/session.js';
import {
  createPayslip,
  finalisePayslip,
  reopenPayslip,
} from '@/server/services/payslips.service.js';
import { call, makeUser } from './helpers.js';

async function finalSlip(person, month, net) {
  const created = await Payslip.create({
    userId: person._id,
    employeeId: person.employeeId,
    month,
    status: 'final',
    employee: { name: person.name, code: person.employeeId },
    totals: { earnings: net, deductions: 0, net },
    preparedBy: person._id,
  });
  return String(created._id);
}

async function setup() {
  const ceo = await makeUser({ roleKey: 'ceo', name: 'Asha CEO' });
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  const staff = await makeUser({ name: 'Sunil Field' });
  const other = await makeUser({ name: 'Pooja Staff' });
  const sunilSep = await finalSlip(staff, '2026-09', 2340000);
  const poojaSep = await finalSlip(other, '2026-09', 1800000);
  return { ceo, hr, staff, other, sunilSep, poojaSep };
}

const approve = (user, ids) => call(approveRoute, { method: 'POST', user, body: { ids } });
const pay = (user, id, body) => call(paidRoute, { method: 'POST', user, params: { id }, body });

describe('salary payouts', () => {
  it('only the CEO approves; HR records the payment with a reference', async () => {
    const { ceo, hr, sunilSep, poojaSep } = await setup();
    expect((await approve(hr, [sunilSep])).status).toBe(403);
    expect(
      (await pay(hr, sunilSep, { paidOn: '2026-10-08', mode: 'upi', reference: 'UPI123' })).status,
    ).toBe(409);

    const approved = await approve(ceo, [sunilSep, poojaSep]);
    expect(approved.body).toMatchObject({ approved: 2, total: 4140000 });

    const noReference = await pay(hr, sunilSep, { paidOn: '2026-10-08', mode: 'bank_transfer' });
    expect(noReference.status).toBe(400);
    const future = await pay(hr, sunilSep, { paidOn: '2099-01-01', mode: 'upi', reference: 'X' });
    expect(future.status).toBe(400);
    const paid = await pay(hr, sunilSep, {
      paidOn: '2026-10-08',
      mode: 'bank_transfer',
      reference: 'UTR998877',
    });
    expect(paid.body.payout).toMatchObject({
      status: 'paid',
      paidByName: 'Ravi HR',
      reference: 'UTR998877',
    });
    expect(
      (await pay(hr, sunilSep, { paidOn: '2026-10-08', mode: 'upi', reference: 'again' })).status,
    ).toBe(409);
  });

  it('the CEO never approves their own salary', async () => {
    const { ceo } = await setup();
    const own = await finalSlip(ceo, '2026-09', 5000000);
    expect((await approve(ceo, [own])).status).toBe(403);
  });

  it('shows how much was paid inside a date range, and what is still to pay', async () => {
    const { ceo, hr, sunilSep, poojaSep } = await setup();
    await approve(ceo, [sunilSep, poojaSep]);
    await pay(hr, sunilSep, { paidOn: '2026-10-08', mode: 'cash', note: 'Given by Ravi' });
    const october = await call(listRoute, {
      user: hr,
      url: '/api/payouts?range=custom&from=2026-10-01&to=2026-10-31',
    });
    expect(october.body.totals.paid).toEqual({ count: 1, net: 2340000 });
    expect(october.body.totals.approved).toEqual({ count: 1, net: 1800000 });
    expect(october.body.byMonth).toEqual([{ _id: '2026-09', count: 1, net: 2340000 }]);
    const november = await call(listRoute, {
      user: hr,
      url: '/api/payouts?range=custom&from=2026-11-01&to=2026-11-30',
    });
    expect(november.body.totals.paid).toEqual({ count: 0, net: 0 });
    const staff = await makeUser();
    expect((await call(listRoute, { user: staff })).status).toBe(403);
  });

  it('the bank file lists approved salaries with the full account number', async () => {
    const { ceo, hr, staff, sunilSep } = await setup();
    await Kyc.create({
      userId: staff._id,
      employeeId: staff.employeeId,
      bank: {
        accountHolderName: 'SUNIL KUMAR',
        bankName: 'SBI',
        ifsc: 'SBIN0001234',
        accountSealed: seal('123456789012'),
        accountLast4: '9012',
      },
    });
    await approve(ceo, [sunilSep]);
    const cookie = `${SESSION_COOKIE}=${await createSession(hr._id)}`;
    const response = await bankFileRoute(
      new Request('http://localhost/api/payouts/bank-file?month=2026-09', { headers: { cookie } }),
      { params: Promise.resolve({}) },
    );
    const text = await response.text();
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(text).toContain('SUNIL KUMAR,123456789012,SBIN0001234,SBI,23400.00,Salary 2026-09');
  });

  it('a paid slip cannot be re-opened; an approved one goes back to waiting', async () => {
    const { ceo, hr, sunilSep, poojaSep } = await setup();
    await approve(ceo, [sunilSep, poojaSep]);
    await pay(hr, sunilSep, { paidOn: '2026-10-08', mode: 'upi', reference: 'UPI1' });
    await expect(reopenPayslip(ceo, sunilSep, { reason: 'Wrong' })).rejects.toMatchObject({
      status: 409,
    });
    await reopenPayslip(ceo, poojaSep, { reason: 'Fix incentive' });
    const slip = await Payslip.findById(poojaSep).lean();
    expect(slip).toMatchObject({
      status: 'draft',
      payout: { status: 'unpaid', approvedByName: '' },
    });
  });
});

describe('reimbursements with the salary', () => {
  it('approved expense claims fill the reimbursement line once', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const ceo = await makeUser({ roleKey: 'ceo' });
    const staff = await makeUser();
    const claim = await EmployeeRequest.create({
      number: 'REQ-0001',
      kind: 'expense',
      userId: staff._id,
      employeeId: staff.employeeId,
      employeeName: staff.name,
      subject: 'Fuel',
      amountPaise: 120000,
      approvedAmountPaise: 100000,
      status: 'approved',
      decidedAt: new Date('2026-09-20T10:00:00+05:30'),
    });
    const slip = await createPayslip(hr, staff._id, '2026-09');
    expect(slip.earnings.reimbursement).toBe(100000);
    await finalisePayslip(ceo, slip._id);
    expect(String((await EmployeeRequest.findById(claim._id).lean()).payslipId)).toBe(
      String(slip._id),
    );
    // The next month's slip does not pay it again.
    const october = await createPayslip(hr, staff._id, '2026-10');
    expect(october.earnings.reimbursement).toBe(0);
  });
});
