import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getUser } from '@/server/services/users.service.js';
import { exitsOf } from '@/server/services/exits.service.js';
import { ExitPanel } from '@/features/exits/ExitPanel.jsx';

export const metadata = { title: 'Employee exit' };

export default async function EmployeeExitPage({ params }) {
  const user = await requirePageUser('exits.view');
  const { id } = await params;
  const [employee, exits] = await Promise.all([getUser(user, id), exitsOf(user, id)]);
  const canManage = Boolean(can(user, 'exits.manage'));
  return (
    <ExitPanel
      userId={id}
      employeeName={employee.name}
      exits={toPlain(exits)}
      canManage={canManage}
      canClose={canManage && Boolean(can(user, 'users.manage'))}
      isSelf={String(user._id) === id}
    />
  );
}
