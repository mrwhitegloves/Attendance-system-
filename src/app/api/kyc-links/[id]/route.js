import { withApi } from '@/server/api.js';
import { closeKycLink } from '@/server/services/kycLinks.service.js';

// DELETE /api/kyc-links/:id — closes an open link (it stops working; the record stays).
export const DELETE = withApi({ permission: 'users.manage' }, ({ user, params, ip }) =>
  closeKycLink(user, params.id, { ip }),
);
