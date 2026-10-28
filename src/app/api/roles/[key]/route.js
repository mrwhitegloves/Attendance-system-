import { withApi } from '@/server/api.js';
import { updateRoleBody } from '@/server/validation/schemas.js';
import { updateRole } from '@/server/services/roles.service.js';

// PATCH /api/roles/:key — rename a role or change its permissions (the CEO role is locked).
export const PATCH = withApi(
  { permission: 'roles.manage', body: updateRoleBody },
  ({ user, params, body, ip }) => updateRole(user, params.key, body, { ip }),
);
