import { withApi } from '@/server/api.js';
import { assetUpdateBody } from '@/server/validation/schemas.js';
import { getAsset, updateAsset } from '@/server/services/assets.service.js';

// GET /api/assets/:id — one asset with its history. PATCH — edit, or change the status while
// nobody has it.
export const GET = withApi({ permission: 'assets.view' }, async ({ user, params }) => ({
  asset: await getAsset(user, params.id),
}));

export const PATCH = withApi(
  { permission: 'assets.manage', body: assetUpdateBody },
  async ({ user, params, body, ip }) => ({
    asset: await updateAsset(user, params.id, body, { ip }),
  }),
);
