import { requirePageUser } from '@/server/auth/current.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { EmployeeForm } from '@/features/employees/EmployeeForm.jsx';
import { employeeFormOptions } from '@/features/employees/formOptions.js';

export const metadata = { title: 'Add employee' };

export default async function NewEmployeePage() {
  const user = await requirePageUser('users.manage');
  return (
    <>
      <PageHeader title="Add employee" subtitle="The next MWG ID is given automatically." />
      <EmployeeForm {...await employeeFormOptions(user)} />
    </>
  );
}
