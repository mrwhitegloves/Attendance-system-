import { withApi } from '@/server/api.js';
import { decideRequestBody } from '@/server/validation/schemas.js';
import { decideRequest } from '@/server/services/requests.service.js';

// POST /api/requests/:id/decide — approve (or resolve, mark done) or reject (close).
export const POST = withApi(
  { permission: 'requests.decide', body: decideRequestBody },
  async ({ user, params, body, ip }) => ({
    request: await decideRequest(user, params.id, body, { ip }),
  }),
);
