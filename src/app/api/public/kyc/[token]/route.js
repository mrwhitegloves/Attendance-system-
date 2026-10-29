import { withApi } from '@/server/api.js';
import { kycSubmitBody } from '@/server/validation/schemas.js';
import { getPublicKyc, submitKyc } from '@/server/services/kycLinks.service.js';

// The employee's KYC form, without signing in (the link's token is the key).
// GET — what the form shows. POST — sends the form (once).
export const GET = withApi({ auth: false }, ({ params }) => getPublicKyc(params.token));

export const POST = withApi({ auth: false, body: kycSubmitBody }, ({ params, body, ip }) =>
  submitKyc(params.token, body, { ip }),
);
