import { withApi } from '@/server/api.js';
import { exitCloseBody } from '@/server/validation/schemas.js';
import { completeExit } from '@/server/services/exits.service.js';

// POST /api/users/:id/exits/current/complete — close the exit; the account is deactivated.
export const POST = withApi(
  { permission: 'exits.manage', body: exitCloseBody },
  async ({ user, params, body, ip }) => ({
    exit: await completeExit(user, params.id, body, { ip }),
  }),
);
