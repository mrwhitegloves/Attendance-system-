import { Migration } from '../models/system.models.js';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';

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
  await User.create({
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
  return 'created';
}
