import { withApi } from '@/server/api.js';
import { candidateBody, listCandidatesQuery } from '@/server/validation/schemas.js';
import { addCandidate, listCandidates } from '@/server/services/recruitment.service.js';

// GET /api/candidates — people HR wants to hire. POST — add one.
export const GET = withApi(
  { permission: 'recruitment.view', query: listCandidatesQuery },
  ({ user, query }) => listCandidates(user, query),
);

export const POST = withApi(
  { permission: 'recruitment.manage', body: candidateBody },
  async ({ user, body, ip }) => ({ candidate: await addCandidate(user, body, { ip }) }),
);
