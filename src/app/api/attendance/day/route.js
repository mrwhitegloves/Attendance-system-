import { withApi } from '@/server/api.js';
import { dayQuery } from '@/server/validation/schemas.js';
import { getDailySheet } from '@/server/services/attendance.service.js';

// GET /api/attendance/day?date= — everyone in scope on one day.
export const GET = withApi({ permission: 'attendance.view', query: dayQuery }, ({ user, query }) =>
  getDailySheet(user, query.date),
);
