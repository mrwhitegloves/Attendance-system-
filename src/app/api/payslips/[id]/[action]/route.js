import { withApi, parse, readJson } from '@/server/api.js';
import { reopenPayslipBody } from '@/server/validation/schemas.js';
import { createAppError } from '@/server/lib/errors.js';
import {
  finalisePayslip,
  prefillAgain,
  reopenPayslip,
} from '@/server/services/payslips.service.js';

// POST /api/payslips/:id/finalise | reopen | prefill — the service checks who may do each.
const ACTIONS = {
  finalise: ({ user, params, ip }) => finalisePayslip(user, params.id, { ip }),
  prefill: ({ user, params, ip }) => prefillAgain(user, params.id, { ip }),
  reopen: async ({ request, user, params, ip }) =>
    reopenPayslip(user, params.id, parse(reopenPayslipBody, await readJson(request)), { ip }),
};

export const POST = withApi({ permission: 'payslips.view' }, (context) => {
  const action = ACTIONS[context.params.action];
  if (!action) throw createAppError(404, 'Unknown action.');
  return action(context);
});
