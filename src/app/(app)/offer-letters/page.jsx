import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listOfferLetters } from '@/server/services/offerLetters.service.js';
import { listOfferLettersQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { OfferLetterList } from '@/features/offerLetters/OfferLetterList.jsx';

export const metadata = { title: 'Offer letters' };

export default async function OfferLettersPage({ searchParams }) {
  const user = await requirePageUser('letters.manage');
  const parsed = listOfferLettersQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listOfferLettersQuery.parse({});
  const result = await listOfferLetters(user, query);
  return (
    <>
      <PageHeader
        title="Offer letters"
        subtitle="One offer letter per person. Link it to the employee when you add them."
      />
      <OfferLetterList result={toPlain(result)} />
    </>
  );
}
