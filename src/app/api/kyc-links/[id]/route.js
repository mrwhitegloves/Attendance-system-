import { withApi } from '@/server/api.js';
import { closeKycLink, deleteKycLink } from '@/server/services/kycLinks.service.js';

// POST /api/kyc-links/:id — closes an open link (it stops working; the record stays).
// DELETE — moves the link to Recently deleted.
export const POST = withApi({ permission: 'users.manage' }, ({ user, params, ip }) =>
  closeKycLink(user, params.id, { ip }),
);

export const DELETE = withApi({ permission: 'users.manage' }, ({ user, params, ip }) =>
  deleteKycLink(user, params.id, { ip }),
);
