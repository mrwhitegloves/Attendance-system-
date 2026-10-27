import { withApi } from '@/server/api.js';
import { listReviewsQuery } from '@/server/validation/schemas.js';
import { listReviews } from '@/server/services/performance.service.js';

// GET /api/reviews — performance reviews and improvement plans in scope.
export const GET = withApi(
  { permission: 'performance.view', query: listReviewsQuery },
  ({ user, query }) => listReviews(user, query),
);
