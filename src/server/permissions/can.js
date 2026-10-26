import { ROLES } from './roles.js';
import { User } from '../models/user.model.js';
import { createAppError } from '../lib/errors.js';

/**
 * What the person may do: false, true, or a scope ('all' | 'team' | 'own').
 * @param {{ roleKey: string, status: string }} user
 * @param {string} permission
 */
export function can(user, permission) {
  if (!user || user.status !== 'active') return false;
  return ROLES[user.roleKey]?.permissions?.[permission] || false;
}

/** Throws 403 unless the person has the permission. Returns the scope. */
export function requirePermission(user, permission) {
  const allowed = can(user, permission);
  if (!allowed) throw createAppError(403, 'You do not have access to this.');
  return allowed;
}

/** The employee IDs ("MWG-001") a person may see under a permission, or null for everyone. */
export async function visibleEmployeeIds(user, permission) {
  const scope = requirePermission(user, permission);
  if (scope === 'all' || scope === true) return null;
  if (scope === 'own') return [user.employeeId];
  const team = await User.find({ managerId: user._id }, 'employeeId').lean();
  return [user.employeeId, ...team.map((member) => member.employeeId)];
}

/** A Mongo filter on `employeeId` for the person's scope ({} for everyone). */
export async function employeeScopeFilter(user, permission, field = 'employeeId') {
  const ids = await visibleEmployeeIds(user, permission);
  return ids === null ? {} : { [field]: { $in: ids } };
}

/** True if the person may see the given employee under a permission. */
export async function canSeeEmployee(user, permission, employeeId) {
  const ids = await visibleEmployeeIds(user, permission);
  return ids === null || ids.includes(employeeId);
}
