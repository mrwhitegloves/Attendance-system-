import { withApi } from '@/server/api.js';
import { listOnboardingsQuery } from '@/server/validation/schemas.js';
import { listOnboardings } from '@/server/services/onboarding.service.js';

// GET /api/onboarding — joining checklists in scope, with progress.
export const GET = withApi(
  { permission: 'users.view', query: listOnboardingsQuery },
  ({ user, query }) => listOnboardings(user, query),
);
