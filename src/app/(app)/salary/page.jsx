import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { salaryOverview } from '@/server/services/salary.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { SalaryOverview } from '@/features/salary/SalaryOverview.jsx';

export const metadata = { title: 'Salary' };

export default async function SalaryPage() {
  const user = await requirePageUser('salary.view');
  if (can(user, 'salary.view') === 'own') notFound();
  return (
    <>
      <PageHeader
        title="Salary"
        subtitle="Salary structures in force and changes waiting for approval. Payroll comes after the CEO decides the rules."
      />
      <SalaryOverview data={toPlain(await salaryOverview(user))} />
    </>
  );
}
