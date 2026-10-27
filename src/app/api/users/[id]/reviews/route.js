import { withApi } from '@/server/api.js';
import { reviewBody } from '@/server/validation/schemas.js';
import { createReview } from '@/server/services/performance.service.js';

// POST /api/users/:id/reviews — draft a review or improvement plan for the employee.
export const POST = withApi(
  { permission: 'performance.manage', body: reviewBody },
  async ({ user, params, body, ip }) => ({
    review: await createReview(user, params.id, body, { ip }),
  }),
);
