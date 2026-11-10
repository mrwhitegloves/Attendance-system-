import { withApi } from '@/server/api.js';
import { updatePayslipBody } from '@/server/validation/schemas.js';
import { deletePayslip, getPayslip, updatePayslip } from '@/server/services/payslips.service.js';

// GET /api/payslips/:id — one slip (numbers masked). PATCH — change any field of a draft.
// DELETE — a draft goes to Recently deleted.
export const GET = withApi({ permission: 'payslips.view' }, ({ user, params }) =>
  getPayslip(user, params.id),
);

export const PATCH = withApi(
  { permission: 'payslips.manage', body: updatePayslipBody },
  ({ user, params, body, ip }) => updatePayslip(user, params.id, body, { ip }),
);

export const DELETE = withApi({ permission: 'payslips.manage' }, ({ user, params, ip }) =>
  deletePayslip(user, params.id, { ip }),
);
