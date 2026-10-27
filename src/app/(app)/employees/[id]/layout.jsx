import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getUser } from '@/server/services/users.service.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { CompletenessBar } from '@/components/shared/Avatar.jsx';
import { PhotoUpload } from '@/features/employees/PhotoUpload.jsx';
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
  const canEdit = Boolean(can(user, 'users.manage'));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <PhotoUpload employee={employee} canEdit={canEdit} />
          <div>
            <h1 className="text-xl font-semibold">{employee.name}</h1>
            <p className="text-sm text-muted">
              {[employee.designation, employee.department].filter(Boolean).join(' · ') ||
                roleLabel(employee.roleKey)}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              {employee.employeeId}
              <CompletenessBar percent={employee.completeness?.percent ?? 0} />
              {employee.status === 'inactive' && <Badge>Switched off</Badge>}
            </p>
          </div>
        </div>
        <EmployeeActions
          employee={employee}
          canEdit={canEdit}
          canSwitch={canEdit && employee._id !== String(user._id)}
          canSeePassword={Boolean(can(user, 'users.password'))}
        />
      </div>
      <EmployeeTabs
        id={employee._id}
        show={{
          kyc: Boolean(can(user, 'kyc.view')),
          documents: Boolean(can(user, 'documents.view')),
          letters: Boolean(can(user, 'letters.view')),
          salary: Boolean(can(user, 'salary.view')),
          leave: Boolean(can(user, 'leave.view')),
        }}
      />
      {children}
    </>
  );
}
