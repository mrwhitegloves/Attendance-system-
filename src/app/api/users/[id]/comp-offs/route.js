import { withApi } from '@/server/api.js';
import { compOffBody } from '@/server/validation/schemas.js';
import { addCompOff, listCompOffs } from '@/server/services/leaveRules.service.js';

// GET /api/users/:id/comp-offs — Sundays worked and the days off for them.
// POST — record one (the day off becomes a paid day).
export const GET = withApi({ permission: 'leave.view' }, async ({ user, params }) => ({
  items: await listCompOffs(user, params.id),
}));

export const POST = withApi(
  { permission: 'leave.decide', body: compOffBody },
  async ({ user, params, body, ip }) => ({
    compOff: await addCompOff(user, params.id, body, { ip }),
  }),
);
