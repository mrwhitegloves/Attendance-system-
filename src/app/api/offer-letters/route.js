import { withApi } from '@/server/api.js';
import { listOfferLettersQuery, startOfferLetterBody } from '@/server/validation/schemas.js';
import { listOfferLetters, startOfferLetter } from '@/server/services/offerLetters.service.js';

// GET /api/offer-letters — offer letters in use (?unlinked=1: candidates' letters for Add
// employee). POST — a new offer letter from a name and phone (one per phone).
export const GET = withApi(
  { permission: 'letters.manage', query: listOfferLettersQuery },
  ({ user, query }) => listOfferLetters(user, query),
);

export const POST = withApi(
  { permission: 'letters.manage', body: startOfferLetterBody },
  async ({ user, body, ip }) => ({ letter: await startOfferLetter(user, body, { ip }) }),
);
