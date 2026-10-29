import { withApi } from '@/server/api.js';
import { updateUserBody } from '@/server/validation/schemas.js';
import { getUser, updateUser } from '@/server/services/users.service.js';
import { deleteEmployee, deletePreview } from '@/server/services/employeeDelete.service.js';

// GET /api/users/:id — one employee (?deletePreview=1: what deleting would take with it).
// PATCH — edit (also the account status with `status`). DELETE — to Recently deleted.
export const GET = withApi({ permission: 'users.view' }, async ({ user, params, query }) =>
  query.deletePreview ? deletePreview(user, params.id) : { user: await getUser(user, params.id) },
);

export const PATCH = withApi(
  { permission: 'users.manage', body: updateUserBody },
  async ({ user, params, body, ip }) => ({ user: await updateUser(user, params.id, body, { ip }) }),
);

export const DELETE = withApi({ permission: 'users.manage' }, ({ user, params, ip }) =>
  deleteEmployee(user, params.id, { ip }),
);
