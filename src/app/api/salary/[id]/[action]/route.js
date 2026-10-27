import { withApi, parse, readJson } from '@/server/api.js';
import { decideSalaryBody } from '@/server/validation/schemas.js';
import { createAppError } from '@/server/lib/errors.js';
import { decideSalary, withdrawSalary } from '@/server/services/salary.service.js';

// POST /api/salary/:id/decide — approve or reject (never your own proposal).
// POST /api/salary/:id/withdraw — take back a waiting proposal.
const ACTIONS = {
  decide: async ({ request, user, params, ip }) =>
    decideSalary(user, params.id, parse(decideSalaryBody, await readJson(request)), { ip }),
  withdraw: ({ user, params, ip }) => withdrawSalary(user, params.id, { ip }),
};

export const POST = withApi({ permission: 'salary.view' }, (context) => {
  const action = ACTIONS[context.params.action];
  if (!action) throw createAppError(404, 'Unknown action.');
  return action(context);
});
