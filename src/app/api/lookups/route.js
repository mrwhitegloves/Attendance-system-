import { withApi } from '@/server/api.js';
import { addLookupBody, lookupTypeQuery } from '@/server/validation/schemas.js';
import { addLookup, listLookups } from '@/server/services/lookups.service.js';
import { can } from '@/server/permissions/can.js';

// GET /api/lookups?type=department — one list (anyone signed in; switched-off items only for
// people who manage settings). POST — add an item.
export const GET = withApi({ query: lookupTypeQuery }, async ({ user, query }) => {
  const manager = Boolean(can(user, 'settings.manage'));
  return {
    items: await listLookups(query.type, { includeInactive: manager, withCounts: manager }),
  };
});

export const POST = withApi(
  { permission: 'settings.manage', body: addLookupBody },
  async ({ user, body, ip }) => ({ item: await addLookup(user, body, { ip }) }),
);
