import { withApi } from '@/server/api.js';
import { approvePayoutsBody } from '@/server/validation/schemas.js';
import { approvePayouts } from '@/server/services/payouts.service.js';

// POST /api/payouts/approve — the CEO approves the payment of final salary slips.
export const POST = withApi(
  { permission: 'payouts.approve', body: approvePayoutsBody },
  ({ user, body, ip }) => approvePayouts(user, body.ids, { ip }),
);
