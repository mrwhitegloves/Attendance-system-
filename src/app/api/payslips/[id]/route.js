import { withApi } from '@/server/api.js';
import { updatePayslipBody } from '@/server/validation/schemas.js';
import { getPayslip, updatePayslip } from '@/server/services/payslips.service.js';

// GET /api/payslips/:id — one slip (numbers masked). PATCH — change any field of a draft.
export const GET = withApi({ permission: 'payslips.view' }, ({ user, params }) =>
  getPayslip(user, params.id),
);

export const PATCH = withApi(
  { permission: 'payslips.manage', body: updatePayslipBody },
  ({ user, params, body, ip }) => updatePayslip(user, params.id, body, { ip }),
);
