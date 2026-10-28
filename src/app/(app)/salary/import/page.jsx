import { requirePageUser } from '@/server/auth/current.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { SalaryImport } from '@/features/salary/SalaryImport.jsx';

export const metadata = { title: 'Import salaries' };

export default async function SalaryImportPage() {
  await requirePageUser('salary.manage');
  return (
    <>
      <PageHeader
        title="Import salaries from Excel"
        subtitle="Fixed monthly salary of each employee. Every row becomes a salary proposal that the CEO approves on the Salary screen."
      />
      <SalaryImport />
    </>
  );
}
