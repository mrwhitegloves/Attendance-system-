import { withApi } from '@/server/api.js';
import { updateLookupBody } from '@/server/validation/schemas.js';
import { updateLookup } from '@/server/services/lookups.service.js';

// PATCH /api/lookups/:id — rename (every employee follows) or switch on/off. Never deleted.
export const PATCH = withApi(
  { permission: 'settings.manage', body: updateLookupBody },
  async ({ user, params, body, ip }) => ({
    item: await updateLookup(user, params.id, body, { ip }),
  }),
);
