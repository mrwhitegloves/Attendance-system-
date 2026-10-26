import { withApi } from '@/server/api.js';
import { permissionsOf } from '@/server/services/users.service.js';
import { env } from '@/server/config/env.js';

// GET /api/auth/me — the signed-in person and what the screens may show them.
export const GET = withApi({}, async ({ user }) => ({
  user,
  permissions: permissionsOf(user),
  vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
}));
