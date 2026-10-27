import { withApi } from '@/server/api.js';
import { getKyc } from '@/server/services/kyc.service.js';

// GET /api/users/:id/kyc — PAN, Aadhaar and bank status with masked numbers and proof links.
export const GET = withApi({ permission: 'kyc.view' }, ({ user, params }) =>
  getKyc(user, params.id),
);
