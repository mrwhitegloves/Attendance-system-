import { withApi } from '@/server/api.js';
import { monthQuery } from '@/server/validation/schemas.js';
import { getMonthCalendar } from '@/server/services/attendance.service.js';

// GET /api/attendance/calendar/:userId?month= — one person's month.
export const GET = withApi(
  { permission: 'attendance.view', query: monthQuery },
  ({ user, params, query }) => getMonthCalendar(user, params.userId, query.month),
);
