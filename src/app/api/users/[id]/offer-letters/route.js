import { withApi } from '@/server/api.js';
import { createOfferLetter } from '@/server/services/letters.service.js';

// POST /api/users/:id/offer-letters — an offer letter in the founder's format for an employee.
export const POST = withApi({ permission: 'letters.manage' }, async ({ user, params, ip }) => ({
  letter: await createOfferLetter(user, { userId: params.id }, { ip }),
}));
