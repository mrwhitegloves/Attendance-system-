import { withApi } from '@/server/api.js';
import { reportQuery } from '@/server/validation/schemas.js';
import { buildReport } from '@/server/services/reports.service.js';
import { csvResponse } from '@/server/lib/csv.js';

// GET /api/reports/:report — one report as a CSV file (dates: ?range=… or ?month=…).
export const GET = withApi(
  { permission: 'reports.export', query: reportQuery },
  async ({ user, params, query, ip }) => {
    const file = await buildReport(user, params.report, query, { ip });
    return csvResponse(file.fileName, file.text);
  },
);
