import 'server-only';
import { roleOptions } from '@/server/permissions/roles.js';
import { STAFF_TYPES } from '@/config/employeeOptions.js';
import { listUserOptions } from '@/server/services/users.service.js';
import { allLookups } from '@/server/services/lookups.service.js';
import { can } from '@/server/permissions/can.js';
import { toPlain } from '@/server/auth/current.js';

/** Choices for the employee form (roles, staff types, managers, the managed lists). */
export async function employeeFormOptions(actor) {
  const [managers, lists] = await Promise.all([listUserOptions(actor), allLookups()]);
  return {
    roles: roleOptions(),
    staffTypes: STAFF_TYPES,
    managers: toPlain(managers),
    lists,
    canGiveCeo: actor.roleKey === 'ceo',
    canManageLists: Boolean(can(actor, 'settings.manage')),
    canLinkOffer: Boolean(can(actor, 'letters.manage')),
  };
}
