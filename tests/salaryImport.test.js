import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { POST as importRoute } from '@/app/api/salary/import/route.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { call, makeUser } from './helpers.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const sheet = async () =>
  `data:${XLSX};base64,${(await readFile(path.join(import.meta.dirname, 'fixtures', 'salaries.xlsx'))).toString('base64')}`;

describe('salaries from an Excel sheet', () => {
  it('proposes each known employee and says why the other rows were skipped', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin', employeeId: 'MWG-801' });
    const first = await makeUser({ employeeId: 'MWG-901', name: 'First' });
    await makeUser({ employeeId: 'MWG-902', name: 'Second' });
    const result = await call(importRoute, {
      method: 'POST',
      user: hr,
      body: { file: await sheet(), effectiveFrom: '2026-11-01', reason: 'Salaries at the start' },
    });
    expect(result.status).toBe(200);
    expect(result.body.proposed).toBe(1);
    expect(result.body.results.map((row) => [row.employeeId, row.ok, row.message])).toEqual([
      ['MWG-901', true, 'Proposed: Rs. 27000.00 a month'],
      ['MWG-999', false, 'No employee with this ID'],
      ['MWG-902', false, 'The monthly salary is not a number above 0'],
    ]);
    // A normal proposal: waits for the CEO, basic = the monthly salary in paise.
    const proposal = await SalaryStructure.findOne({ userId: first._id }).lean();
    expect(proposal).toMatchObject({ status: 'pending_approval', effectiveFrom: '2026-11-01' });
    expect(proposal.components.basic).toBe(2700000);
  });

  it('refuses a file that is not an Excel sheet, and people without salary rights', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const pdf = `data:application/pdf;base64,${Buffer.from('%PDF').toString('base64')}`;
    const wrong = await call(importRoute, {
      method: 'POST',
      user: hr,
      body: { file: pdf, effectiveFrom: '2026-11-01', reason: 'Start' },
    });
    expect(wrong.status).toBe(400);
    const staff = await makeUser();
    const denied = await call(importRoute, {
      method: 'POST',
      user: staff,
      body: { file: await sheet(), effectiveFrom: '2026-11-01', reason: 'Start' },
    });
    expect(denied.status).toBe(403);
  });
});
