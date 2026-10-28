import { withApi } from '@/server/api.js';
import { exitUpdateBody } from '@/server/validation/schemas.js';
import { updateExit } from '@/server/services/exits.service.js';

// PATCH /api/users/:id/exits/current — change the last working day or reason of the open exit.
export const PATCH = withApi(
  { permission: 'exits.manage', body: exitUpdateBody },
  async ({ user, params, body, ip }) => ({ exit: await updateExit(user, params.id, body, { ip }) }),
);
