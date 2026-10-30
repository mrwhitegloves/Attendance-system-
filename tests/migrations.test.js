import { describe, expect, it } from 'vitest';
import { MIGRATIONS, runMigrations } from '@/server/migrations/index.js';
import { Migration } from '@/server/models/system.models.js';

describe('migration runner', () => {
  it('two servers starting together run every migration exactly once', async () => {
    const [first, second] = await Promise.all([runMigrations(), runMigrations()]);
    expect(first.length + second.length).toBe(MIGRATIONS.length);
    expect([first.length, second.length]).toContain(0);
    expect(await Migration.countDocuments({ name: '__lock' })).toBe(0);
    expect(await Migration.countDocuments()).toBe(MIGRATIONS.length);
  });

  it('a lock left over from a crashed start is taken over after ten minutes', async () => {
    await Migration.create({ name: '__lock', ranAt: new Date(Date.now() - 11 * 60 * 1000) });
    const ran = await runMigrations();
    expect(ran.length).toBe(MIGRATIONS.length);
  });

  it('a fresh lock makes another server skip', async () => {
    await Migration.create({ name: '__lock' });
    expect(await runMigrations()).toEqual([]);
    expect(await Migration.countDocuments()).toBe(1);
  });
});

describe('018: employees without a sign-in email', () => {
  it('rebuilds the old email index so several employees may have no email', async () => {
    const { User } = await import('@/server/models/user.model.js');
    // The first version's index: unique, not sparse.
    await User.collection.dropIndex('email_1');
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.insertOne({ name: 'A', employeeId: 'MWG-801', password: 'x' });
    await expect(
      User.collection.insertOne({ name: 'B', employeeId: 'MWG-802', password: 'x' }),
    ).rejects.toThrow(/duplicate/);

    const migration = MIGRATIONS.find((item) => item.name === '018-email-index-allows-empty');
    await migration.up();
    await migration.up(); // safe to run again

    await User.collection.insertOne({ name: 'B', employeeId: 'MWG-802', password: 'x' });
    await User.collection.insertOne({
      name: 'C',
      employeeId: 'MWG-803',
      password: 'x',
      email: 'c@x.in',
    });
    await expect(
      User.collection.insertOne({
        name: 'D',
        employeeId: 'MWG-804',
        password: 'x',
        email: 'c@x.in',
      }),
    ).rejects.toThrow(/duplicate/);
  });
});
