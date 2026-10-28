import { withApi } from '@/server/api.js';
import { reviewUpdateBody } from '@/server/validation/schemas.js';
import { getReview, updateReview } from '@/server/services/performance.service.js';

// GET /api/reviews/:id — one review. PATCH — change a draft, or a plan's outcome.
export const GET = withApi({ permission: 'performance.view' }, async ({ user, params }) => ({
  review: await getReview(user, params.id),
}));

export const PATCH = withApi(
  { permission: 'performance.manage', body: reviewUpdateBody },
  async ({ user, params, body, ip }) => ({
    review: await updateReview(user, params.id, body, { ip }),
  }),
);
