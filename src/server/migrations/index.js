import { Migration } from '../models/system.models.js';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';
import { seedLookupsFromEmployees } from '../services/lookups.service.js';
import { computeCompleteness } from '../lib/completeness.js';
import { Kyc } from '../models/kyc.model.js';

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
];

/** Recomputes every employee's file completeness (a migration runs this when the checklist grows). */
export async function recomputeAllCompleteness() {
  const [users, records] = await Promise.all([User.find({}).lean(), Kyc.find({}).lean()]);
  const kycOf = new Map(records.map((record) => [String(record.userId), record]));
  for (const user of users) {
    await User.updateOne(
      { _id: user._id },
      { completeness: computeCompleteness(user, kycOf.get(String(user._id))) },
    );
  }
}

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
  await User.updateOne(
    { _id: created._id },
    { completeness: computeCompleteness(created.toObject()) },
  );
  await seedLookupsFromEmployees();
  return 'created';
}
