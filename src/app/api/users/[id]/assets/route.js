import { withApi } from '@/server/api.js';
import { assetsWith } from '@/server/services/assets.service.js';

// GET /api/users/:id/assets — what the employee has now.
export const GET = withApi({ permission: 'assets.view' }, async ({ user, params }) => ({
  items: await assetsWith(user, params.id),
}));
