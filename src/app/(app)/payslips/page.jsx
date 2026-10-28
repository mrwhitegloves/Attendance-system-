import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listPayslips } from '@/server/services/payslips.service.js';
import { listPayslipsQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { PayslipList } from '@/features/payslips/PayslipList.jsx';

export const metadata = { title: 'Salary slips' };

export default async function PayslipsPage({ searchParams }) {
  const user = await requirePageUser('payslips.view');
  if (can(user, 'payslips.view') === 'own') notFound();
  const parsed = listPayslipsQuery.safeParse(await searchParams);
  const result = await listPayslips(
    user,
    parsed.success ? parsed.data : listPayslipsQuery.parse({}),
  );
  return (
    <>
      <PageHeader
        title="Salary slips"
        subtitle="Start a slip on the employee's Payslips tab. Automatic calculation from attendance comes when the rules are decided."
      />
      <PayslipList result={toPlain(result)} />
    </>
  );
}
