import { notFound } from 'next/navigation';
import { requirePageUser } from '@/server/auth/current.js';
import { reportsFor } from '@/server/services/reports.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { ReportsScreen } from '@/features/reports/ReportsScreen.jsx';

export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const user = await requirePageUser('reports.export');
  const reports = reportsFor(user);
  if (!reports.length) notFound();
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="CSV files that open in Excel, for the CEO and the CA. Every download is in the audit log."
      />
      <ReportsScreen reports={reports} />
    </>
  );
}
