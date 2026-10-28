import { withApi } from '@/server/api.js';
import { listPayoutsQuery } from '@/server/validation/schemas.js';
import { payoutRegister } from '@/server/services/payouts.service.js';
import { csvResponse } from '@/server/lib/csv.js';

// GET /api/payouts/export — the payouts register as a CSV file for the CA (same filters).
export const GET = withApi({ query: listPayoutsQuery }, async ({ user, query, ip }) => {
  const file = await payoutRegister(user, query, { ip });
  return csvResponse(file.fileName, file.text);
});
