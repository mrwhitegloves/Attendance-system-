import { withApi } from '@/server/api.js';
import { assetBody, listAssetsQuery } from '@/server/validation/schemas.js';
import { addAsset, listAssets } from '@/server/services/assets.service.js';

// GET /api/assets — assets in scope (an employee: their own). POST — add an asset to stock.
export const GET = withApi(
  { permission: 'assets.view', query: listAssetsQuery },
  ({ user, query }) => listAssets(user, query),
);

export const POST = withApi(
  { permission: 'assets.manage', body: assetBody },
  async ({ user, body, ip }) => ({ asset: await addAsset(user, body, { ip }) }),
);
