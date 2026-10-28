import { describe, expect, it } from 'vitest';
import { POST as startExitRoute } from '@/app/api/users/[id]/exits/route.js';
import {
  GET as getRoute,
  POST as prepareRoute,
  PUT as saveRoute,
} from '@/app/api/users/[id]/settlement/route.js';
import { POST as approveRoute } from '@/app/api/users/[id]/settlement/approve/route.js';
import { POST as paidRoute } from '@/app/api/users/[id]/settlement/paid/route.js';
import { GET as pdfRoute } from '@/app/api/users/[id]/settlement/pdf/route.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { LeaveBalanceEntry } from '@/server/models/leaveRules.model.js';
import { SESSION_COOKIE, createSession } from '@/server/auth/session.js';
import { call, makeUser } from './helpers.js';

async function setup({ noticeDate = '2026-11-01', lastWorkingDay = '2026-11-20' } = {}) {
  const ceo = await makeUser({ roleKey: 'ceo', name: 'Asha CEO' });
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  const staff = await makeUser({ name: 'Sunil Field', joiningDate: '2026-01-05' });
  const id = String(staff._id);
  // ₹30,000 a month in force; 2 days of paid leave left.
  await SalaryStructure.create({
    userId: staff._id,
    employeeId: staff.employeeId,
    version: 1,
    effectiveFrom: '2026-01-01',
    status: 'approved',
    components: { basic: 3000000 },
    totals: { monthlyGross: 3000000 },
    preparedBy: hr._id,
  });
  await LeaveBalanceEntry.create({
    userId: staff._id,
    employeeId: staff.employeeId,
    days: 2,
    month: '2026-01',
    reason: 'Paid leave 2026',
    createdBy: hr._id,
  });
  await call(startExitRoute, {
    method: 'POST',
    user: hr,
    params: { id },
    body: { type: 'resignation', noticeDate, lastWorkingDay },
  });
  return { ceo, hr, staff, id };
}

describe('full and final settlement', () => {
  it('suggests unpaid leave and the notice not served, from one day of salary', async () => {
    const { hr, id } = await setup();
    const prepared = await call(prepareRoute, {
      method: 'POST',
      user: hr,
      params: { id },
      body: { noticeDays: 30 },
    });
    const settlement = prepared.body.settlement;
    // November has 30 days: one day = ₹1,000. Served 1–20 Nov = 20 of 30 days → 10 short.
    expect(settlement.basis).toMatchObject({
      perDayPaise: 100000,
      leaveBalance: 2,
      servedDays: 20,
      shortDays: 10,
    });
    expect(settlement.lines.map((line) => [line.kind, line.amountPaise])).toEqual([
      ['add', 200000],
      ['deduct', 1000000],
    ]);
    expect(settlement.totals.net).toBe(-800000);
  });

  it('HR changes the lines; the CEO approves; it cannot change after that; then it is settled', async () => {
    const { ceo, hr, id } = await setup();
    await call(prepareRoute, { method: 'POST', user: hr, params: { id }, body: {} });
    const saved = await call(saveRoute, {
      method: 'PUT',
      user: hr,
      params: { id },
      body: {
        lines: [
          { kind: 'add', label: 'Paid leave not taken (2 days)', amount: 2000 },
          { kind: 'add', label: 'October incentive', amount: 5000 },
        ],
      },
    });
    expect(saved.body.settlement.totals).toEqual({ add: 700000, deduct: 0, net: 700000 });
    expect((await call(approveRoute, { method: 'POST', user: hr, params: { id } })).status).toBe(
      403,
    );
    const approved = await call(approveRoute, { method: 'POST', user: ceo, params: { id } });
    expect(approved.body.settlement).toMatchObject({
      status: 'approved',
      approvedByName: 'Asha CEO',
    });
    const late = await call(saveRoute, {
      method: 'PUT',
      user: hr,
      params: { id },
      body: { lines: [] },
    });
    expect(late.status).toBe(409);

    const noReference = await call(paidRoute, {
      method: 'POST',
      user: hr,
      params: { id },
      body: { paidOn: '2026-10-28', mode: 'upi' },
    });
    expect(noReference.status).toBe(400);
    const paid = await call(paidRoute, {
      method: 'POST',
      user: hr,
      params: { id },
      body: { paidOn: '2026-10-28', mode: 'upi', reference: 'UPI55' },
    });
    expect(paid.body.settlement).toMatchObject({
      status: 'paid',
      reference: 'UPI55',
      paidByName: 'Ravi HR',
    });
  });

  it('nothing to pay or take back: approval settles it', async () => {
    const { ceo, hr, id } = await setup({ noticeDate: '2026-10-01', lastWorkingDay: '2026-10-31' });
    await call(prepareRoute, { method: 'POST', user: hr, params: { id }, body: {} });
    await call(saveRoute, { method: 'PUT', user: hr, params: { id }, body: { lines: [] } });
    const approved = await call(approveRoute, { method: 'POST', user: ceo, params: { id } });
    expect(approved.body.settlement.status).toBe('paid');
  });

  it('makes the statement PDF; other employees cannot see it', async () => {
    const { hr, id } = await setup();
    await call(prepareRoute, { method: 'POST', user: hr, params: { id }, body: {} });
    const cookie = `${SESSION_COOKIE}=${await createSession(hr._id)}`;
    const response = await pdfRoute(
      new Request(`http://localhost/api/users/${id}/settlement/pdf`, { headers: { cookie } }),
      {
        params: Promise.resolve({ id }),
      },
    );
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(
      Buffer.from(await response.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
    const other = await makeUser();
    expect((await call(getRoute, { user: other, params: { id } })).status).toBe(403);
  });
});
