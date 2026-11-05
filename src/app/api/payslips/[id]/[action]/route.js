import { withApi, parse, readJson } from '@/server/api.js';
import { markLeaveBody, reopenPayslipBody } from '@/server/validation/schemas.js';
import { createAppError } from '@/server/lib/errors.js';
import {
  finalisePayslip,
  markAbsentAsLeave,
  prefillAgain,
  reopenPayslip,
} from '@/server/services/payslips.service.js';

// POST /api/payslips/:id/finalise | reopen | prefill | mark-leave — the service checks who may
// do each. mark-leave: an absent day of the month was leave (paid or unpaid).
const ACTIONS = {
  finalise: ({ user, params, ip }) => finalisePayslip(user, params.id, { ip }),
  prefill: ({ user, params, ip }) => prefillAgain(user, params.id, { ip }),
  reopen: async ({ request, user, params, ip }) =>
    reopenPayslip(user, params.id, parse(reopenPayslipBody, await readJson(request)), { ip }),
  'mark-leave': async ({ request, user, params, ip }) =>
    markAbsentAsLeave(user, params.id, parse(markLeaveBody, await readJson(request)), { ip }),
};

export const POST = withApi({ permission: 'payslips.view' }, (context) => {
  const action = ACTIONS[context.params.action];
  if (!action) throw createAppError(404, 'Unknown action.');
  return action(context);
});
