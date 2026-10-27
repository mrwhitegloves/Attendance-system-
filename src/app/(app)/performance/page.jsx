import { Plus } from 'lucide-react';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listReviews } from '@/server/services/performance.service.js';
import { listReviewsQuery } from '@/server/validation/schemas.js';
import { ButtonLink, PageHeader } from '@/components/shared/ui.jsx';
import { ReviewList } from '@/features/performance/ReviewList.jsx';

export const metadata = { title: 'Performance' };

export default async function PerformancePage({ searchParams }) {
  const user = await requirePageUser('performance.view');
  const parsed = listReviewsQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listReviewsQuery.parse({});
  const result = await listReviews(user, query);
  const own = can(user, 'performance.view') === 'own' && !can(user, 'performance.manage');
  return (
    <>
      <PageHeader
        title={own ? 'My reviews' : 'Performance'}
        subtitle="Reviews with targets and KPIs, and improvement plans."
        actions={
          can(user, 'performance.manage') && (
            <ButtonLink href="/performance/new">
              <Plus size={16} /> New review
            </ButtonLink>
          )
        }
      />
      <ReviewList result={toPlain(result)} showPerson={!own} />
    </>
  );
}
