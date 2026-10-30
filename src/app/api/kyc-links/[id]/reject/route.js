import { withApi } from '@/server/api.js';
import { rejectKycBody } from '@/server/validation/schemas.js';
import { rejectKyc } from '@/server/services/kycLinks.service.js';

// POST /api/kyc-links/:id/reject — HR sends the form back with a reason; the link opens again.
export const POST = withApi(
  { permission: 'kyc.verify', body: rejectKycBody },
  ({ user, params, body, ip }) => rejectKyc(user, params.id, body, { ip }),
);
