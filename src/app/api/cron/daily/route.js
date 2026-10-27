import { withApi } from '@/server/api.js';
import { env } from '@/server/config/env.js';
import { createAppError } from '@/server/lib/errors.js';
import { cleanupOldImageKitSelfies } from '@/server/services/attendance.service.js';

// GET /api/cron/daily — daily jobs, called by the server's cron with
// "Authorization: Bearer <CRON_SECRET>". Missed punch-outs are NOT marked Absent (CEO rule).
export const GET = withApi({ auth: false }, async ({ request }) => {
  if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    throw createAppError(401, 'Not allowed.');
  }
  return { oldSelfies: await cleanupOldImageKitSelfies() };
});
