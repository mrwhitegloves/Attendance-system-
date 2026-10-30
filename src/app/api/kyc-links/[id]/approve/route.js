import { withApi } from '@/server/api.js';
import { approveKyc } from '@/server/services/kycLinks.service.js';

// POST /api/kyc-links/:id/approve — HR approves the sent form: it is written into the file.
export const POST = withApi({ permission: 'kyc.verify' }, ({ user, params, ip }) =>
  approveKyc(user, params.id, { ip }),
);
