import { withApi, parse } from '@/server/api.js';
import { kycItemParam } from '@/server/validation/schemas.js';
import { revealKycNumber } from '@/server/services/kyc.service.js';

// GET /api/users/:id/kyc/:item/reveal — the full PAN or account number (explicit click, audited).
export const GET = withApi({ permission: 'kyc.reveal' }, ({ user, params, ip }) =>
  revealKycNumber(user, params.id, parse(kycItemParam, params.item), { ip }),
);
