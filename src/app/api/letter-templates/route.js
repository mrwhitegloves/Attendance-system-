import { withApi } from '@/server/api.js';
import { templateBody } from '@/server/validation/schemas.js';
import { addTemplate, listTemplates } from '@/server/services/letters.service.js';
import { can } from '@/server/permissions/can.js';

// GET /api/letter-templates — templates (switched-off ones only for settings managers). POST — add.
export const GET = withApi({ permission: 'letters.view' }, async ({ user }) => ({
  items: await listTemplates({ includeInactive: Boolean(can(user, 'settings.manage')) }),
}));

export const POST = withApi(
  { permission: 'settings.manage', body: templateBody },
  async ({ user, body, ip }) => ({ item: await addTemplate(user, body, { ip }) }),
);
