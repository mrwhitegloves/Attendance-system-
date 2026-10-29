import { describe, expect, it } from 'vitest';
import { DELETE as deleteUserRoute, GET as getUserRoute } from '@/app/api/users/[id]/route.js';
import { GET as listRoute } from '@/app/api/trash/route.js';
import { DELETE as foreverRoute } from '@/app/api/trash/[id]/route.js';
import { POST as restoreRoute } from '@/app/api/trash/[id]/restore/route.js';
import { POST as startOfferRoute } from '@/app/api/offer-letters/route.js';
import { DELETE as deleteLetterRoute } from '@/app/api/letters/[id]/route.js';
import { POST as makeLinkRoute } from '@/app/api/kyc-links/route.js';
import { DELETE as deleteLinkRoute } from '@/app/api/kyc-links/[id]/route.js';
import { User } from '@/server/models/user.model.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { Letter } from '@/server/models/letter.model.js';
import { KycLink } from '@/server/models/kycLink.model.js';
import { Asset } from '@/server/models/asset.model.js';
import { Holiday } from '@/server/models/leaveRules.model.js';
import { Session } from '@/server/models/system.models.js';
import { DeletedItem } from '@/server/models/deletedItem.model.js';
import { removeHoliday } from '@/server/services/leaveRules.service.js';
import { call, makeUser } from './helpers.js';

const trashList = (user) => call(listRoute, { user });
const restore = (user, id) => call(restoreRoute, { method: 'POST', user, params: { id } });

describe('recently deleted', () => {
  it('an employee and all their records go to Recently deleted and come back the same', async () => {
    const ceo = await makeUser({ roleKey: 'ceo' });
    const staff = await makeUser({ name: 'Riya', email: 'riya@example.com' });
    await Attendance.insertMany([
      { employeeId: staff.employeeId, date: '2026-10-01', time: '09:30 AM', status: 'Checked In' },
      { employeeId: staff.employeeId, date: '2026-10-02', time: '09:31 AM', status: 'Checked In' },
    ]);
    await Session.create({
      tokenHash: 'x',
      userId: staff._id,
      expiresAt: new Date(Date.now() + 1e7),
    });

    const preview = await call(getUserRoute, {
      user: ceo,
      url: '/?deletePreview=1',
      params: { id: staff._id },
    });
    expect(preview.body.counts).toEqual([['attendance records', 2]]);

    const removed = await call(deleteUserRoute, {
      method: 'DELETE',
      user: ceo,
      params: { id: staff._id },
    });
    expect(removed.status).toBe(200);
    expect(await User.exists({ _id: staff._id })).toBeNull();
    expect(await Attendance.countDocuments()).toBe(0);
    expect(await Session.countDocuments({ userId: staff._id })).toBe(0);

    const list = await trashList(ceo);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ kind: 'employee', canRestore: true });
    expect(list.body.items[0].parts).toBeUndefined();
    const left = (new Date(list.body.items[0].expiresAt) - Date.now()) / 86_400_000;
    expect(Math.round(left)).toBe(90);

    const back = await restore(ceo, list.body.items[0]._id);
    expect(back.body).toMatchObject({ kind: 'employee', entityId: String(staff._id) });
    const restored = await User.findById(staff._id).lean();
    expect(restored).toMatchObject({ name: 'Riya', email: 'riya@example.com', status: 'active' });
    expect(restored.createdAt).toBeInstanceOf(Date);
    expect(await Attendance.countDocuments({ employeeId: staff.employeeId })).toBe(2);
    expect(await DeletedItem.countDocuments()).toBe(0);
    expect((await restore(ceo, list.body.items[0]._id)).status).toBe(404);
  });

  it('refuses to delete yourself, a holder of assets, or a manager with a team', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const del = (id) => call(deleteUserRoute, { method: 'DELETE', user: hr, params: { id } });
    expect((await del(hr._id)).status).toBe(400);
    const ceo = await makeUser({ roleKey: 'ceo' });
    expect((await del(ceo._id)).status).toBe(403);
    const holder = await makeUser();
    // An asset the employee holds now (only the fields the delete check reads).
    await Asset.collection.insertOne({ code: 'AST-0001', userId: holder._id });
    expect((await del(holder._id)).status).toBe(409);
    const manager = await makeUser();
    await makeUser({ managerId: manager._id });
    expect((await del(manager._id)).status).toBe(409);
    const staff = await makeUser();
    expect(
      (await call(deleteUserRoute, { method: 'DELETE', user: staff, params: { id: hr._id } }))
        .status,
    ).toBe(403);
  });

  it('a restored offer letter must not make a second one for the person', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const settings = await makeUser({ roleKey: 'ceo' });
    const first = await call(startOfferRoute, {
      method: 'POST',
      user: hr,
      body: { name: 'Kiran', phone: '9000000011' },
    });
    await call(deleteLetterRoute, {
      method: 'DELETE',
      user: hr,
      params: { id: first.body.letter._id },
    });
    expect(await Letter.countDocuments()).toBe(0);
    const [item] = (await trashList(settings)).body.items;
    expect(item.kind).toBe('offer_letter');

    await call(startOfferRoute, {
      method: 'POST',
      user: hr,
      body: { name: 'Kiran', phone: '9000000011' },
    });
    const refused = await restore(settings, item._id);
    expect(refused.status).toBe(409);
    expect(await Letter.countDocuments()).toBe(1);

    await Letter.deleteMany({});
    expect((await restore(settings, item._id)).status).toBe(200);
    expect(await Letter.exists({ _id: first.body.letter._id })).toBeTruthy();
  });

  it('KYC links and holidays are deleted to the trash; delete for good removes them', async () => {
    const ceo = await makeUser({ roleKey: 'ceo' });
    const staff = await makeUser();
    const made = await call(makeLinkRoute, {
      method: 'POST',
      user: ceo,
      body: { userId: staff._id },
    });
    await call(deleteLinkRoute, {
      method: 'DELETE',
      user: ceo,
      params: { id: made.body.link._id },
    });
    expect(await KycLink.countDocuments()).toBe(0);

    const holiday = await Holiday.create({ date: '2026-11-08', name: 'Diwali', kind: 'festival' });
    await removeHoliday(ceo, holiday._id);
    expect(await Holiday.countDocuments()).toBe(0);

    const items = (await trashList(ceo)).body.items;
    expect(items.map((item) => item.kind).sort()).toEqual(['holiday', 'kyc_link']);
    const holidayItem = items.find((item) => item.kind === 'holiday');
    expect((await restore(ceo, holidayItem._id)).status).toBe(200);
    expect(await Holiday.exists({ _id: holiday._id })).toBeTruthy();

    const linkItem = items.find((item) => item.kind === 'kyc_link');
    const gone = await call(foreverRoute, {
      method: 'DELETE',
      user: ceo,
      params: { id: linkItem._id },
    });
    expect(gone.status).toBe(200);
    expect(await DeletedItem.countDocuments()).toBe(0);
  });

  it('MongoDB removes items by itself after 90 days (TTL index)', async () => {
    const indexes = await DeletedItem.collection.indexes();
    expect(indexes.find((index) => index.key.expiresAt)).toMatchObject({ expireAfterSeconds: 0 });
  });

  it('only people who manage settings see Recently deleted', async () => {
    const staff = await makeUser();
    expect((await trashList(staff)).status).toBe(403);
  });
});
