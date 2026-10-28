import { withApi } from '@/server/api.js';
import { exitBody } from '@/server/validation/schemas.js';
import { exitsOf, startExit } from '@/server/services/exits.service.js';

// GET /api/users/:id/exits — the employee's exits (open one first). POST — start an exit.
export const GET = withApi({ permission: 'exits.view' }, async ({ user, params }) => ({
  items: await exitsOf(user, params.id),
}));

export const POST = withApi(
  { permission: 'exits.manage', body: exitBody },
  async ({ user, params, body, ip }) => ({ exit: await startExit(user, params.id, body, { ip }) }),
);
