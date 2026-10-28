import { withApi } from '@/server/api.js';
import { addRoleBody } from '@/server/validation/schemas.js';
import { addRole, listRoles } from '@/server/services/roles.service.js';

// GET /api/roles — every role and permission (CEO only). POST — add a role.
export const GET = withApi({ permission: 'roles.manage' }, ({ user }) => listRoles(user));

export const POST = withApi(
  { permission: 'roles.manage', body: addRoleBody },
  ({ user, body, ip }) => addRole(user, body, { ip }),
);
