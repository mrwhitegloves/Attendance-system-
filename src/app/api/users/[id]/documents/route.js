import { withApi } from '@/server/api.js';
import { uploadDocumentBody } from '@/server/validation/schemas.js';
import { getEmployeeDocuments, uploadDocument } from '@/server/services/documents.service.js';

// GET /api/users/:id/documents — the catalogue with this employee's documents.
// POST — upload a new version (PDF or photo, at most 5 MB).
export const GET = withApi({ permission: 'documents.view' }, ({ user, params }) =>
  getEmployeeDocuments(user, params.id),
);

export const POST = withApi(
  { permission: 'documents.manage', body: uploadDocumentBody },
  ({ user, params, body, ip }) => uploadDocument(user, params.id, body, { ip }),
);
