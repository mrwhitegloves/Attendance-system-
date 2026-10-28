import { withApi } from '@/server/api.js';
import { shareReview } from '@/server/services/performance.service.js';

// POST /api/reviews/:id/share — show the review to the employee (the text is fixed after).
export const POST = withApi({ permission: 'performance.manage' }, async ({ user, params, ip }) => ({
  review: await shareReview(user, params.id, { ip }),
}));
