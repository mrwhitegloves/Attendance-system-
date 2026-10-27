import { withApi } from '@/server/api.js';
import { createLetterBody } from '@/server/validation/schemas.js';
import { createCandidateLetter } from '@/server/services/letters.service.js';

// POST /api/candidates/:id/letters — draft an offer letter for the candidate from a template.
export const POST = withApi(
  { permission: 'recruitment.manage', body: createLetterBody },
  async ({ user, params, body, ip }) => ({
    letter: await createCandidateLetter(user, params.id, body, { ip }),
  }),
);
