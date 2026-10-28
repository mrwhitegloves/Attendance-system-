import { withApi, parse } from '@/server/api.js';
import { fileBody, kycItemParam } from '@/server/validation/schemas.js';
import { addKycProof } from '@/server/services/kyc.service.js';

// POST /api/users/:id/kyc/:item/proof — upload a proof file (PDF or photo, at most 3 MB).
export const POST = withApi(
  { permission: 'kyc.manage', body: fileBody },
  ({ user, params, body, ip }) =>
    addKycProof(user, params.id, parse(kycItemParam, params.item), body, { ip }),
);
