import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getUser } from '@/server/services/users.service.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { Avatar } from '@/components/shared/Avatar.jsx';
import { Badge } from '@/components/shared/ui.jsx';
import { EmployeeTabs } from '@/features/employees/EmployeeTabs.jsx';
import { EmployeeActions } from '@/features/employees/EmployeeActions.jsx';

// Header and tabs of one employee; each tab is its own address under /employees/:id.
export default async function EmployeeLayout({ children, params }) {
  const user = await requirePageUser('users.view');
  const { id } = await params;
  const found = await getUser(user, id).catch(() => null);
  if (!found) notFound();
  const employee = toPlain(found);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={employee.name} size="lg" />
          <div>
            <h1 className="text-xl font-semibold">{employee.name}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {employee.employeeId} · {roleLabel(employee.roleKey)}
              {employee.status === 'inactive' && <Badge>Switched off</Badge>}
            </p>
          </div>
        </div>
        <EmployeeActions
          employee={employee}
          canManage={Boolean(can(user, 'users.manage')) && employee._id !== String(user._id)}
          canSeePassword={Boolean(can(user, 'users.password'))}
        />
      </div>
      <EmployeeTabs id={employee._id} canSeeLeave={Boolean(can(user, 'leave.view'))} />
      {children}
    </>
  );
}
