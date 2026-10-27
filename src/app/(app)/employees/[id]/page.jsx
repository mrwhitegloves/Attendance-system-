import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getUser, fileChecklist } from '@/server/services/users.service.js';
import { User } from '@/server/models/user.model.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { EmployeeFile } from '@/features/employees/EmployeeFile.jsx';

export const metadata = { title: 'Employee' };

export default async function EmployeeProfilePage({ params }) {
  const user = await requirePageUser('users.view');
  const { id } = await params;
  const employee = await getUser(user, id);
  const manager = employee.managerId
    ? await User.findById(employee.managerId, 'name employeeId').lean()
    : null;
  return (
    <EmployeeFile
      employee={toPlain(employee)}
      managerName={manager ? `${manager.name} (${manager.employeeId})` : null}
      roleName={roleLabel(employee.roleKey)}
      checklist={await fileChecklist(employee)}
      canEdit={Boolean(can(user, 'users.manage'))}
    />
  );
}
