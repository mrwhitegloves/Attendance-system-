import { describe, expect, it } from 'vitest';
import { GET as getRoute, POST as startRoute } from '@/app/api/users/[id]/onboarding/route.js';
import { PATCH as taskRoute } from '@/app/api/users/[id]/onboarding/tasks/[taskId]/route.js';
import { POST as completeRoute } from '@/app/api/users/[id]/onboarding/complete/route.js';
import { GET as listRoute } from '@/app/api/onboarding/route.js';
import { Letter } from '@/server/models/letter.model.js';
import { User } from '@/server/models/user.model.js';
import { Lookup } from '@/server/models/lookup.model.js';
import { seedChecklistTasks } from '@/server/services/lookups.service.js';
import { call, makeUser } from './helpers.js';

async function setup() {
  await seedChecklistTasks();
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  const staff = await makeUser({ name: 'Kiran Rao' });
  const id = String(staff._id);
  const started = await call(startRoute, { method: 'POST', user: hr, params: { id } });
  return { hr, staff, id, onboarding: started.body.onboarding };
}

const tick = (user, id, taskId, done = true) =>
  call(taskRoute, { method: 'PATCH', user, params: { id, taskId }, body: { done } });
const complete = (user, id) => call(completeRoute, { method: 'POST', user, params: { id } });

describe('onboarding', () => {
  it('starts with the tasks from Settings → Lists, once', async () => {
    const { hr, id, onboarding } = await setup();
    expect(onboarding.tasks.map((task) => task.label)).toEqual([
      'Welcome and induction done',
      'ID card given',
      'Email and system access given',
      'Policies explained (code of conduct, leave, IT and assets)',
      'Introduced to the team and manager',
    ]);
    expect(onboarding.checks.map((check) => check.key)).toEqual(['file', 'letter']);
    expect(onboarding.progress).toEqual({ done: 0, total: 7 });

    // A new list item later does not change a running checklist; starting twice changes nothing.
    await Lookup.create({ type: 'onboarding_task', name: 'Uniform given' });
    const again = await call(startRoute, { method: 'POST', user: hr, params: { id } });
    expect(again.body.onboarding.tasks).toHaveLength(5);
  });

  it('confirms the joining only when every task and check is done', async () => {
    const { hr, staff, id, onboarding } = await setup();
    for (const task of onboarding.tasks) await tick(hr, id, String(task._id));
    const early = await complete(hr, id);
    expect(early.status).toBe(409);
    expect(early.body.error).toContain('Employee file complete');

    await User.updateOne({ _id: staff._id }, { completeness: { percent: 100, missing: [] } });
    await Letter.collection.insertOne({
      userId: staff._id,
      employeeId: staff.employeeId,
      kind: 'offer',
      version: 1,
      status: 'accepted',
    });
    const ready = await call(getRoute, { user: hr, params: { id } });
    expect(ready.body.onboarding.ready).toBe(true);
    const done = await complete(hr, id);
    expect(done.body.onboarding).toMatchObject({ status: 'completed', completedByName: 'Ravi HR' });
    // Closed: nothing changes any more.
    expect((await tick(hr, id, String(onboarding.tasks[0]._id), false)).status).toBe(409);
  });

  it('records who ticked a task', async () => {
    const { hr, id, onboarding } = await setup();
    const result = await tick(hr, id, String(onboarding.tasks[1]._id));
    expect(result.body.onboarding.tasks[1]).toMatchObject({ done: true, doneByName: 'Ravi HR' });
    expect(result.body.onboarding.progress.done).toBe(1);
  });

  it('only HR changes it; a manager sees only the team’s checklists', async () => {
    const { staff, id, onboarding } = await setup();
    const manager = await makeUser({ roleKey: 'manager' });
    expect((await tick(staff, id, String(onboarding.tasks[0]._id))).status).toBe(403);
    // An employee has no access to employee files at all.
    expect((await call(getRoute, { user: staff, params: { id } })).status).toBe(403);
    // Not in the manager's team: hidden.
    expect((await call(getRoute, { user: manager, params: { id } })).status).toBe(404);
    expect((await call(listRoute, { user: manager })).body.items).toEqual([]);
  });
});
