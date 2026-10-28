import { withApi } from '@/server/api.js';
import { leaveBalanceBody } from '@/server/validation/schemas.js';
import { adjustLeaveBalance, getLeaveBalance } from '@/server/services/leaveRules.service.js';

// GET /api/users/:id/leave-balance — paid leave balance and its entries.
// POST — HR gives (or takes back) paid leave days.
export const GET = withApi({ permission: 'leave.view' }, ({ user, params }) =>
  getLeaveBalance(user, params.id),
);

export const POST = withApi(
  { permission: 'users.manage', body: leaveBalanceBody },
  ({ user, params, body, ip }) => adjustLeaveBalance(user, params.id, body, { ip }),
);
