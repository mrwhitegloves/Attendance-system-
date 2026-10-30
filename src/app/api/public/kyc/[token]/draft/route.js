import { withApi } from '@/server/api.js';
import { kycDraftBody } from '@/server/validation/schemas.js';
import { saveKycDraft } from '@/server/services/kycLinks.service.js';

// PUT /api/public/kyc/:token/draft — saves what the employee typed so far (no sign-in).
export const PUT = withApi({ auth: false, body: kycDraftBody }, ({ params, body }) =>
  saveKycDraft(params.token, body),
);
