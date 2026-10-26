import { withApi } from '@/server/api.js';
import { listUserOptions } from '@/server/services/users.service.js';

// GET /api/users/options — short list (id, name, employee ID) for pickers.
export const GET = withApi({ permission: 'users.view' }, async ({ user }) => ({
  items: await listUserOptions(user),
}));
