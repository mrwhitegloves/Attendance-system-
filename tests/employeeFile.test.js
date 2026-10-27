import { describe, expect, it } from 'vitest';
import { computeCompleteness } from '@/server/lib/completeness.js';
import { createUser, updateUser, getUser } from '@/server/services/users.service.js';
import { addLookup, updateLookup } from '@/server/services/lookups.service.js';
import { runMigrations } from '@/server/migrations/index.js';
import { User } from '@/server/models/user.model.js';
import { Lookup } from '@/server/models/lookup.model.js';
import { AuditLog } from '@/server/models/system.models.js';
import { POST as photoRoute } from '@/app/api/users/[id]/photo/route.js';
import { GET as lookupsRoute, POST as addLookupRoute } from '@/app/api/lookups/route.js';
import { call, makeUser, PHOTO } from './helpers.js';

const FULL = {
  photoKey: 'avatars/x.jpg',
  phone: '9876543210',
  dateOfBirth: '1995-04-21',
  gender: 'female',
  currentAddress: 'Noida',
  permanentAddress: 'Lucknow',
  emergencyContact: { name: 'Ramesh', relation: 'Father', phone: '9999999999' },
  designation: 'Technician',
  department: 'Operations',
  branch: 'Noida',
  employmentType: 'full_time',
  workMode: 'field',
  employmentStatus: 'confirmed',
  joiningDate: '2025-01-10',
  managerId: '6adf4550aa4e903dfd7bf772',
};

describe('file completeness', () => {
  it('is 100% only when every item is filled', () => {
    expect(computeCompleteness({ ...FULL, roleKey: 'employee' })).toEqual({
      percent: 100,
      missing: [],
    });
    const partial = computeCompleteness({
      ...FULL,
      roleKey: 'employee',
      dateOfBirth: '',
      emergencyContact: { name: 'A', phone: '' },
    });
    expect(partial.missing).toEqual(['Date of birth', 'Emergency contact']);
    expect(partial.percent).toBeLessThan(100);
  });

  it('does not ask a manager for the CEO', () => {
    expect(computeCompleteness({ ...FULL, managerId: null, roleKey: 'ceo' }).percent).toBe(100);
  });

  it('is saved on create and on every edit', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const created = await createUser(hr, {
      name: 'New Joiner',
      phone: '9876500000',
      password: 'joiner-pass',
      roleKey: 'employee',
      staffType: 'Field Staff',
      expectedInTime: '09:30',
      expectedOutTime: '18:30',
    });
    expect(created.completeness.percent).toBeGreaterThan(0);
    expect(created.completeness.missing).toContain('Date of birth');
    const edited = await updateUser(hr, created._id, { dateOfBirth: '1990-01-01' });
    expect(edited.completeness.missing).not.toContain('Date of birth');
    expect(edited.completeness.percent).toBeGreaterThan(created.completeness.percent);
  });
});

describe('managed lists', () => {
  it('refuses a department that is not in the list', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await expect(updateUser(hr, staff._id, { department: 'Space Team' })).rejects.toMatchObject({
      status: 400,
    });
    await addLookup(hr, { type: 'department', name: 'Space Team' });
    const updated = await updateUser(hr, staff._id, { department: 'Space Team' });
    expect(updated.department).toBe('Space Team');
  });

  it('renaming an item renames it on every employee', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const item = await addLookup(hr, { type: 'designation', name: 'Techncian' });
    await makeUser({ designation: 'Techncian' });
    await makeUser({ designation: 'Techncian' });
    await updateLookup(hr, item._id, { name: 'Technician' });
    expect(await User.countDocuments({ designation: 'Technician' })).toBe(2);
    expect(await User.countDocuments({ designation: 'Techncian' })).toBe(0);
  });

  it('refuses a duplicate name whatever its capital letters', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    await addLookup(hr, { type: 'branch', name: 'Noida' });
    await expect(addLookup(hr, { type: 'branch', name: 'NOIDA' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('only people with the settings permission add items', async () => {
    const employee = await makeUser();
    const result = await call(addLookupRoute, {
      method: 'POST',
      user: employee,
      body: { type: 'branch', name: 'Delhi' },
    });
    expect(result.status).toBe(403);
    expect(
      (await call(lookupsRoute, { user: employee, url: '/api/lookups?type=branch' })).status,
    ).toBe(200);
  });

  it('a migration fills the lists from existing employees', async () => {
    await makeUser({ department: 'Sales' });
    await makeUser({ department: 'Operations', designation: 'Supervisor' });
    await runMigrations();
    const names = (await Lookup.find({}).lean()).map((item) => `${item.type}:${item.name}`).sort();
    expect(names).toEqual(['department:Operations', 'department:Sales', 'designation:Supervisor']);
    const sales = await User.findOne({ department: 'Sales' }).lean();
    expect(sales.completeness.missing.length).toBeGreaterThan(0);
  });
});

describe('profile edits', () => {
  it('audits a nested emergency contact change field by field', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await updateUser(hr, staff._id, {
      emergencyContact: { name: 'Sita', relation: 'Mother', phone: '9000000000' },
    });
    const entry = await AuditLog.findOne({ action: 'user.updated' }).lean();
    expect(Object.keys(entry.changes).sort()).toEqual([
      'emergencyContact.name',
      'emergencyContact.phone',
      'emergencyContact.relation',
    ]);
  });

  it('a manager sees the file of a team member but not of others', async () => {
    const manager = await makeUser({ roleKey: 'manager' });
    const member = await makeUser({ managerId: manager._id });
    const other = await makeUser();
    expect((await getUser(manager, member._id)).employeeId).toBe(member.employeeId);
    await expect(getUser(manager, other._id)).rejects.toMatchObject({ status: 404 });
  });

  it('a photo needs permission, and storage that is set up', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    const denied = await call(photoRoute, {
      method: 'POST',
      user: staff,
      params: { id: String(staff._id) },
      body: { photo: PHOTO },
    });
    expect(denied.status).toBe(403);
    const noStorage = await call(photoRoute, {
      method: 'POST',
      user: hr,
      params: { id: String(staff._id) },
      body: { photo: PHOTO },
    });
    expect(noStorage.status).toBe(503);
  });
});
