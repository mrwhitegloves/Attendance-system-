import { Migration } from '../models/system.models.js';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';
import { seedChecklistTasks, seedLookupsFromEmployees } from '../services/lookups.service.js';
import { seedDocumentTypes } from '../services/documents.service.js';
import { seedLetterTemplates } from '../services/letters.service.js';
import { addMissingDefaultPermissions, seedRoles } from '../services/roles.service.js';
import { recomputeAllCompleteness, refreshCompleteness } from '../services/completeness.service.js';
import { Payslip } from '../models/payslip.model.js';

// Changes to existing data, in order. Each runs once (its name is stored in `migrations`)
// and must be safe to run again. Never edit the database by hand; add a migration here.

export const MIGRATIONS = [
  {
    name: '001-user-roles-and-status',
    // The first version had only isAdmin. Admins become HR Admin; everyone else Employee.
    up: async () => {
      await User.updateMany(
        { roleKey: { $exists: false }, isAdmin: true },
        { $set: { roleKey: 'hr_admin' } },
      );
      await User.updateMany({ roleKey: { $exists: false } }, { $set: { roleKey: 'employee' } });
      await User.updateMany({ status: { $exists: false } }, { $set: { status: 'active' } });
    },
  },
  {
    name: '002-lists-and-file-completeness',
    // Fills Settings → Lists from the departments employees already have, and works out how
    // complete every employee's file is.
    up: async () => {
      await seedLookupsFromEmployees();
      await recomputeAllCompleteness();
    },
  },
  {
    name: '003-file-completeness-with-kyc',
    // The file checklist now includes PAN, Aadhaar and bank account.
    up: () => recomputeAllCompleteness(),
  },
  {
    name: '004-document-catalogue',
    // The starting list of document types (CEO spec table); required ones join the file checklist.
    up: async () => {
      await seedDocumentTypes();
      await recomputeAllCompleteness();
    },
  },
  {
    name: '005-letter-templates',
    // The starting offer and appointment letter templates.
    up: () => seedLetterTemplates(),
  },
  {
    name: '006-file-completeness-with-salary',
    // The file checklist now includes an approved salary structure.
    up: () => recomputeAllCompleteness(),
  },
  {
    name: '007-roles-in-database',
    // Roles move from code into the `roles` collection (Settings → Roles, CEO only).
    up: () => seedRoles(),
  },
  {
    name: '008-payslip-permissions',
    // Salary slips: the new permissions reach roles already in the database.
    up: () =>
      addMissingDefaultPermissions(['payslips.view', 'payslips.manage', 'payslips.finalise']),
  },
  {
    name: '009-request-permissions',
    // Requests inbox: the new permissions reach roles already in the database.
    up: () => addMissingDefaultPermissions(['requests.create', 'requests.view', 'requests.decide']),
  },
  {
    name: '010-asset-permissions',
    // Company assets: the new permissions reach roles already in the database.
    up: () => addMissingDefaultPermissions(['assets.view', 'assets.manage']),
  },
  {
    name: '011-recruitment-permissions',
    // Candidates and offer letters: the new permissions reach roles already in the database.
    up: () => addMissingDefaultPermissions(['recruitment.view', 'recruitment.manage']),
  },
  {
    name: '012-checklist-tasks',
    // The starting onboarding and exit tasks in Settings → Lists.
    up: () => seedChecklistTasks(),
  },
  {
    name: '013-exit-permissions',
    // Exits: the new permissions reach roles already in the database.
    up: () => addMissingDefaultPermissions(['exits.view', 'exits.manage']),
  },
  {
    name: '014-performance-permissions',
    // Performance reviews: the new permissions reach roles already in the database.
    up: () => addMissingDefaultPermissions(['performance.view', 'performance.manage']),
  },
  {
    name: '015-payouts',
    // Salary payouts (CEO answers, 2026-10-28): the new permissions; managers see the salary
    // and slips of their team; final slips made before payouts existed wait for approval.
    up: async () => {
      await addMissingDefaultPermissions([
        'payouts.approve',
        'payouts.manage',
        'payslips.view',
        'salary.view',
      ]);
      await Payslip.updateMany(
        { status: 'final', 'payout.status': { $exists: false } },
        { $set: { 'payout.status': 'unpaid' } },
      );
    },
  },
  {
    name: '016-report-permission',
    // Reports: the new permission reaches roles already in the database.
    up: () => addMissingDefaultPermissions(['reports.export']),
  },
];

export async function runMigrations() {
  const done = new Set((await Migration.find({}, 'name').lean()).map((row) => row.name));
  const ran = [];
  for (const migration of MIGRATIONS) {
    if (done.has(migration.name)) continue;
    await migration.up();
    await Migration.create({ name: migration.name });
    ran.push(migration.name);
  }
  return ran;
}

/**
 * The old version signed the admin in from ADMIN_* variables. Now the admin is a normal account:
 * if no CEO exists, one is made from those variables (or the user with ADMIN_EMAIL is promoted).
 */
export async function ensureCeoAccount() {
  if (await User.exists({ roleKey: 'ceo' })) return null;
  if (!env.ADMIN_PASSWORD || (!env.ADMIN_EMAIL && !env.ADMIN_USERNAME)) return null;
  if (env.ADMIN_EMAIL) {
    const existing = await User.findOneAndUpdate(
      { email: env.ADMIN_EMAIL.toLowerCase() },
      { roleKey: 'ceo', status: 'active' },
    );
    if (existing) return 'promoted';
  }
  const created = await User.create({
    name: 'White Gloves Admin',
    employeeId: 'ADMIN-001',
    email: env.ADMIN_EMAIL || undefined,
    username: env.ADMIN_USERNAME || undefined,
    password: env.ADMIN_PASSWORD,
    department: 'Management',
    staffType: 'Management',
    roleKey: 'ceo',
    status: 'active',
  });
  await refreshCompleteness(created._id);
  await seedLookupsFromEmployees();
  return 'created';
}
