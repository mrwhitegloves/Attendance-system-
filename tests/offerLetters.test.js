import { describe, expect, it } from 'vitest';
import { GET as listRoute, POST as startRoute } from '@/app/api/offer-letters/route.js';
import { DELETE as deleteRoute } from '@/app/api/letters/[id]/route.js';
import { POST as linkRoute } from '@/app/api/users/[id]/offer-letter/route.js';
import { POST as createUserRoute } from '@/app/api/users/route.js';
import { POST as employeeOfferRoute } from '@/app/api/users/[id]/offer-letters/route.js';
import { Candidate } from '@/server/models/candidate.model.js';
import { Letter } from '@/server/models/letter.model.js';
import { call, makeUser } from './helpers.js';

const start = (user, body) => call(startRoute, { method: 'POST', user, body });

describe('offer letters screen', () => {
  it('makes one offer letter per phone number', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const first = await start(hr, { name: 'Kiran Rao', phone: '+91 98765-43210' });
    expect(first.status).toBe(200);
    expect(first.body.letter.layout).toBe('offer_format');

    const again = await start(hr, { name: 'Kiran R', phone: '9876543210' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('offer_exists');
    expect(again.body.letterId).toBe(String(first.body.letter._id));
    expect(await Candidate.countDocuments()).toBe(1);

    const list = await call(listRoute, { user: hr, url: '/api/offer-letters?q=43210' });
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].person.name).toBe('Kiran Rao');
  });

  it('refuses the phone of an employee, and people without permission', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    await makeUser({ name: 'Old Staff', phone: '98765 11111' });
    const result = await start(hr, { name: 'Someone', phone: '9876511111' });
    expect(result.status).toBe(409);
    expect(result.body.error).toMatch(/Old Staff/);
    const staff = await makeUser();
    expect((await start(staff, { name: 'X Y', phone: '9000000001' })).status).toBe(403);
  });

  it('deleting removes every version and frees the phone', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const { body } = await start(hr, { name: 'Meena', phone: '9000000002' });
    const removed = await call(deleteRoute, {
      method: 'DELETE',
      user: hr,
      params: { id: body.letter._id },
    });
    expect(removed.status).toBe(200);
    expect(await Letter.countDocuments()).toBe(0);
    expect((await start(hr, { name: 'Meena', phone: '9000000002' })).status).toBe(200);
    expect(await Candidate.countDocuments()).toBe(1);
  });

  it('Add employee links the chosen offer letter to the new employee', async () => {
    const ceo = await makeUser({ roleKey: 'ceo' });
    const { body } = await start(ceo, { name: 'Arjun', phone: '9000000003' });
    const listed = await call(listRoute, { user: ceo, url: '/api/offer-letters?unlinked=1' });
    expect(listed.body.items).toHaveLength(1);

    const created = await call(createUserRoute, {
      method: 'POST',
      user: ceo,
      body: {
        name: 'Arjun',
        phone: '9000000003',
        password: 'new-pass-123',
        offerLetterId: body.letter._id,
      },
    });
    expect(created.status).toBe(200);
    const letter = await Letter.findById(body.letter._id).lean();
    expect(String(letter.userId)).toBe(String(created.body.user._id));
    const candidate = await Candidate.findById(letter.candidateId).lean();
    expect(candidate.status).toBe('joined');

    const unlinked = await call(listRoute, { user: ceo, url: '/api/offer-letters?unlinked=1' });
    expect(unlinked.body.items).toHaveLength(0);
    // The employee now has an offer letter: no second one.
    const second = await call(employeeOfferRoute, {
      method: 'POST',
      user: ceo,
      params: { id: created.body.user._id },
    });
    expect(second.status).toBe(409);
  });

  it('links a candidate letter to an existing employee only once', async () => {
    const ceo = await makeUser({ roleKey: 'ceo' });
    const employee = await makeUser({ name: 'Joined Earlier' });
    const { body } = await start(ceo, { name: 'Joined Earlier', phone: '9000000004' });
    const link = () =>
      call(linkRoute, {
        method: 'POST',
        user: ceo,
        params: { id: employee._id },
        body: { offerLetterId: body.letter._id },
      });
    expect((await link()).status).toBe(200);
    expect((await link()).status).toBe(409);
  });
});
