import { withApi } from '@/server/api.js';
import { createOfferLetter } from '@/server/services/letters.service.js';

// POST /api/candidates/:id/offer-letters — start an offer letter in the founder's format.
export const POST = withApi({ permission: 'recruitment.manage' }, async ({ user, params, ip }) => ({
  letter: await createOfferLetter(user, { candidateId: params.id }, { ip }),
}));
