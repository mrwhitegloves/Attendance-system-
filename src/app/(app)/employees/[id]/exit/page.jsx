import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getUser } from '@/server/services/users.service.js';
import { exitsOf } from '@/server/services/exits.service.js';
import { getSettlement } from '@/server/services/settlement.service.js';
import { ExitPanel } from '@/features/exits/ExitPanel.jsx';
import { SettlementCard } from '@/features/exits/SettlementCard.jsx';

export const metadata = { title: 'Employee exit' };

export default async function EmployeeExitPage({ params }) {
  const user = await requirePageUser('exits.view');
  const { id } = await params;
  const [employee, exits] = await Promise.all([getUser(user, id), exitsOf(user, id)]);
  const canManage = Boolean(can(user, 'exits.manage'));
  // The settlement belongs to the open exit, or to the last closed one.
  const hasExit = exits.some((exit) => exit.status !== 'withdrawn');
  const settlement = hasExit ? await getSettlement(user, id) : null;
  return (
    <div className="space-y-4">
      <ExitPanel
        userId={id}
        employeeName={employee.name}
        exits={toPlain(exits)}
        canManage={canManage}
        canClose={canManage && Boolean(can(user, 'users.manage'))}
        isSelf={String(user._id) === id}
      />
      {hasExit && (
        <SettlementCard
          key={`${settlement?.settlement?.status}-${settlement?.settlement?.preparedAt}`}
          userId={id}
          data={toPlain(settlement)}
          canManage={canManage}
          canApprove={Boolean(can(user, 'payouts.approve'))}
          canPay={Boolean(can(user, 'payouts.manage'))}
        />
      )}
    </div>
  );
}
