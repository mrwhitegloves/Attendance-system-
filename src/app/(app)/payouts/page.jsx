import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listPayouts } from '@/server/services/payouts.service.js';
import { listPayoutsQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { PayoutsScreen } from '@/features/payouts/PayoutsScreen.jsx';

export const metadata = { title: 'Salary payments' };

export default async function PayoutsPage({ searchParams }) {
  const user = await requirePageUser();
  if (!can(user, 'payouts.manage') && !can(user, 'payouts.approve')) notFound();
  const parsed = listPayoutsQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listPayoutsQuery.parse({});
  const result = await listPayouts(user, query);
  return (
    <>
      <PageHeader
        title="Salary payments"
        subtitle="Final salary slips: CEO approval, payment and how much was paid. Salary is due on the 10th of the next month."
      />
      <PayoutsScreen result={toPlain(result)} filters={query} />
    </>
  );
}
