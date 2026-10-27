import { withApi } from '@/server/api.js';
import { listRequestsQuery, requestBody } from '@/server/validation/schemas.js';
import { createRequest, listRequests } from '@/server/services/requests.service.js';

// GET /api/requests?box=mine|decide|all — the inbox. POST — send a request (always for oneself).
export const GET = withApi({ query: listRequestsQuery }, ({ user, query }) =>
  listRequests(user, query),
);

export const POST = withApi(
  { permission: 'requests.create', body: requestBody },
  async ({ user, body, ip }) => ({ request: await createRequest(user, body, { ip }) }),
);
