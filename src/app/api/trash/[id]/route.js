import { withApi } from '@/server/api.js';
import { deleteForever } from '@/server/services/trash.service.js';

// DELETE /api/trash/:id — removes an item for good before its 90 days are over.
export const DELETE = withApi({ permission: 'settings.manage' }, ({ user, params, ip }) =>
  deleteForever(user, params.id, { ip }),
);
