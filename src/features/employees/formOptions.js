import 'server-only';
import { ROLES } from '@/server/permissions/roles.js';
import { STAFF_TYPES } from '@/server/models/user.model.js';
import { listUserOptions } from '@/server/services/users.service.js';
import { toPlain } from '@/server/auth/current.js';

/** Choices for the employee form (roles, staff types, possible managers). */
export async function employeeFormOptions(actor) {
  return {
    roles: Object.entries(ROLES).map(([value, role]) => ({ value, label: role.label })),
    staffTypes: STAFF_TYPES,
    managers: toPlain(await listUserOptions(actor)),
    canGiveCeo: actor.roleKey === 'ceo',
  };
}
