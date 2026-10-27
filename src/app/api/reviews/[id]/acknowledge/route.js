import { withApi } from '@/server/api.js';
import { acknowledgeReviewBody } from '@/server/validation/schemas.js';
import { acknowledgeReview } from '@/server/services/performance.service.js';

// POST /api/reviews/:id/acknowledge — the employee has read it (with an optional comment).
export const POST = withApi(
  { permission: 'performance.view', body: acknowledgeReviewBody },
  async ({ user, params, body, ip }) => ({
    review: await acknowledgeReview(user, params.id, body, { ip }),
  }),
);
