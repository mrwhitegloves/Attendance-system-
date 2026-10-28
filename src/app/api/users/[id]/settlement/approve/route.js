import { withApi } from '@/server/api.js';
import { approveSettlement } from '@/server/services/settlement.service.js';

// POST /api/users/:id/settlement/approve — the CEO approves the full and final.
export const POST = withApi({ permission: 'payouts.approve' }, ({ user, params, ip }) =>
  approveSettlement(user, params.id, { ip }),
);
