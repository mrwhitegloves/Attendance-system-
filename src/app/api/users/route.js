import { withApi } from '@/server/api.js';
import { createUserBody, listUsersQuery } from '@/server/validation/schemas.js';
import { createUser, listUsers } from '@/server/services/users.service.js';

// GET /api/users — employees in the person's scope. POST — add an employee.
export const GET = withApi({ permission: 'users.view', query: listUsersQuery }, ({ user, query }) =>
  listUsers(user, query),
);

export const POST = withApi(
  { permission: 'users.manage', body: createUserBody },
  async ({ user, body, ip }) => ({ user: await createUser(user, body, { ip }) }),
);
