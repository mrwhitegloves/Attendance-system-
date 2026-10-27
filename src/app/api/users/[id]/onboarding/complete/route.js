import { withApi } from '@/server/api.js';
import { completeOnboarding } from '@/server/services/onboarding.service.js';

// POST /api/users/:id/onboarding/complete — confirm the joining (everything must be done).
export const POST = withApi({ permission: 'users.manage' }, async ({ user, params, ip }) => ({
  onboarding: await completeOnboarding(user, params.id, { ip }),
}));
