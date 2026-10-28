import { notFound } from 'next/navigation';
import { Upload } from 'lucide-react';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { salaryOverview } from '@/server/services/salary.service.js';
import { ButtonLink, PageHeader } from '@/components/shared/ui.jsx';
import { SalaryOverview } from '@/features/salary/SalaryOverview.jsx';

export const metadata = { title: 'Salary' };

export default async function SalaryPage() {
  const user = await requirePageUser('salary.view');
  if (can(user, 'salary.view') === 'own') notFound();
  return (
    <>
      <PageHeader
        title="Salary"
        subtitle="Fixed monthly salary of each employee, and changes waiting for approval."
        actions={
          can(user, 'salary.manage') && (
            <ButtonLink variant="secondary" href="/salary/import">
              <Upload size={16} /> Import from Excel
            </ButtonLink>
          )
        }
      />
      <SalaryOverview data={toPlain(await salaryOverview(user))} />
    </>
  );
}
