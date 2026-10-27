import { Role } from '../models/role.model.js';
import { User } from '../models/user.model.js';
import {
  DEFAULT_ROLES,
  PERMISSIONS,
  SCOPES,
  isScoped,
  loadRoles,
  resetRolesCache,
} from '../permissions/roles.js';
import { requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { recordAudit } from './audit.service.js';

// Settings → Roles and permissions (CEO only). The CEO role is locked; roles are never deleted.

export async function seedRoles() {
  if (await Role.exists({})) return;
  await Role.insertMany(
    Object.entries(DEFAULT_ROLES).map(([key, role]) => ({
      key,
      label: role.label,
      locked: Boolean(role.locked),
      permissions: role.permissions,
    })),
  );
  resetRolesCache();
}

/** Every role with its permissions and how many active people have it. */
export async function listRoles(actor) {
  requirePermission(actor, 'roles.manage');
  const roles = await loadRoles({ force: true });
  const counts = await User.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$roleKey', count: { $sum: 1 } } },
  ]);
  const countOf = Object.fromEntries(counts.map((row) => [row._id, row.count]));
  return {
    roles: Object.entries(roles).map(([key, role]) => ({
      key,
      label: role.label,
      locked: Boolean(role.locked),
      permissions: role.permissions,
      people: countOf[key] ?? 0,
    })),
    permissions: Object.entries(PERMISSIONS).map(([key, label]) => ({
      key,
      label,
      scoped: isScoped(key),
    })),
  };
}

/** Only known permissions, with valid values (a scope for ".view", true for actions). */
function cleanPermissions(input) {
  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    if (!PERMISSIONS[key]) throw createAppError(400, `Unknown permission "${key}".`);
    if (value === false || value === null || value === '') continue;
    if (isScoped(key)) {
      if (!SCOPES.includes(value)) throw createAppError(400, `${key}: choose own, team or all.`);
      clean[key] = value;
    } else {
      if (value !== true) throw createAppError(400, `${key}: must be on or off.`);
      clean[key] = true;
    }
  }
  return clean;
}

export async function updateRole(actor, key, { label, permissions }, { ip } = {}) {
  requirePermission(actor, 'roles.manage');
  await seedRoles();
  const role = await Role.findOne({ key }).lean();
  if (!role) throw notFound('Role');
  if (role.locked)
    throw createAppError(403, 'The CEO role always has every permission and cannot be changed.');
  const set = {};
  if (label) set.label = label;
  if (permissions) set.permissions = cleanPermissions(permissions);
  await Role.updateOne({ key }, { $set: set });
  resetRolesCache();
  const before = role.permissions ?? {};
  const after = set.permissions ?? before;
  const changed = Object.keys(PERMISSIONS).filter(
    (perm) => (before[perm] || false) !== (after[perm] || false),
  );
  await recordAudit(actor, {
    action: 'role.updated',
    entity: 'role',
    entityId: key,
    summary: `${role.label}: ${changed.map((perm) => `${perm} ${before[perm] || 'off'} → ${after[perm] || 'off'}`).join(', ') || 'name changed'}`,
    ip,
  });
  return listRoles(actor);
}

export async function addRole(actor, { label, copyFrom }, { ip } = {}) {
  requirePermission(actor, 'roles.manage');
  await seedRoles();
  const key =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 30) || 'role';
  if (await Role.exists({ key }))
    throw createAppError(409, `A role named "${label}" already exists.`);
  const source = copyFrom ? await Role.findOne({ key: copyFrom }).lean() : null;
  if (source?.locked) throw createAppError(400, 'Copy from a role other than the CEO.');
  await Role.create({ key, label, permissions: source?.permissions ?? {} });
  resetRolesCache();
  await recordAudit(actor, {
    action: 'role.added',
    entity: 'role',
    entityId: key,
    summary: `${label}${source ? ` (copied from ${source.label})` : ''}`,
    ip,
  });
  return listRoles(actor);
}
