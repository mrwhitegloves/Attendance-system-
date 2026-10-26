import { requirePageUser } from '@/server/auth/current.js';
import { getUser } from '@/server/services/users.service.js';
import { User } from '@/server/models/user.model.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { Card, CardHeader } from '@/components/shared/ui.jsx';
import { formatDateTime } from '@/lib/format.js';

export const metadata = { title: 'Employee' };

export default async function EmployeeProfilePage({ params }) {
  const user = await requirePageUser('users.view');
  const { id } = await params;
  const employee = await getUser(user, id);
  const manager = employee.managerId
    ? await User.findById(employee.managerId, 'name employeeId').lean()
    : null;
  const rows = [
    ['Employee ID', employee.employeeId],
    ['Phone', employee.phone || '—'],
    ['Email', employee.email || '—'],
    ['Department', employee.department || '—'],
    ['Staff type', employee.staffType],
    ['Reports to', manager ? `${manager.name} (${manager.employeeId})` : '—'],
    ['Shift', `${employee.expectedInTime} – ${employee.expectedOutTime}`],
    ['Role', roleLabel(employee.roleKey)],
    ['Added on', formatDateTime(employee.createdAt)],
    ['Last sign-in', formatDateTime(employee.lastLoginAt)],
  ];
  return (
    <Card>
      <CardHeader
        title="Profile"
        subtitle="Phase 1 adds personal details, KYC, documents and salary here."
      />
      <dl className="grid gap-x-6 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-3 border-b border-border px-4 py-3 text-sm last:border-0"
          >
            <dt className="text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
