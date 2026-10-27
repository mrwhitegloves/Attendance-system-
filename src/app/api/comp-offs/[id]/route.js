import { withApi } from '@/server/api.js';
import { removeCompOff } from '@/server/services/leaveRules.service.js';

// DELETE /api/comp-offs/:id — remove a comp-off recorded by mistake (audited).
export const DELETE = withApi({ permission: 'leave.decide' }, ({ user, params, ip }) =>
  removeCompOff(user, params.id, { ip }),
);
