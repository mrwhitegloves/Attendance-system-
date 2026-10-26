import { withApi } from '@/server/api.js';
import { env } from '@/server/config/env.js';
import { createAppError } from '@/server/lib/errors.js';
import {
  cleanupOldImageKitSelfies,
  markMissedPunchOuts,
} from '@/server/services/attendance.service.js';

// GET /api/cron/daily — daily jobs, called by the server's cron with
// "Authorization: Bearer <CRON_SECRET>".
export const GET = withApi({ auth: false }, async ({ request }) => {
  if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    throw createAppError(401, 'Not allowed.');
  }
  return {
    missedPunchOuts: await markMissedPunchOuts(),
    oldSelfies: await cleanupOldImageKitSelfies(),
  };
});
