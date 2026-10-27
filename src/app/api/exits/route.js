import { withApi } from '@/server/api.js';
import { listExitsQuery } from '@/server/validation/schemas.js';
import { listExits } from '@/server/services/exits.service.js';

// GET /api/exits — exits in scope (open ones by default).
export const GET = withApi({ permission: 'exits.view', query: listExitsQuery }, ({ user, query }) =>
  listExits(user, query),
);
