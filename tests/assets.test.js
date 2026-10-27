import { describe, expect, it } from 'vitest';
import { GET as listRoute, POST as addRoute } from '@/app/api/assets/route.js';
import { GET as getRoute, PATCH as patchRoute } from '@/app/api/assets/[id]/route.js';
import { POST as assignRoute } from '@/app/api/assets/[id]/assign/route.js';
import { POST as returnRoute } from '@/app/api/assets/[id]/return/route.js';
import { GET as withRoute } from '@/app/api/users/[id]/assets/route.js';
import { call, makeUser } from './helpers.js';

const add = (user, body) => call(addRoute, { method: 'POST', user, body });
const assign = (user, id, body) =>
  call(assignRoute, { method: 'POST', user, params: { id }, body });
const takeBack = (user, id, body) =>
  call(returnRoute, { method: 'POST', user, params: { id }, body });

async function setup() {
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  const manager = await makeUser({ roleKey: 'manager' });
  const staff = await makeUser({ name: 'Sunil Field', managerId: manager._id });
  const other = await makeUser({ name: 'Pooja Staff' });
  const laptop = (
    await add(hr, { name: 'Dell Latitude', category: 'laptop', serialNumber: 'SN-1', value: 55000 })
  ).body.asset;
  return { hr, manager, staff, other, laptop };
}

describe('assets', () => {
  it('adds an asset to stock with a code, value in paise and a history', async () => {
    const { laptop } = await setup();
    expect(laptop).toMatchObject({ status: 'in_stock', valuePaise: 5500000 });
    expect(laptop.code).toMatch(/^AST-\d{4}$/);
    expect(laptop.history[0].action).toBe('added');
  });

  it('hands over to one employee at a time and keeps every move', async () => {
    const { hr, staff, other, laptop } = await setup();
    const given = await assign(hr, laptop._id, { userId: String(staff._id), condition: 'New' });
    expect(given.body.asset).toMatchObject({ status: 'assigned', employeeName: 'Sunil Field' });
    expect((await assign(hr, laptop._id, { userId: String(other._id) })).status).toBe(409);

    const back = await takeBack(hr, laptop._id, {
      status: 'under_repair',
      condition: 'Cracked screen',
    });
    expect(back.body.asset).toMatchObject({ status: 'under_repair', employeeName: '' });
    expect(back.body.asset.history.map((entry) => entry.action)).toEqual([
      'returned',
      'assigned',
      'added',
    ]);
    // Under repair: it cannot go to anyone until it is back in stock.
    expect((await assign(hr, laptop._id, { userId: String(other._id) })).status).toBe(409);
  });

  it('never hands an asset to someone who is not active', async () => {
    const { hr, laptop } = await setup();
    const gone = await makeUser({ status: 'deactivated' });
    expect((await assign(hr, laptop._id, { userId: String(gone._id) })).status).toBe(400);
  });

  it('refuses a status change while the employee has it', async () => {
    const { hr, staff, laptop } = await setup();
    await assign(hr, laptop._id, { userId: String(staff._id) });
    const changed = await call(patchRoute, {
      method: 'PATCH',
      user: hr,
      params: { id: laptop._id },
      body: { status: 'lost' },
    });
    expect(changed.status).toBe(409);
  });

  it('an employee sees only their own assets; a manager the team’s; nobody else can change them', async () => {
    const { hr, manager, staff, other, laptop } = await setup();
    const phone = (await add(hr, { name: 'Redmi 12', category: 'phone' })).body.asset;
    await assign(hr, laptop._id, { userId: String(staff._id) });
    await assign(hr, phone._id, { userId: String(other._id) });

    const own = await call(listRoute, { user: staff });
    expect(own.body.items.map((item) => item.name)).toEqual(['Dell Latitude']);
    expect((await call(getRoute, { user: staff, params: { id: phone._id } })).status).toBe(404);
    expect((await call(withRoute, { user: staff, params: { id: String(other._id) } })).status).toBe(
      404,
    );
    const team = await call(listRoute, { user: manager });
    expect(team.body.items.map((item) => item.name)).toEqual(['Dell Latitude']);

    expect((await add(staff, { name: 'Mine now', category: 'other' })).status).toBe(403);
    expect((await takeBack(manager, laptop._id, { status: 'in_stock' })).status).toBe(403);
  });

  it('an employee still sees an asset they returned, but not who had it after', async () => {
    const { hr, staff, other, laptop } = await setup();
    await assign(hr, laptop._id, { userId: String(staff._id) });
    await takeBack(hr, laptop._id, { status: 'in_stock' });
    await assign(hr, laptop._id, { userId: String(other._id) });
    const seen = await call(getRoute, { user: staff, params: { id: laptop._id } });
    expect(seen.status).toBe(200);
    expect(JSON.stringify(seen.body.asset.history)).not.toContain('Pooja Staff');
  });
});
