import { describe, expect, it } from 'vitest';
import {
  proposeSalary,
  decideSalary,
  getSalary,
  salaryInForce,
  salaryOverview,
} from '@/server/services/salary.service.js';
import { salaryTotals } from '@/server/lib/salary.js';
import { refreshCompleteness } from '@/server/services/completeness.service.js';
import { SalaryStructure } from '@/server/models/salary.model.js';
import { User } from '@/server/models/user.model.js';
import { GET as salaryRoute } from '@/app/api/users/[id]/salary/route.js';
import { call, makeUser } from './helpers.js';

const paise = (rupees) => rupees * 100;
const STRUCTURE = {
  basic: paise(15000),
  hra: paise(6000),
  specialAllowance: paise(9000),
  employerPf: paise(1800),
  employeePf: paise(1800),
  professionalTax: paise(200),
};

describe('salary totals', () => {
  it('matches the example in the CEO document (₹30,000 gross)', () => {
    expect(salaryTotals(STRUCTURE)).toEqual({
      monthlyGross: paise(30000),
      monthlyDeductions: paise(2000),
      monthlyNet: paise(28000),
      monthlyEmployer: paise(1800),
      monthlyCtc: paise(31800),
      annualCtc: paise(381600),
    });
  });
});

describe('salary versions and approval', () => {
  it('the person who proposed cannot approve; someone else can', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const finance = await makeUser({ roleKey: 'finance' });
    const staff = await makeUser();
    await proposeSalary(finance, staff._id, {
      effectiveFrom: '2026-10-01',
      reason: 'Joining',
      components: STRUCTURE,
    });
    const pending = await SalaryStructure.findOne({ userId: staff._id }).lean();
    await expect(
      decideSalary(finance, pending._id, { decision: 'approved', note: '' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      decideSalary(hr, pending._id, { decision: 'approved', note: '' }),
    ).rejects.toMatchObject({ status: 403 });
    const ceo = await makeUser({ roleKey: 'ceo' });
    await decideSalary(ceo, pending._id, { decision: 'approved', note: '' });
    expect((await salaryInForce(staff._id, '2026-10-15')).totals.annualCtc).toBe(paise(381600));
  });

  it('a revision is a new version; the old one is kept', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const ceo = await makeUser({ roleKey: 'ceo' });
    const staff = await makeUser();
    await proposeSalary(hr, staff._id, {
      effectiveFrom: '2026-01-01',
      reason: 'Joining',
      components: STRUCTURE,
    });
    await decideSalary(ceo, (await SalaryStructure.findOne({ version: 1 }))._id, {
      decision: 'approved',
      note: '',
    });
    await proposeSalary(hr, staff._id, {
      effectiveFrom: '2026-12-01',
      reason: 'Annual increment',
      components: { ...STRUCTURE, basic: paise(18000) },
    });
    await expect(
      proposeSalary(hr, staff._id, {
        effectiveFrom: '2027-01-01',
        reason: 'Another',
        components: STRUCTURE,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await decideSalary(ceo, (await SalaryStructure.findOne({ version: 2 }))._id, {
      decision: 'approved',
      note: '',
    });
    expect(await SalaryStructure.countDocuments({ userId: staff._id })).toBe(2);
    expect((await salaryInForce(staff._id, '2026-11-15')).version).toBe(1);
    expect((await salaryInForce(staff._id, '2026-12-15')).version).toBe(2);
  });

  it('refuses a structure whose deductions are larger than the gross', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await expect(
      proposeSalary(hr, staff._id, {
        effectiveFrom: '2026-10-01',
        reason: 'Joining',
        components: { basic: paise(1000), tds: paise(5000) },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('an approved salary counts in the file completeness', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const ceo = await makeUser({ roleKey: 'ceo' });
    const staff = await makeUser();
    // A real employee always has a computed file; makeUser writes straight to the database.
    await refreshCompleteness(staff._id);
    await proposeSalary(hr, staff._id, {
      effectiveFrom: '2026-01-01',
      reason: 'Joining',
      components: STRUCTURE,
    });
    expect((await User.findById(staff._id).lean()).completeness.missing).toContain(
      'Salary structure (approved)',
    );
    await decideSalary(ceo, (await SalaryStructure.findOne({ userId: staff._id }))._id, {
      decision: 'approved',
      note: '',
    });
    expect((await User.findById(staff._id).lean()).completeness.missing).not.toContain(
      'Salary structure (approved)',
    );
  });
});

describe('who sees salaries', () => {
  it('employees see only their own approved structures; managers none', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const ceo = await makeUser({ roleKey: 'ceo' });
    const manager = await makeUser({ roleKey: 'manager' });
    const staff = await makeUser({ managerId: manager._id });
    await proposeSalary(hr, staff._id, {
      effectiveFrom: '2026-01-01',
      reason: 'Joining',
      components: STRUCTURE,
    });
    expect((await getSalary(staff, staff._id)).versions).toHaveLength(0);
    await decideSalary(ceo, (await SalaryStructure.findOne({ userId: staff._id }))._id, {
      decision: 'approved',
      note: '',
    });
    expect((await getSalary(staff, staff._id)).versions).toHaveLength(1);
    expect(
      (await call(salaryRoute, { user: manager, params: { id: String(staff._id) } })).status,
    ).toBe(403);
    const overview = await salaryOverview(ceo);
    expect(overview.totals.monthlyCtc).toBe(paise(31800));
  });
});
