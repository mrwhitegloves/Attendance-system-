import { withApi } from '@/server/api.js';
import { listPayslipsQuery } from '@/server/validation/schemas.js';
import { listPayslips } from '@/server/services/payslips.service.js';

// GET /api/payslips — salary slips in scope (employees: their own final slips).
export const GET = withApi(
  { permission: 'payslips.view', query: listPayslipsQuery },
  ({ user, query }) => listPayslips(user, query),
);
