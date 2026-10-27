import { withApi } from '@/server/api.js';
import { listDocumentsQuery } from '@/server/validation/schemas.js';
import { listAllDocuments, queueExpiryCheck } from '@/server/services/documents.service.js';

// GET /api/documents — every document in scope, with filters.
export const GET = withApi(
  { permission: 'documents.view', query: listDocumentsQuery },
  ({ user, query }) => {
    queueExpiryCheck();
    return listAllDocuments(user, query);
  },
);
