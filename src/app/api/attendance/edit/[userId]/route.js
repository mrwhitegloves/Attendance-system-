import { withApi } from '@/server/api.js';
import { editAttendanceBody } from '@/server/validation/schemas.js';
import { editAttendanceDay } from '@/server/services/attendanceEdits.service.js';

// POST /api/attendance/edit/:userId — HR or the CEO sets the punch times of one day, with a reason.
export const POST = withApi(
  { permission: 'attendance.edit', body: editAttendanceBody },
  ({ user, params, body, ip }) => editAttendanceDay(user, params.userId, body, { ip }),
);
