import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getReview } from '@/server/services/performance.service.js';
import { ReviewDetail } from '@/features/performance/ReviewDetail.jsx';

export const metadata = { title: 'Review' };

export default async function ReviewPage({ params }) {
  const user = await requirePageUser('performance.view');
  const { id } = await params;
  const review = await getReview(user, id).catch((error) => {
    if (error.status === 404) notFound();
    throw error;
  });
  return <ReviewDetail review={toPlain(review)} />;
}
