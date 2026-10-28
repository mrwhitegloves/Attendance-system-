import { withApi } from '@/server/api.js';
import { listPayoutsQuery } from '@/server/validation/schemas.js';
import { listPayouts } from '@/server/services/payouts.service.js';

// GET /api/payouts — final salary slips and their payment, with the totals of the filter.
export const GET = withApi({ query: listPayoutsQuery }, ({ user, query }) =>
  listPayouts(user, query),
);
