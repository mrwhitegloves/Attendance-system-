import { withApi } from '@/server/api.js';
import { revealPassword } from '@/server/services/users.service.js';

// GET /api/users/:id/password — shows the password on an explicit click (audited).
export const GET = withApi({ permission: 'users.password' }, ({ user, params, ip }) =>
  revealPassword(user, params.id, { ip }),
);
