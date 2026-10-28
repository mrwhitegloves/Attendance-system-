import { withApi } from '@/server/api.js';
import { recordPaymentBody } from '@/server/validation/schemas.js';
import { recordSettlementPayment } from '@/server/services/settlement.service.js';

// POST /api/users/:id/settlement/paid — record the payment (or the money recovered).
export const POST = withApi(
  { permission: 'payouts.manage', body: recordPaymentBody },
  ({ user, params, body, ip }) => recordSettlementPayment(user, params.id, body, { ip }),
);
