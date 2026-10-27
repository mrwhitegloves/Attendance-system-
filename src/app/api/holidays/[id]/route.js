import { withApi } from '@/server/api.js';
import { removeHoliday } from '@/server/services/leaveRules.service.js';

// DELETE /api/holidays/:id — remove a holiday added by mistake (audited).
export const DELETE = withApi({ permission: 'settings.manage' }, ({ user, params, ip }) =>
  removeHoliday(user, params.id, { ip }),
);
