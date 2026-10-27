import { withApi } from '@/server/api.js';
import { exitCloseBody } from '@/server/validation/schemas.js';
import { withdrawExit } from '@/server/services/exits.service.js';

// POST /api/users/:id/exits/current/withdraw — the resignation is taken back.
export const POST = withApi(
  { permission: 'exits.manage', body: exitCloseBody },
  async ({ user, params, body, ip }) => ({
    exit: await withdrawExit(user, params.id, body, { ip }),
  }),
);
