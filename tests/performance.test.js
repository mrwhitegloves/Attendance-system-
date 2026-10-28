import { describe, expect, it } from 'vitest';
import { POST as createRoute } from '@/app/api/users/[id]/reviews/route.js';
import { GET as listRoute } from '@/app/api/reviews/route.js';
import { GET as getRoute, PATCH as patchRoute } from '@/app/api/reviews/[id]/route.js';
import { POST as shareRoute } from '@/app/api/reviews/[id]/share/route.js';
import { POST as ackRoute } from '@/app/api/reviews/[id]/acknowledge/route.js';
import { call, makeUser } from './helpers.js';

const REVIEW = {
  kind: 'review',
  periodStart: '2026-07-01',
  periodEnd: '2026-09-30',
  goals: [{ title: 'Monthly bookings', target: '120', achieved: '134', rating: 4 }],
  strengths: 'Reliable on site visits',
  improvements: 'Update the CRM daily',
  training: 'Customer handling session',
};

async function setup() {
  const hr = await makeUser({ roleKey: 'hr_admin' });
  const manager = await makeUser({ roleKey: 'manager', name: 'Meena Manager' });
  const staff = await makeUser({ name: 'Sunil Field', managerId: manager._id });
  const other = await makeUser({ name: 'Pooja Staff' });
  return { hr, manager, staff, other };
}

const create = (user, person, body = REVIEW) =>
  call(createRoute, { method: 'POST', user, params: { id: String(person._id) }, body });
const share = (user, id) => call(shareRoute, { method: 'POST', user, params: { id } });

describe('performance', () => {
  it('a manager drafts a review for the team; the employee sees it only once shared', async () => {
    const { manager, staff } = await setup();
    const draft = (await create(manager, staff)).body.review;
    expect(draft).toMatchObject({ status: 'draft', reviewerName: 'Meena Manager' });
    expect((await call(getRoute, { user: staff, params: { id: draft._id } })).status).toBe(404);
    expect((await call(listRoute, { user: staff })).body.items).toEqual([]);

    // A review needs the overall rating before it is shared.
    expect((await share(manager, draft._id)).status).toBe(400);
    await call(patchRoute, {
      method: 'PATCH',
      user: manager,
      params: { id: draft._id },
      body: { rating: 4 },
    });
    expect((await share(manager, draft._id)).body.review.status).toBe('shared');

    const seen = await call(getRoute, { user: staff, params: { id: draft._id } });
    expect(seen.body.review.permissions.acknowledge).toBe(true);
    expect((await call(listRoute, { user: staff })).body.items).toHaveLength(1);
  });

  it('the text is fixed after sharing; the employee replies once', async () => {
    const { manager, staff } = await setup();
    const draft = (await create(manager, staff, { ...REVIEW, rating: 3 })).body.review;
    await share(manager, draft._id);
    const change = await call(patchRoute, {
      method: 'PATCH',
      user: manager,
      params: { id: draft._id },
      body: { rating: 5 },
    });
    expect(change.status).toBe(409);
    const ack = await call(ackRoute, {
      method: 'POST',
      user: staff,
      params: { id: draft._id },
      body: { comment: 'Thank you' },
    });
    expect(ack.body.review).toMatchObject({ status: 'acknowledged', employeeComment: 'Thank you' });
    const again = await call(ackRoute, {
      method: 'POST',
      user: staff,
      params: { id: draft._id },
      body: {},
    });
    expect(again.status).toBe(409);
  });

  it('an improvement plan gets its outcome after it is shared', async () => {
    const { hr, staff } = await setup();
    const plan = (await create(hr, staff, { ...REVIEW, kind: 'improvement_plan' })).body.review;
    const early = await call(patchRoute, {
      method: 'PATCH',
      user: hr,
      params: { id: plan._id },
      body: { outcome: 'met' },
    });
    expect(early.status).toBe(409);
    expect((await share(hr, plan._id)).status).toBe(200);
    const outcome = await call(patchRoute, {
      method: 'PATCH',
      user: hr,
      params: { id: plan._id },
      body: { outcome: 'extended', outcomeNote: 'One more month' },
    });
    expect(outcome.body.review).toMatchObject({
      outcome: 'extended',
      outcomeNote: 'One more month',
    });
  });

  it('nobody reviews themselves or someone outside their team', async () => {
    const { hr, manager, staff, other } = await setup();
    expect((await create(manager, other)).status).toBe(404);
    expect((await create(manager, manager)).status).toBe(403);
    expect((await create(staff, other)).status).toBe(403);
    // HR's draft of a team member is visible to the manager too (they manage the person).
    const draft = (await create(hr, staff)).body.review;
    expect((await call(getRoute, { user: manager, params: { id: draft._id } })).status).toBe(200);
    // Another employee never sees it.
    expect((await call(getRoute, { user: other, params: { id: draft._id } })).status).toBe(404);
  });
});
