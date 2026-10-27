import { withApi } from '@/server/api.js';
import { salaryOverview } from '@/server/services/salary.service.js';

// GET /api/salary — proposals waiting for approval and everyone's salary in force.
export const GET = withApi({ permission: 'salary.view' }, ({ user }) => salaryOverview(user));
