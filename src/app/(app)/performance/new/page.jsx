import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listUserOptions } from '@/server/services/users.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { ReviewForm } from '@/features/performance/ReviewForm.jsx';

export const metadata = { title: 'New review' };

export default async function NewReviewPage({ searchParams }) {
  const user = await requirePageUser('performance.manage');
  const { userId } = await searchParams;
  // Everyone the person may review, never themselves.
  const people = (await listUserOptions(user, 'performance.manage')).filter(
    (person) => String(person._id) !== String(user._id),
  );
  return (
    <>
      <PageHeader
        title="New review"
        subtitle="Saved as a draft. The employee sees it only after you share it."
      />
      <ReviewForm
        people={toPlain(people)}
        initialUserId={people.some((person) => String(person._id) === userId) ? userId : ''}
      />
    </>
  );
}
