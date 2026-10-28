import { withApi } from '@/server/api.js';
import { reviewDocumentBody } from '@/server/validation/schemas.js';
import { reviewDocument } from '@/server/services/documents.service.js';

// POST /api/documents/:id/review — verify or reject the latest version (never by its uploader).
export const POST = withApi(
  { permission: 'documents.verify', body: reviewDocumentBody },
  ({ user, params, body, ip }) => reviewDocument(user, params.id, body, { ip }),
);
