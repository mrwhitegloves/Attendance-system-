import { withApi } from '@/server/api.js';
import { linkOfferLetterBody } from '@/server/validation/schemas.js';
import { linkOfferToEmployee } from '@/server/services/offerLetters.service.js';

// POST /api/users/:id/offer-letter — links a candidate's offer letter to this employee.
export const POST = withApi(
  { permission: 'letters.manage', body: linkOfferLetterBody },
  ({ user, params, body, ip }) => linkOfferToEmployee(user, body.offerLetterId, params.id, { ip }),
);
