import { withApi } from '@/server/api.js';
import { leaveBody, listLeavesQuery } from '@/server/validation/schemas.js';
import { listLeaves, requestLeave } from '@/server/services/leaves.service.js';

// GET /api/leaves — requests in scope. POST — ask for leave (always for oneself).
export const GET = withApi(
  { permission: 'leave.view', query: listLeavesQuery },
  ({ user, query }) => listLeaves(user, query),
);

export const POST = withApi(
  { permission: 'leave.request', body: leaveBody },
  async ({ user, body }) => ({ leave: await requestLeave(user, body) }),
);
