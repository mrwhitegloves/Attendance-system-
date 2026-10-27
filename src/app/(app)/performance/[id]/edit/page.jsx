import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getReview } from '@/server/services/performance.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { ReviewForm } from '@/features/performance/ReviewForm.jsx';

export const metadata = { title: 'Edit review' };

export default async function EditReviewPage({ params }) {
  const user = await requirePageUser('performance.manage');
  const { id } = await params;
  const review = await getReview(user, id).catch((error) => {
    if (error.status === 404) notFound();
    throw error;
  });
  if (!review.permissions.edit) notFound();
  return (
    <>
      <PageHeader title={`Review of ${review.employeeName}`} subtitle="Draft" />
      <ReviewForm review={toPlain(review)} />
    </>
  );
}
