import { withApi } from '@/server/api.js';
import { proposeSalaryBody } from '@/server/validation/schemas.js';
import { getSalary, proposeSalary } from '@/server/services/salary.service.js';

// GET /api/users/:id/salary — structures in force, waiting and past.
// POST — propose a new structure or revision (it waits for approval).
export const GET = withApi({ permission: 'salary.view' }, ({ user, params }) =>
  getSalary(user, params.id),
);

export const POST = withApi(
  { permission: 'salary.manage', body: proposeSalaryBody },
  ({ user, params, body, ip }) => proposeSalary(user, params.id, body, { ip }),
);
