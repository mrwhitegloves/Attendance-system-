import { withApi } from '@/server/api.js';
import { getMyDay } from '@/server/services/attendance.service.js';

// GET /api/attendance/today — the signed-in person's own day and next punch.
export const GET = withApi({ permission: 'attendance.punch' }, ({ user }) => getMyDay(user));
