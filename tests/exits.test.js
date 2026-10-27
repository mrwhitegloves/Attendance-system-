import { describe, expect, it } from 'vitest';
import { GET as exitsRoute, POST as startRoute } from '@/app/api/users/[id]/exits/route.js';
import { PATCH as taskRoute } from '@/app/api/users/[id]/exits/current/tasks/[taskId]/route.js';
import { POST as completeRoute } from '@/app/api/users/[id]/exits/current/complete/route.js';
import { POST as withdrawRoute } from '@/app/api/users/[id]/exits/current/withdraw/route.js';
import { GET as listRoute } from '@/app/api/exits/route.js';
import { GET as me } from '@/app/api/auth/me/route.js';
import { POST as addAsset } from '@/app/api/assets/route.js';
import { POST as assignAsset } from '@/app/api/assets/[id]/assign/route.js';
import { POST as returnAsset } from '@/app/api/assets/[id]/return/route.js';
import { User } from '@/server/models/user.model.js';
import { seedChecklistTasks } from '@/server/services/lookups.service.js';
import { createSession, SESSION_COOKIE } from '@/server/auth/session.js';
import { call, makeUser } from './helpers.js';

const EXIT = {
  type: 'resignation',
  noticeDate: '2026-10-01',
  lastWorkingDay: '2026-10-31',
  reason: 'Moving to Pune',
};

async function setup() {
  await seedChecklistTasks();
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  const manager = await makeUser({ roleKey: 'manager' });
  const staff = await makeUser({
    name: 'Sunil Field',
    managerId: manager._id,
    employmentStatus: 'confirmed',
  });
  const id = String(staff._id);
  return { hr, manager, staff, id };
}

const start = (user, id, body = EXIT) =>
  call(startRoute, { method: 'POST', user, params: { id }, body });
const tickAll = async (user, id, exit) => {
  for (const task of exit.tasks) {
    await call(taskRoute, {
      method: 'PATCH',
      user,
      params: { id, taskId: String(task._id) },
      body: { done: true },
    });
  }
};

describe('exits', () => {
  it('starts the notice period with the exit tasks; only one open exit', async () => {
    const { hr, staff, id } = await setup();
    const started = await start(hr, id);
    expect(started.status).toBe(200);
    expect(started.body.exit.tasks.map((task) => task.label)).toContain('Work handed over');
    expect(started.body.exit.checks[0]).toMatchObject({ key: 'assets', done: true });
    expect((await User.findById(staff._id).lean()).employmentStatus).toBe('notice_period');
    expect((await start(hr, id)).status).toBe(409);
  });

  it('closes only when every task is done and every asset is back; then the account is deactivated', async () => {
    const { hr, staff, id } = await setup();
    const laptop = (
      await call(addAsset, { method: 'POST', user: hr, body: { name: 'Dell', category: 'laptop' } })
    ).body.asset;
    await call(assignAsset, {
      method: 'POST',
      user: hr,
      params: { id: laptop._id },
      body: { userId: id },
    });
    const exit = (await start(hr, id)).body.exit;
    await tickAll(hr, id, exit);

    const blocked = await call(completeRoute, {
      method: 'POST',
      user: hr,
      params: { id },
      body: {},
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toContain('Every company asset returned');

    await call(returnAsset, {
      method: 'POST',
      user: hr,
      params: { id: laptop._id },
      body: { status: 'in_stock' },
    });
    const cookie = `${SESSION_COOKIE}=${await createSession(staff._id)}`;
    const closed = await call(completeRoute, {
      method: 'POST',
      user: hr,
      params: { id },
      body: {},
    });
    expect(closed.status).toBe(200);
    expect(closed.body.exit).toMatchObject({ status: 'completed', closedByName: 'Ravi HR' });
    const after = await User.findById(staff._id).lean();
    expect(after).toMatchObject({ status: 'deactivated', employmentStatus: 'exited' });
    // Signed out at once.
    const session = await me(new Request('http://localhost/', { headers: { cookie } }), {});
    expect(session.status).toBe(401);
  });

  it('a withdrawn resignation puts the old employment status back and is kept', async () => {
    const { hr, staff, id } = await setup();
    await start(hr, id);
    const withdrawn = await call(withdrawRoute, {
      method: 'POST',
      user: hr,
      params: { id },
      body: { note: 'Stays after a raise' },
    });
    expect(withdrawn.body.exit.status).toBe('withdrawn');
    expect((await User.findById(staff._id).lean()).employmentStatus).toBe('confirmed');
    const history = await call(exitsRoute, { user: hr, params: { id } });
    expect(history.body.items).toHaveLength(1);
    // A new exit can start later.
    expect((await start(hr, id)).status).toBe(200);
  });

  it('refuses a last working day before the notice, and one’s own exit', async () => {
    const { hr, id } = await setup();
    const backwards = await start(hr, id, { ...EXIT, lastWorkingDay: '2026-09-01' });
    expect(backwards.status).toBe(400);
    expect((await start(hr, String(hr._id))).status).toBe(400);
  });

  it('a manager sees the team’s exits but cannot change them', async () => {
    const { hr, manager, id } = await setup();
    await start(hr, id);
    const team = await call(listRoute, { user: manager });
    expect(team.body.items.map((item) => item.employeeName)).toEqual(['Sunil Field']);
    expect((await start(manager, id)).status).toBe(403);
    const staff = await makeUser();
    expect((await call(listRoute, { user: staff })).status).toBe(403);
  });
});
