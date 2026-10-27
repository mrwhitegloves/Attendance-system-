import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getSalary } from '@/server/services/salary.service.js';
import { SalaryPanel } from '@/features/salary/SalaryPanel.jsx';

export const metadata = { title: 'Employee salary' };

export default async function EmployeeSalaryPage({ params }) {
  const user = await requirePageUser('salary.view');
  const { id } = await params;
  return <SalaryPanel data={toPlain(await getSalary(user, id))} />;
}
