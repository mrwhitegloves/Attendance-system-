import { withApi } from '@/server/api.js';
import { companyBody } from '@/server/validation/schemas.js';
import { getCompany, updateCompany } from '@/server/services/settings.service.js';

// GET /api/settings/company — details printed on letters. PATCH — change them.
export const GET = withApi({ permission: 'settings.manage' }, async () => ({
  company: await getCompany(),
}));

export const PATCH = withApi(
  { permission: 'settings.manage', body: companyBody },
  async ({ user, body, ip }) => ({ company: await updateCompany(user, body, { ip }) }),
);
