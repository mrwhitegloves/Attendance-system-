import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getUser } from '@/server/services/users.service.js';
import { listLeaves } from '@/server/services/leaves.service.js';
import { listLeavesQuery } from '@/server/validation/schemas.js';
import { LeaveScreen } from '@/features/leave/LeaveScreen.jsx';

export const metadata = { title: 'Employee leave' };

export default async function EmployeeLeavePage({ params, searchParams }) {
  const user = await requirePageUser('leave.view');
  const { id } = await params;
  const employee = await getUser(user, id);
  const parsed = listLeavesQuery.safeParse(await searchParams);
  const query = {
    ...(parsed.success ? parsed.data : listLeavesQuery.parse({})),
    employeeId: employee.employeeId,
  };
  const result = await listLeaves(user, query);
  return (
    <LeaveScreen
      result={toPlain(result)}
      status={query.status}
      pendingToDecide={0}
      me={{ employeeId: user.employeeId }}
      canRequest={false}
      canDecide={Boolean(can(user, 'leave.decide'))}
      showPerson={false}
      basePath={`/employees/${id}/leave`}
    />
  );
}
