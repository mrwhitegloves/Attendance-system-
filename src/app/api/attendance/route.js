import { withApi } from '@/server/api.js';
import { listAttendanceQuery, punchBody } from '@/server/validation/schemas.js';
import { listAttendance, punch } from '@/server/services/attendance.service.js';

// GET /api/attendance — records in scope with filters.
// POST — punch in or out; the time is set by the server.
export const GET = withApi(
  { permission: 'attendance.view', query: listAttendanceQuery },
  ({ user, query }) => listAttendance(user, query),
);

export const POST = withApi(
  { permission: 'attendance.punch', body: punchBody },
  async ({ user, body }) => ({ record: await punch(user, body) }),
);
