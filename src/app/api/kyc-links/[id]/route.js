import { withApi } from '@/server/api.js';
import {
  closeKycLink,
  deleteKycLink,
  getKycSubmission,
} from '@/server/services/kycLinks.service.js';

// GET /api/kyc-links/:id — the sent form for HR's review.
// POST /api/kyc-links/:id — closes an open link (it stops working; the record stays).
// DELETE — moves the link to Recently deleted.
export const POST = withApi({ permission: 'users.manage' }, ({ user, params, ip }) =>
  closeKycLink(user, params.id, { ip }),
);

export const DELETE = withApi({ permission: 'users.manage' }, ({ user, params, ip }) =>
  deleteKycLink(user, params.id, { ip }),
);

export const GET = withApi({ permission: 'kyc.verify' }, ({ user, params, ip }) =>
  getKycSubmission(user, params.id, { ip }),
);
