import { afterEach, describe, expect, it } from 'vitest';
import { seedRoles, updateRole, addRole, listRoles } from '@/server/services/roles.service.js';
import { loadRoles, resetRolesCache } from '@/server/permissions/roles.js';
import { can } from '@/server/permissions/can.js';
import { createUser } from '@/server/services/users.service.js';
import { GET as rolesRoute } from '@/app/api/roles/route.js';
import { GET as auditRoute } from '@/app/api/audit-log/route.js';
import { call, makeUser } from './helpers.js';

// Each test starts with the default roles.
afterEach(() => resetRolesCache());

describe('roles in the database', () => {
  it('only the CEO manages roles; HR cannot give itself more rights', async () => {
    await seedRoles();
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const ceo = await makeUser({ roleKey: 'ceo' });
    expect((await call(rolesRoute, { user: hr })).status).toBe(403);
    expect((await call(rolesRoute, { user: ceo })).status).toBe(200);
  });

  it('a change takes effect for everyone with that role', async () => {
    await seedRoles();
    const ceo = await makeUser({ roleKey: 'ceo' });
    const auditor = await makeUser({ roleKey: 'auditor' });
    expect((await call(auditRoute, { user: auditor })).status).toBe(200);
    const { roles } = await listRoles(ceo);
    const permissions = {
      ...roles.find((role) => role.key === 'auditor').permissions,
      'audit.view': false,
    };
    await updateRole(ceo, 'auditor', { permissions });
    expect((await call(auditRoute, { user: auditor })).status).toBe(403);
  });

  it('the CEO role is locked and always has every permission', async () => {
    await seedRoles();
    const ceo = await makeUser({ roleKey: 'ceo' });
    await expect(updateRole(ceo, 'ceo', { permissions: {} })).rejects.toMatchObject({
      status: 403,
    });
    await loadRoles({ force: true });
    expect(can(ceo, 'roles.manage')).toBe(true);
    expect(can(ceo, 'salary.view')).toBe('all');
  });

  it('every default role can be saved back unchanged (team-scoped leave decisions too)', async () => {
    await seedRoles();
    const ceo = await makeUser({ roleKey: 'ceo' });
    const { roles } = await listRoles(ceo);
    for (const role of roles.filter((item) => !item.locked)) {
      await updateRole(ceo, role.key, { permissions: role.permissions });
    }
    const manager = await makeUser({ roleKey: 'manager' });
    await loadRoles({ force: true });
    expect(can(manager, 'leave.decide')).toBe('team');
  });

  it('refuses unknown permissions and wrong scopes', async () => {
    await seedRoles();
    const ceo = await makeUser({ roleKey: 'ceo' });
    await expect(
      updateRole(ceo, 'manager', { permissions: { 'payroll.run': true } }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateRole(ceo, 'manager', { permissions: { 'users.view': 'everyone' } }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('a new role can be copied from another and given to employees', async () => {
    await seedRoles();
    const ceo = await makeUser({ roleKey: 'ceo' });
    await addRole(ceo, { label: 'Field Supervisor', copyFrom: 'manager' });
    await loadRoles({ force: true });
    const person = await createUser(ceo, {
      name: 'New Supervisor',
      password: 'super-pass-1',
      roleKey: 'field_supervisor',
      staffType: 'Field Staff',
      expectedInTime: '09:30',
      expectedOutTime: '18:30',
    });
    expect(can(person, 'leave.decide')).toBe('team');
    await expect(
      createUser(ceo, {
        name: 'Nobody',
        password: 'nobody-pass',
        roleKey: 'no_such_role',
        staffType: 'Field Staff',
        expectedInTime: '09:30',
        expectedOutTime: '18:30',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
