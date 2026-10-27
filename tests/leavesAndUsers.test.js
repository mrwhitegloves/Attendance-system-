import { describe, expect, it } from 'vitest';
import { requestLeave, decideLeave, writeLeaveDays } from '@/server/services/leaves.service.js';
import { createUser, updateUser } from '@/server/services/users.service.js';
import { addLookup } from '@/server/services/lookups.service.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { Counter, AuditLog } from '@/server/models/system.models.js';
import { GET as revealRoute } from '@/app/api/users/[id]/password/route.js';
import { call, makeUser } from './helpers.js';

describe('leave', () => {
  it('approval writes one Leave row per day, never twice', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    const leave = await requestLeave(staff, {
      startDate: '2026-11-02',
      endDate: '2026-11-04',
      reason: 'Family function',
    });
    const approved = await decideLeave(hr, leave._id, { decision: 'approved', note: '' });
    await writeLeaveDays(approved, hr);
    const rows = await Attendance.find({ employeeId: staff.employeeId, status: 'Leave' }).lean();
    expect(rows.map((row) => row.date).sort()).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('nobody approves their own leave', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const leave = await requestLeave(hr, {
      startDate: '2026-11-02',
      endDate: '2026-11-02',
      reason: 'Doctor visit',
    });
    await expect(
      decideLeave(hr, leave._id, { decision: 'approved', note: '' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('a manager decides only for their team', async () => {
    const manager = await makeUser({ roleKey: 'manager' });
    const outsider = await makeUser();
    const leave = await requestLeave(outsider, {
      startDate: '2026-11-02',
      endDate: '2026-11-02',
      reason: 'Personal work',
    });
    await expect(
      decideLeave(manager, leave._id, { decision: 'approved', note: '' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses overlapping requests', async () => {
    const staff = await makeUser();
    await requestLeave(staff, {
      startDate: '2026-11-02',
      endDate: '2026-11-05',
      reason: 'Trip home',
    });
    await expect(
      requestLeave(staff, { startDate: '2026-11-04', endDate: '2026-11-06', reason: 'Trip home' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('employees', () => {
  it('gives the next MWG ID from the existing counter', async () => {
    await Counter.create({ id: 'employeeId', seq: 41 });
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const created = await createUser(hr, {
      name: 'New Joiner',
      password: 'joiner-pass',
      roleKey: 'employee',
      staffType: 'Field Staff',
      expectedInTime: '09:30',
      expectedOutTime: '18:30',
    });
    expect(created.employeeId).toBe('MWG-042');
    expect(created.password).toBeUndefined();
  });

  it('only the CEO gives the CEO role', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await expect(updateUser(hr, staff._id, { roleKey: 'ceo' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('audits edits without the password', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser({ department: 'Sales' });
    await addLookup(hr, { type: 'department', name: 'Operations' });
    await updateUser(hr, staff._id, { department: 'Operations', password: 'brand-new-pass' });
    const entries = await AuditLog.find({ entityId: String(staff._id) }).lean();
    expect(entries.map((entry) => entry.action).sort()).toEqual([
      'user.password_set',
      'user.updated',
    ]);
    expect(JSON.stringify(entries)).not.toContain('brand-new-pass');
  });

  it('reveals a password only with permission, and audits it', async () => {
    const ceo = await makeUser({ roleKey: 'ceo' });
    const manager = await makeUser({ roleKey: 'manager' });
    const staff = await makeUser({ password: 'staff-pass-1' });
    expect(
      (await call(revealRoute, { user: manager, params: { id: String(staff._id) } })).status,
    ).toBe(403);
    const shown = await call(revealRoute, { user: ceo, params: { id: String(staff._id) } });
    expect(shown.body.password).toBe('staff-pass-1');
    expect(await AuditLog.countDocuments({ action: 'user.password_viewed' })).toBe(1);
  });
});
