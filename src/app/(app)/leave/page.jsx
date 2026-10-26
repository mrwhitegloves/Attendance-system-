import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listLeaves, countPendingLeaves } from '@/server/services/leaves.service.js';
import { listLeavesQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { LeaveScreen } from '@/features/leave/LeaveScreen.jsx';

export const metadata = { title: 'Leave' };

export default async function LeavePage({ searchParams }) {
  const user = await requirePageUser('leave.view');
  const parsed = listLeavesQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listLeavesQuery.parse({});
  const [result, pending] = await Promise.all([listLeaves(user, query), countPendingLeaves(user)]);
  return (
    <>
      <PageHeader
        title="Leave"
        subtitle={can(user, 'leave.view') === 'own' ? 'Your leave requests' : 'Leave requests'}
      />
      <LeaveScreen
        result={toPlain(result)}
        status={query.status}
        pendingToDecide={pending}
        me={{ employeeId: user.employeeId }}
        canRequest={Boolean(can(user, 'leave.request'))}
        canDecide={Boolean(can(user, 'leave.decide'))}
        showPerson={can(user, 'leave.view') !== 'own'}
      />
    </>
  );
}
