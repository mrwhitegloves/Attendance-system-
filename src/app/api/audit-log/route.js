import { withApi } from '@/server/api.js';
import { auditQuery } from '@/server/validation/schemas.js';
import { listAuditLog } from '@/server/services/audit.service.js';

// GET /api/audit-log — who changed what (CEO, Auditor).
export const GET = withApi({ permission: 'audit.view', query: auditQuery }, ({ query }) =>
  listAuditLog(query),
);
