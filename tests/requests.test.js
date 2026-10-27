import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/infra/storage.js', () => ({
  isStorageConfigured: () => true,
  putFile: async (key) => key,
  signedUrl: async (key) => `https://signed.example/${key}`,
}));

import { GET as listRoute, POST as createRoute } from '@/app/api/requests/route.js';
import { GET as getRoute } from '@/app/api/requests/[id]/route.js';
import { POST as decideRoute } from '@/app/api/requests/[id]/decide/route.js';
import { POST as cancelRoute } from '@/app/api/requests/[id]/cancel/route.js';
import { AuditLog } from '@/server/models/system.models.js';
import { getControlCenter } from '@/server/services/dashboard.service.js';
import { call, makeUser } from './helpers.js';

const PDF = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 bill').toString('base64')}`;

const send = (user, body) => call(createRoute, { method: 'POST', user, body });
const decide = (user, id, body) =>
  call(decideRoute, { method: 'POST', user, params: { id }, body });
const list = (user, query) =>
  call(listRoute, { user, url: `/api/requests?${new URLSearchParams(query)}` });

async function people() {
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  const manager = await makeUser({ roleKey: 'manager', name: 'Meena Manager' });
  const staff = await makeUser({ name: 'Sunil Field', managerId: manager._id });
  return { hr, manager, staff };
}

describe('sending a request', () => {
  it('stores an expense claim in paise with its bill and a number', async () => {
    const { staff } = await people();
    const result = await send(staff, {
      kind: 'expense',
      subject: 'Cab to client site',
      category: 'travel',
      amount: 450.5,
      date: '2026-10-20',
      file: PDF,
      fileName: 'bill.pdf',
    });
    expect(result.status).toBe(200);
    const request = result.body.request;
    expect(request).toMatchObject({ amountPaise: 45050, status: 'pending', kind: 'expense' });
    expect(request.number).toMatch(/^REQ-\d{4}$/);
    expect(request.attachments[0].url).toContain('https://signed.example/requests/');
    expect(request.attachments[0].key).toBeUndefined();
    expect(request.canCancel).toBe(true);
  });

  it('needs the amount for money and the details for an advance', async () => {
    const { staff } = await people();
    const noAmount = await send(staff, { kind: 'advance', subject: 'Advance', details: 'Rent' });
    const noDetails = await send(staff, { kind: 'advance', subject: 'Advance', amount: 5000 });
    expect(noAmount.status).toBe(400);
    expect(noDetails.status).toBe(400);
  });
});

describe('deciding', () => {
  it('HR may approve less than asked; the employee sees the decision', async () => {
    const { hr, staff } = await people();
    const created = (
      await send(staff, { kind: 'advance', subject: 'Advance', amount: 10000, details: 'Rent' })
    ).body.request;
    const tooMuch = await decide(hr, created._id, { decision: 'approved', approvedAmount: 12000 });
    expect(tooMuch.status).toBe(400);
    const approved = await decide(hr, created._id, { decision: 'approved', approvedAmount: 8000 });
    expect(approved.status).toBe(200);
    expect(approved.body.request).toMatchObject({
      status: 'approved',
      approvedAmountPaise: 800000,
      decidedByName: 'Ravi HR',
    });
    const seen = await call(getRoute, { user: staff, params: { id: created._id } });
    expect(seen.body.request.status).toBe('approved');
    const again = await decide(hr, created._id, { decision: 'rejected', note: 'No' });
    expect(again.status).toBe(409);
  });

  it('a rejection needs a note, and nobody decides their own request', async () => {
    const { hr } = await people();
    const ceo = await makeUser({ roleKey: 'ceo' });
    const own = (
      await send(hr, {
        kind: 'document',
        subject: 'Salary certificate',
        category: 'salary_certificate',
      })
    ).body.request;
    expect((await decide(hr, own._id, { decision: 'approved' })).status).toBe(403);
    expect((await decide(ceo, own._id, { decision: 'rejected' })).status).toBe(400);
    const done = await decide(ceo, own._id, { decision: 'approved', note: 'Sent by mail' });
    expect(done.status).toBe(200);
  });

  it('an employee cannot decide or open another person’s request', async () => {
    const { staff } = await people();
    const other = await makeUser();
    const created = (
      await send(staff, { kind: 'document', subject: 'Letter', category: 'experience_letter' })
    ).body.request;
    expect((await decide(other, created._id, { decision: 'approved' })).status).toBe(403);
    expect((await call(getRoute, { user: other, params: { id: created._id } })).status).toBe(404);
  });
});

describe('who sees what', () => {
  it('a manager sees the team’s requests but never a grievance, and cannot decide by default', async () => {
    const { manager, staff, hr } = await people();
    const expense = (
      await send(staff, {
        kind: 'expense',
        subject: 'Fuel',
        category: 'fuel',
        amount: 300,
        date: '2026-10-21',
      })
    ).body.request;
    const grievance = (
      await send(staff, {
        kind: 'grievance',
        subject: 'Unfair shift',
        category: 'manager',
        details: 'My manager…',
      })
    ).body.request;

    const team = await list(manager, { box: 'all' });
    expect(team.body.items.map((item) => item.number)).toEqual([expense.number]);
    expect((await call(getRoute, { user: manager, params: { id: grievance._id } })).status).toBe(
      404,
    );
    expect((await list(manager, { box: 'decide' })).status).toBe(403);

    const toDecide = await list(hr, { box: 'decide' });
    expect(toDecide.body.items.map((item) => item.number).sort()).toEqual(
      [expense.number, grievance.number].sort(),
    );
    const resolved = await decide(hr, grievance._id, {
      decision: 'approved',
      note: 'Shift changed',
    });
    expect(resolved.body.request.status).toBe('approved');
  });

  it('keeps the words of a grievance out of the audit log', async () => {
    const { staff } = await people();
    await send(staff, {
      kind: 'grievance',
      subject: 'Secret problem',
      category: 'colleague',
      details: 'x x x',
    });
    const rows = await AuditLog.find({ action: 'request.created' }).lean();
    expect(JSON.stringify(rows)).not.toContain('Secret problem');
  });

  it('shows the waiting requests on the HR dashboard', async () => {
    const { hr, staff } = await people();
    await send(staff, { kind: 'document', subject: 'Letter', category: 'employment_letter' });
    const dashboard = await getControlCenter(hr);
    expect(JSON.stringify(dashboard)).toContain('Requests to decide');
  });
});

describe('withdrawing', () => {
  it('the employee withdraws a waiting request; then nobody can decide it', async () => {
    const { hr, staff } = await people();
    const created = (
      await send(staff, { kind: 'document', subject: 'Letter', category: 'address_proof' })
    ).body.request;
    expect(
      (await call(cancelRoute, { method: 'POST', user: hr, params: { id: created._id } })).status,
    ).toBe(404);
    const withdrawn = await call(cancelRoute, {
      method: 'POST',
      user: staff,
      params: { id: created._id },
    });
    expect(withdrawn.body.request.status).toBe('cancelled');
    expect((await decide(hr, created._id, { decision: 'approved' })).status).toBe(409);
  });
});
