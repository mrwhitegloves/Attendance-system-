import { withApi } from '@/server/api.js';
import { listTrashQuery } from '@/server/validation/schemas.js';
import { listTrash } from '@/server/services/trash.service.js';

// GET /api/trash — Recently deleted (newest first).
export const GET = withApi(
  { permission: 'settings.manage', query: listTrashQuery },
  ({ user, query }) => listTrash(user, query),
);
