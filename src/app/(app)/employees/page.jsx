import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listUsers } from '@/server/services/users.service.js';
import { listUsersQuery } from '@/server/validation/schemas.js';
import { ROLES } from '@/server/permissions/roles.js';
import { STAFF_TYPES } from '@/config/employeeOptions.js';
import { listLookups } from '@/server/services/lookups.service.js';
import { ButtonLink, PageHeader } from '@/components/shared/ui.jsx';
import { EmployeeList } from '@/features/employees/EmployeeList.jsx';

export const metadata = { title: 'Employees' };

export default async function EmployeesPage({ searchParams }) {
  const user = await requirePageUser('users.view');
  if (can(user, 'users.view') === 'own') notFound();
  const parsed = listUsersQuery.safeParse(await searchParams);
  const [result, departments] = await Promise.all([
    listUsers(user, parsed.success ? parsed.data : listUsersQuery.parse({})),
    listLookups('department'),
  ]);
  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${result.total} ${result.total === 1 ? 'person' : 'people'}`}
        actions={
          can(user, 'users.manage') && <ButtonLink href="/employees/new">Add employee</ButtonLink>
        }
      />
      <EmployeeList
        result={toPlain(result)}
        roles={Object.entries(ROLES).map(([value, role]) => ({ value, label: role.label }))}
        staffTypes={STAFF_TYPES}
        departments={departments.map((item) => item.name)}
      />
    </>
  );
}
