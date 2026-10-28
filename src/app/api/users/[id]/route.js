import { withApi } from '@/server/api.js';
import { updateUserBody } from '@/server/validation/schemas.js';
import { getUser, updateUser } from '@/server/services/users.service.js';

// GET /api/users/:id — one employee. PATCH — edit (also the account status with `status`).
export const GET = withApi({ permission: 'users.view' }, async ({ user, params }) => ({
  user: await getUser(user, params.id),
}));

export const PATCH = withApi(
  { permission: 'users.manage', body: updateUserBody },
  async ({ user, params, body, ip }) => ({ user: await updateUser(user, params.id, body, { ip }) }),
);
