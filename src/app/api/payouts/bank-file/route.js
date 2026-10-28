import { withApi } from '@/server/api.js';
import { bankFileQuery } from '@/server/validation/schemas.js';
import { bankFile } from '@/server/services/payouts.service.js';
import { csvResponse } from '@/server/lib/csv.js';

// GET /api/payouts/bank-file?month=2026-10 — the bank upload file of the approved salaries.
export const GET = withApi(
  { permission: 'payouts.manage', query: bankFileQuery },
  async ({ user, query, ip }) => {
    const file = await bankFile(user, query.month, { ip });
    return csvResponse(file.fileName, file.text);
  },
);
