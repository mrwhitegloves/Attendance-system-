import { withApi } from '@/server/api.js';
import { addDocumentTypeBody } from '@/server/validation/schemas.js';
import { addDocumentType, listDocumentTypes } from '@/server/services/documents.service.js';
import { can } from '@/server/permissions/can.js';

// GET /api/document-types — the catalogue (switched-off types only for settings managers).
// POST — add a type.
export const GET = withApi({}, async ({ user }) => ({
  items: await listDocumentTypes({ includeInactive: Boolean(can(user, 'settings.manage')) }),
}));

export const POST = withApi(
  { permission: 'settings.manage', body: addDocumentTypeBody },
  async ({ user, body, ip }) => ({ item: await addDocumentType(user, body, { ip }) }),
);
