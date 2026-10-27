import { Plus } from 'lucide-react';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getUser } from '@/server/services/users.service.js';
import { listReviews } from '@/server/services/performance.service.js';
import { listReviewsQuery } from '@/server/validation/schemas.js';
import { ButtonLink } from '@/components/shared/ui.jsx';
import { ReviewList } from '@/features/performance/ReviewList.jsx';

export const metadata = { title: 'Employee performance' };

export default async function EmployeePerformancePage({ params, searchParams }) {
  const user = await requirePageUser('performance.view');
  const { id } = await params;
  const employee = await getUser(user, id);
  const parsed = listReviewsQuery.safeParse(await searchParams);
  const query = {
    ...(parsed.success ? parsed.data : listReviewsQuery.parse({})),
    employeeId: employee.employeeId,
  };
  const result = await listReviews(user, query);
  const canWrite = can(user, 'performance.manage') && String(user._id) !== id;
  return (
    <>
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <ButtonLink href={`/performance/new?userId=${id}`}>
            <Plus size={16} /> New review
          </ButtonLink>
        </div>
      )}
      <ReviewList result={toPlain(result)} showPerson={false} />
    </>
  );
}
