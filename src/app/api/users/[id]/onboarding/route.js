import { withApi } from '@/server/api.js';
import { getOnboarding, startOnboarding } from '@/server/services/onboarding.service.js';

// GET /api/users/:id/onboarding — the joining checklist (null when not started).
// POST — start it with the tasks in Settings → Lists.
export const GET = withApi({ permission: 'users.view' }, async ({ user, params }) => ({
  onboarding: await getOnboarding(user, params.id),
}));

export const POST = withApi({ permission: 'users.manage' }, async ({ user, params, ip }) => ({
  onboarding: await startOnboarding(user, params.id, { ip }),
}));
