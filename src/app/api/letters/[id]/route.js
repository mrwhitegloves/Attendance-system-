import { withApi } from '@/server/api.js';
import { updateLetterBody } from '@/server/validation/schemas.js';
import { getLetter, updateDraft } from '@/server/services/letters.service.js';

// GET /api/letters/:id — the letter with its text. PATCH — change a draft.
export const GET = withApi({ permission: 'letters.view' }, ({ user, params }) =>
  getLetter(user, params.id),
);

export const PATCH = withApi(
  { permission: 'letters.manage', body: updateLetterBody },
  ({ user, params, body, ip }) => updateDraft(user, params.id, body, { ip }),
);
