import { withApi } from '@/server/api.js';
import { joinCandidateBody } from '@/server/validation/schemas.js';
import { joinCandidate } from '@/server/services/recruitment.service.js';

// POST /api/candidates/:id/join — the candidate joins: the employee is made from the candidate.
export const POST = withApi(
  { permission: 'recruitment.manage', body: joinCandidateBody },
  async ({ user, params, body, ip }) => ({
    employee: await joinCandidate(user, params.id, body, { ip }),
  }),
);
