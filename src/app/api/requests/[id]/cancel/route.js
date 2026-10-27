import { withApi } from '@/server/api.js';
import { cancelRequest } from '@/server/services/requests.service.js';

// POST /api/requests/:id/cancel — the employee withdraws their own waiting request.
export const POST = withApi({}, async ({ user, params, ip }) => ({
  request: await cancelRequest(user, params.id, { ip }),
}));
