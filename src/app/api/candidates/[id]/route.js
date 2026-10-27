import { withApi } from '@/server/api.js';
import { candidateUpdateBody } from '@/server/validation/schemas.js';
import { getCandidate, updateCandidate } from '@/server/services/recruitment.service.js';

// GET /api/candidates/:id — the candidate with their letters. PATCH — edit an open candidate.
export const GET = withApi({ permission: 'recruitment.view' }, ({ user, params }) =>
  getCandidate(user, params.id),
);

export const PATCH = withApi(
  { permission: 'recruitment.manage', body: candidateUpdateBody },
  async ({ user, params, body, ip }) => ({
    candidate: await updateCandidate(user, params.id, body, { ip }),
  }),
);
