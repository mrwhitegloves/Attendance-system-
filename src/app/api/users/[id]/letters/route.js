import { withApi } from '@/server/api.js';
import { createLetterBody } from '@/server/validation/schemas.js';
import { createLetter, listLettersFor } from '@/server/services/letters.service.js';

// GET /api/users/:id/letters — this employee's letters. POST — start a draft from a template.
export const GET = withApi({ permission: 'letters.view' }, ({ user, params }) =>
  listLettersFor(user, params.id),
);

export const POST = withApi(
  { permission: 'letters.manage', body: createLetterBody },
  async ({ user, params, body, ip }) => ({
    letter: await createLetter(user, params.id, body, { ip }),
  }),
);
