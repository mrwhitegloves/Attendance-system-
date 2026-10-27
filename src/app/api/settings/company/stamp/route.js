import { withApi } from '@/server/api.js';
import { photoBody } from '@/server/validation/schemas.js';
import { setCompanyStamp } from '@/server/services/settings.service.js';

// POST /api/settings/company/stamp — the "Authorised Signatory" stamp printed on salary slips.
export const POST = withApi(
  { permission: 'settings.manage', body: photoBody },
  async ({ user, body, ip }) => ({ company: await setCompanyStamp(user, body.photo, { ip }) }),
);
