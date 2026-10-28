import { withApi } from '@/server/api.js';
import { assignAssetBody } from '@/server/validation/schemas.js';
import { assignAsset } from '@/server/services/assets.service.js';

// POST /api/assets/:id/assign — hand an asset in stock to an active employee.
export const POST = withApi(
  { permission: 'assets.manage', body: assignAssetBody },
  async ({ user, params, body, ip }) => ({
    asset: await assignAsset(user, params.id, body, { ip }),
  }),
);
