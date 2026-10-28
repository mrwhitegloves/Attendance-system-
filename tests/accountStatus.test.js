import { describe, expect, it, vi } from 'vitest';

const sent = vi.hoisted(() => []);
vi.mock('@/server/infra/push.js', () => ({
  isPushConfigured: () => true,
  sendPush: async (subscription, payload) => {
    sent.push({ endpoint: subscription.endpoint, payload });
    return 'sent';
  },
}));

import { POST as login } from '@/app/api/auth/login/route.js';
import { GET as me } from '@/app/api/auth/me/route.js';
import { PATCH as patchUser } from '@/app/api/users/[id]/route.js';
import { PushSubscription } from '@/server/models/system.models.js';
import { punch } from '@/server/services/attendance.service.js';
import { ACCOUNT_STATUS } from '@/config/employeeOptions.js';
import { call, makeUser, PHOTO, at } from './helpers.js';

const subscribe = (user, name) =>
  PushSubscription.create({
    endpoint: `https://push.example/${name}`,
    keys: { p256dh: 'p', auth: 'a' },
    userId: user._id,
  });

describe('account status', () => {
  it.each(ACCOUNT_STATUS.values.filter((status) => status !== 'active'))(
    'refuses sign-in when the account is %s',
    async (status) => {
      await makeUser({ employeeId: 'MWG-050', password: 'right-password', status });
      const result = await call(login, {
        method: 'POST',
        body: { identifier: 'MWG-050', password: 'right-password' },
      });
      expect(result.status).toBe(403);
      expect(result.body.error).toContain(ACCOUNT_STATUS.label(status).toLowerCase());
    },
  );

  it('ends every session of a person HR deactivates and tells their devices', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const person = await makeUser({ employeeId: 'MWG-051', password: 'right-password' });
    await subscribe(person, 'person-phone');
    const signedIn = await call(login, {
      method: 'POST',
      body: { identifier: 'MWG-051', password: 'right-password' },
    });
    const cookie = signedIn.headers.get('set-cookie').split(';')[0];
    const asPerson = () => me(new Request('http://localhost/', { headers: { cookie } }), {});
    expect((await asPerson()).status).toBe(200);

    sent.length = 0;
    const result = await call(patchUser, {
      method: 'PATCH',
      user: hr,
      params: { id: String(person._id) },
      body: { status: 'deactivated' },
    });
    expect(result.status).toBe(200);
    expect((await asPerson()).status).toBe(401);
    await vi.waitFor(() =>
      expect(sent).toContainEqual(
        expect.objectContaining({
          endpoint: 'https://push.example/person-phone',
          payload: expect.objectContaining({ type: 'session_ended' }),
        }),
      ),
    );
  });

  it('does not let HR switch off their own account', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const result = await call(patchUser, {
      method: 'PATCH',
      user: hr,
      params: { id: String(hr._id) },
      body: { status: 'suspended' },
    });
    expect(result.status).toBe(400);
  });
});

describe('punch notifications', () => {
  it('go to every active employee except the person who punched', async () => {
    const puncher = await makeUser({ name: 'Sunil Field' });
    const colleague = await makeUser();
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const suspended = await makeUser({ status: 'suspended' });
    await subscribe(puncher, 'puncher');
    await subscribe(colleague, 'colleague');
    await subscribe(hr, 'hr');
    await subscribe(suspended, 'suspended');

    sent.length = 0;
    await punch(puncher, { selfie: PHOTO }, at('2026-10-26', '09:00'));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent.map((item) => item.endpoint).sort()).toEqual([
      'https://push.example/colleague',
      'https://push.example/hr',
    ]);
    expect(sent[0].payload.title).toBe('Sunil Field punched in');
  });
});
