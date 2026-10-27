import { withApi } from '@/server/api.js';
import { updateTemplateBody } from '@/server/validation/schemas.js';
import { updateTemplate } from '@/server/services/letters.service.js';

// PATCH /api/letter-templates/:id — change the text, or switch on/off. Issued letters keep their text.
export const PATCH = withApi(
  { permission: 'settings.manage', body: updateTemplateBody },
  async ({ user, params, body, ip }) => ({
    item: await updateTemplate(user, params.id, body, { ip }),
  }),
);
