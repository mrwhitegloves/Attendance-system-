import { withApi } from '@/server/api.js';
import { restoreFromTrash } from '@/server/services/trash.service.js';

// POST /api/trash/:id/restore — puts the records back where they were.
export const POST = withApi({ permission: 'settings.manage' }, ({ user, params, ip }) =>
  restoreFromTrash(user, params.id, { ip }),
);
