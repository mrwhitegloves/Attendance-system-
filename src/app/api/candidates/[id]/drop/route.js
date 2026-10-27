import { withApi } from '@/server/api.js';
import { dropCandidateBody } from '@/server/validation/schemas.js';
import { dropCandidate } from '@/server/services/recruitment.service.js';

// POST /api/candidates/:id/drop — the candidate will not join (kept with the reason).
export const POST = withApi(
  { permission: 'recruitment.manage', body: dropCandidateBody },
  async ({ user, params, body, ip }) => ({
    candidate: await dropCandidate(user, params.id, body, { ip }),
  }),
);
