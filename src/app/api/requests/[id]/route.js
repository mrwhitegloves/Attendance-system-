import { withApi } from '@/server/api.js';
import { getRequest } from '@/server/services/requests.service.js';

// GET /api/requests/:id — one request (own, or in scope), with signed links to its files.
export const GET = withApi({}, async ({ user, params }) => ({
  request: await getRequest(user, params.id),
}));
