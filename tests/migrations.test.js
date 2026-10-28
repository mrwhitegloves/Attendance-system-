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
