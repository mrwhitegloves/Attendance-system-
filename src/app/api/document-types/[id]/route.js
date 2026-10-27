import { withApi } from '@/server/api.js';
import { updateDocumentTypeBody } from '@/server/validation/schemas.js';
import { updateDocumentType } from '@/server/services/documents.service.js';

// PATCH /api/document-types/:id — rename, required, expiry, signature, switch on/off. Never deleted.
export const PATCH = withApi(
  { permission: 'settings.manage', body: updateDocumentTypeBody },
  async ({ user, params, body, ip }) => ({
    item: await updateDocumentType(user, params.id, body, { ip }),
  }),
);
