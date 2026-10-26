import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getUser } from '@/server/services/users.service.js';
import { EmployeeForm } from '@/features/employees/EmployeeForm.jsx';
import { employeeFormOptions } from '@/features/employees/formOptions.js';

export const metadata = { title: 'Edit employee' };

export default async function EditEmployeePage({ params }) {
  const user = await requirePageUser('users.manage');
  const { id } = await params;
  const employee = await getUser(user, id);
  return <EmployeeForm employee={toPlain(employee)} {...await employeeFormOptions(user)} />;
}
