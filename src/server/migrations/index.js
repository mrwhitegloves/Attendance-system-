import { Migration } from '../models/system.models.js';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';
import { seedChecklistTasks, seedLookupsFromEmployees } from '../services/lookups.service.js';
import { seedDocumentTypes } from '../services/documents.service.js';
import { seedLetterTemplates } from '../services/letters.service.js';
import { addMissingDefaultPermissions, seedRoles } from '../services/roles.service.js';
import { recomputeAllCompleteness, refreshCompleteness } from '../services/completeness.service.js';
import { Payslip } from '../models/payslip.model.js';
import { Candidate } from '../models/candidate.model.js';
import { phoneKey } from '../lib/phone.js';
import { KycLink } from '../models/kycLink.model.js';
import { DocumentType } from '../models/document.model.js';

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
  {
    name: '017-candidate-phone-key',
    // One offer letter per phone: candidates get the last 10 digits of their phone.
    up: async () => {
      const candidates = await Candidate.find({ phoneKey: { $in: [null, ''] } }, 'phone').lean();
      for (const candidate of candidates) {
        await Candidate.updateOne({ _id: candidate._id }, { phoneKey: phoneKey(candidate.phone) });
      }
    },
  },
  {
    name: '018-email-index-allows-empty',
    // The first version made `email` unique without "sparse": only one employee could be
    // without a sign-in email ("This email is already used"). Rebuilt as unique + sparse:
    // an email is still never used twice, an empty one is allowed for everyone.
    up: async () => {
      const indexes = await User.collection.indexes();
      const current = indexes.find((index) => index.name === 'email_1');
      if (current?.unique && current.sparse) return;
      if (current) await User.collection.dropIndex('email_1');
      await User.collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    },
  },
  {
    name: '019-kyc-review-and-previous-salary',
    // KYC forms are now checked by HR before they reach the file. Forms sent before this were
    // written at once: they count as approved. The catalogue gets "Previous salary slip".
    up: async () => {
      await KycLink.updateMany(
        { status: 'submitted', submitted: { $ne: null } },
        { $set: { status: 'approved' } },
      );
      const exists = await DocumentType.findOne({ name: 'Previous salary slip' })
        .collation({ locale: 'en', strength: 2 })
        .lean();
      if (!exists) {
        const last = await DocumentType.findOne({}, 'order').sort({ order: -1 }).lean();
        await DocumentType.create({
          category: 'hiring',
          name: 'Previous salary slip',
          order: (last?.order ?? 0) + 1,
        });
      }
    },
  },
];

// On Vercel several servers can start at the same moment. Only the one that writes this row
// runs the migrations; the others skip. A row older than LOCK_MINUTES is left over from a
// crashed start and is taken over.
const LOCK_NAME = '__lock';
const LOCK_MINUTES = 10;

async function takeLock() {
  await Migration.deleteOne({
    name: LOCK_NAME,
    ranAt: { $lt: new Date(Date.now() - LOCK_MINUTES * 60 * 1000) },
  });
  try {
    await Migration.create({ name: LOCK_NAME });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

export async function runMigrations() {
  const done = new Set((await Migration.find({}, 'name').lean()).map((row) => row.name));
  if (MIGRATIONS.every((migration) => done.has(migration.name))) return [];
  await Migration.init(); // the unique index on name must exist before the lock relies on it
  if (!(await takeLock())) return [];
  const ran = [];
  try {
    const doneNow = new Set((await Migration.find({}, 'name').lean()).map((row) => row.name));
    for (const migration of MIGRATIONS) {
      if (doneNow.has(migration.name)) continue;
      await migration.up();
      await Migration.create({ name: migration.name });
      ran.push(migration.name);
    }
  } finally {
    await Migration.deleteOne({ name: LOCK_NAME });
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
