import { withApi } from '@/server/api.js';
import { onboardingTaskBody } from '@/server/validation/schemas.js';
import { setTask } from '@/server/services/onboarding.service.js';

// PATCH /api/users/:id/onboarding/tasks/:taskId — tick or untick one task.
export const PATCH = withApi(
  { permission: 'users.manage', body: onboardingTaskBody },
  async ({ user, params, body, ip }) => ({
    onboarding: await setTask(user, params.id, params.taskId, body, { ip }),
  }),
);
