import { withApi } from '@/server/api.js';
import { returnAssetBody } from '@/server/validation/schemas.js';
import { returnAsset } from '@/server/services/assets.service.js';

// POST /api/assets/:id/return — take an asset back (to stock, to repair, or recorded lost).
export const POST = withApi(
  { permission: 'assets.manage', body: returnAssetBody },
  async ({ user, params, body, ip }) => ({
    asset: await returnAsset(user, params.id, body, { ip }),
  }),
);
