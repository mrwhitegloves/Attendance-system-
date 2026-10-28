import { withApi } from '@/server/api.js';
import { onboardingTaskBody } from '@/server/validation/schemas.js';
import { setExitTask } from '@/server/services/exits.service.js';

// PATCH /api/users/:id/exits/current/tasks/:taskId — tick or untick one exit task.
export const PATCH = withApi(
  { permission: 'exits.manage', body: onboardingTaskBody },
  async ({ user, params, body, ip }) => ({
    exit: await setExitTask(user, params.id, params.taskId, body, { ip }),
  }),
);
