import { withApi } from '@/server/api.js';
import { photoBody } from '@/server/validation/schemas.js';
import { setPhoto } from '@/server/services/users.service.js';

// POST /api/users/:id/photo — a new profile photo (saved in the private S3 bucket).
export const POST = withApi(
  { permission: 'users.manage', body: photoBody },
  async ({ user, params, body, ip }) => ({
    user: await setPhoto(user, params.id, body.photo, { ip }),
  }),
);
