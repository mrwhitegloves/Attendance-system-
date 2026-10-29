import { withApi } from '@/server/api.js';
import { kycFileBody } from '@/server/validation/schemas.js';
import { uploadKycFile } from '@/server/services/kycLinks.service.js';

// POST /api/public/kyc/:token/files — one file of the KYC form (at most 3 MB; photo 2 MB).
export const POST = withApi({ auth: false, body: kycFileBody }, ({ params, body }) =>
  uploadKycFile(params.token, body),
);
