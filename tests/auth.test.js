import { describe, expect, it } from 'vitest';
import { POST as login } from '@/app/api/auth/login/route.js';
import { POST as logout } from '@/app/api/auth/logout/route.js';
import { GET as me } from '@/app/api/auth/me/route.js';
import { GET as listUsers } from '@/app/api/users/route.js';
import { GET as listAttendance } from '@/app/api/attendance/route.js';
import { GET as listLeaves } from '@/app/api/leaves/route.js';
import { GET as auditLog } from '@/app/api/audit-log/route.js';
import { GET as cron } from '@/app/api/cron/daily/route.js';
import { call, makeUser } from './helpers.js';
import { User } from '@/server/models/user.model.js';
import { runMigrations } from '@/server/migrations/index.js';

describe('sign in', () => {
  it('signs in with employee ID and never returns the password', async () => {
    await makeUser({ employeeId: 'MWG-001', password: 'right-password' });
    const result = await call(login, {
      method: 'POST',
      body: { identifier: 'mwg-001', password: 'right-password' },
    });
    expect(result.status).toBe(200);
    expect(result.body.user.employeeId).toBe('MWG-001');
    expect(JSON.stringify(result.body)).not.toContain('right-password');
    expect(result.headers.get('set-cookie')).toMatch(/hrms_session=.+HttpOnly/);
  });

  it('gives the same answer for an unknown ID and a wrong password', async () => {
    await makeUser({ employeeId: 'MWG-002', password: 'right-password' });
    const unknown = await call(login, {
      method: 'POST',
      body: { identifier: 'MWG-999', password: 'x' },
    });
    const wrong = await call(login, {
      method: 'POST',
      body: { identifier: 'MWG-002', password: 'wrong' },
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it('refuses a switched-off account', async () => {
    await makeUser({ employeeId: 'MWG-003', password: 'right-password', status: 'inactive' });
    const result = await call(login, {
      method: 'POST',
      body: { identifier: 'MWG-003', password: 'right-password' },
    });
    expect(result.status).toBe(403);
  });

  it('ends the session on logout', async () => {
    await makeUser({ employeeId: 'MWG-004', password: 'right-password' });
    const signedIn = await call(login, {
      method: 'POST',
      body: { identifier: 'MWG-004', password: 'right-password' },
    });
    const cookie = signedIn.headers.get('set-cookie').split(';')[0];
    const request = (handler, method = 'GET') =>
      handler(new Request('http://localhost/', { method, headers: { cookie } }), {});
    expect((await request(me)).status).toBe(200);
    await request(logout, 'POST');
    expect((await request(me)).status).toBe(401);
  });
});

describe('every API needs a session', () => {
  it.each([
    ['users', listUsers],
    ['attendance', listAttendance],
    ['leaves', listLeaves],
    ['audit log', auditLog],
    ['me', me],
  ])('%s answers 401 when signed out', async (_name, handler) => {
    expect((await call(handler)).status).toBe(401);
  });

  it('the daily job needs the cron secret', async () => {
    expect((await call(cron)).status).toBe(401);
  });
});

describe('permissions', () => {
  it('an employee cannot list employees or read the audit log', async () => {
    const employee = await makeUser();
    expect((await call(listUsers, { user: employee })).status).toBe(403);
    expect((await call(auditLog, { user: employee })).status).toBe(403);
  });

  it('a manager sees only their team', async () => {
    const manager = await makeUser({ roleKey: 'manager' });
    await makeUser({ name: 'Team Member', managerId: manager._id });
    await makeUser({ name: 'Other Person' });
    const result = await call(listUsers, { user: manager });
    const names = result.body.items.map((item) => item.name);
    expect(names).toContain('Team Member');
    expect(names).not.toContain('Other Person');
  });

  it('employee lists never include passwords', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin', password: 'hr-secret-123' });
    await makeUser({ password: 'staff-secret-123' });
    const result = await call(listUsers, { user: hr });
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toMatch(/secret-123/);
  });
});

describe('migration of the first version', () => {
  it('turns admins into HR Admin and everyone else into Employee', async () => {
    await User.collection.insertMany([
      { name: 'Old Admin', employeeId: 'MWG-010', password: 'x', isAdmin: true },
      { name: 'Old Staff', employeeId: 'MWG-011', password: 'x', isAdmin: false },
    ]);
    await runMigrations();
    const admin = await User.findOne({ employeeId: 'MWG-010' }).lean();
    const staff = await User.findOne({ employeeId: 'MWG-011' }).lean();
    expect(admin).toMatchObject({ roleKey: 'hr_admin', status: 'active' });
    expect(staff).toMatchObject({ roleKey: 'employee', status: 'active' });
  });
});
