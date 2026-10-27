import { withApi, parse, readJson } from '@/server/api.js';
import { fileBody, respondLetterBody } from '@/server/validation/schemas.js';
import { createAppError } from '@/server/lib/errors.js';
import {
  addSignedCopy,
  issueLetter,
  reissueLetter,
  respondToLetter,
} from '@/server/services/letters.service.js';

// POST /api/letters/:id/issue | respond | signed-copy | reissue
// The service checks who may do each action (the employee may respond to their own letter).
const ACTIONS = {
  issue: ({ user, params, ip }) => issueLetter(user, params.id, { ip }),
  reissue: async ({ user, params, ip }) => ({
    letter: await reissueLetter(user, params.id, { ip }),
  }),
  respond: async ({ request, user, params, ip }) =>
    respondToLetter(user, params.id, parse(respondLetterBody, await readJson(request)), { ip }),
  'signed-copy': async ({ request, user, params, ip }) =>
    addSignedCopy(user, params.id, parse(fileBody, await readJson(request)), { ip }),
};

export const POST = withApi({ permission: 'letters.view' }, (context) => {
  const action = ACTIONS[context.params.action];
  if (!action) throw createAppError(404, 'Unknown action.');
  return action(context);
});
