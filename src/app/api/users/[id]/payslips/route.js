import { withApi } from '@/server/api.js';
import { createPayslipBody } from '@/server/validation/schemas.js';
import { createPayslip, listPayslips } from '@/server/services/payslips.service.js';

// GET /api/users/:id/payslips — this employee's slips. POST — start the slip of a month.
export const GET = withApi({ permission: 'payslips.view' }, ({ user, params }) =>
  listPayslips(user, { userId: params.id, page: 1 }),
);

export const POST = withApi(
  { permission: 'payslips.manage', body: createPayslipBody },
  async ({ user, params, body, ip }) => ({
    payslip: await createPayslip(user, params.id, body.month, { ip }),
  }),
);
