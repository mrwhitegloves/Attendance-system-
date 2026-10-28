import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getUser } from '@/server/services/users.service.js';
import { listLeaves } from '@/server/services/leaves.service.js';
import { getLeaveBalance } from '@/server/services/leaveRules.service.js';
import { listLeavesQuery } from '@/server/validation/schemas.js';
import { LeaveScreen } from '@/features/leave/LeaveScreen.jsx';
import { LeaveBalance } from '@/features/leave/LeaveBalance.jsx';

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
  const [result, balance] = await Promise.all([listLeaves(user, query), getLeaveBalance(user, id)]);
  return (
    <div className="space-y-4">
      <LeaveBalance
        userId={id}
        data={toPlain(balance)}
        canAdjust={Boolean(can(user, 'users.manage'))}
      />
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
    </div>
  );
}
