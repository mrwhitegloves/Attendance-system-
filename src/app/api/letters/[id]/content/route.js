import { withApi } from '@/server/api.js';
import { offerLetterBody } from '@/server/validation/schemas.js';
import { saveOfferContent } from '@/server/services/letters.service.js';

// PUT /api/letters/:id/content — save the edited content of an offer letter draft.
export const PUT = withApi(
  { permission: 'letters.manage', body: offerLetterBody },
  ({ user, params, body, ip }) => saveOfferContent(user, params.id, body, { ip }),
);
