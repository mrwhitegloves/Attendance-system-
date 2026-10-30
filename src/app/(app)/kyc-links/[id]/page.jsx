import Link from 'next/link';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getKycSubmission } from '@/server/services/kycLinks.service.js';
import { Card, PageHeader } from '@/components/shared/ui.jsx';
import { KycReview } from '@/features/kycLinks/KycReview.jsx';

export const metadata = { title: 'Review KYC form' };

export default async function KycReviewPage({ params }) {
  const user = await requirePageUser('kyc.verify');
  const { id } = await params;
  const data = await getKycSubmission(user, id);
  return (
    <>
      <PageHeader
        title="Review KYC form"
        subtitle="Check the answers against the files, then approve or send it back."
      />
      {data.link.status === 'submitted' ? (
        <KycReview data={toPlain(data)} />
      ) : (
        <Card className="p-6 text-center text-sm text-muted">
          This form is not waiting for review.{' '}
          <Link href="/kyc-links" className="text-brand hover:underline">
            Back to Employee KYC
          </Link>
        </Card>
      )}
    </>
  );
}
