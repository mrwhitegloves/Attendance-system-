import { withApi } from '@/server/api.js';
import { decideLeaveBody } from '@/server/validation/schemas.js';
import { cancelLeave, decideLeave } from '@/server/services/leaves.service.js';

// PATCH /api/leaves/:id — approve or reject. DELETE — withdraw own pending request.
export const PATCH = withApi(
  { permission: 'leave.decide', body: decideLeaveBody },
  async ({ user, params, body, ip }) => ({
    leave: await decideLeave(user, params.id, body, { ip }),
  }),
);

export const DELETE = withApi({ permission: 'leave.request' }, async ({ user, params }) => ({
  leave: await cancelLeave(user, params.id),
}));
