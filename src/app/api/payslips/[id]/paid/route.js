import { withApi } from '@/server/api.js';
import { recordPaymentBody } from '@/server/validation/schemas.js';
import { recordPayment } from '@/server/services/payouts.service.js';

// POST /api/payslips/:id/paid — record that an approved salary was paid (date, mode, reference).
export const POST = withApi(
  { permission: 'payouts.manage', body: recordPaymentBody },
  async ({ user, params, body, ip }) => ({
    payout: await recordPayment(user, params.id, body, { ip }),
  }),
);
