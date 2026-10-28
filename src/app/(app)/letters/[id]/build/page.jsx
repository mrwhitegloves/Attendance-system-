import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getLetter } from '@/server/services/letters.service.js';
import { brandFor } from '@/server/services/settings.service.js';
import { companyStamp, pictureDataUrl } from '@/server/services/pdf.service.js';
import { BRAND_KEYS } from '@/config/brands.js';
import { OfferLetterBuilder } from '@/features/letters/builder/OfferLetterBuilder.jsx';

export const metadata = { title: 'Offer letter' };

// The offer letter screen: inputs on the left, the live PDF preview on the right.
export default async function BuildOfferLetterPage({ params }) {
  const user = await requirePageUser('letters.manage');
  const { id } = await params;
  const data = await getLetter(user, id).catch((error) => {
    if (error.status === 404) notFound();
    throw error;
  });
  if (data.letter.layout !== 'offer_format' || !data.permissions.edit) notFound();
  const brands = Object.fromEntries(
    BRAND_KEYS.map((key) => [key, brandFor(data.company, { brandKey: key })]),
  );
  // The browser cannot read the private stamp file, so it is handed over as a data URL.
  const stampDataUrl = await pictureDataUrl(await companyStamp(data.company));
  return (
    <OfferLetterBuilder
      letter={toPlain(data.letter)}
      person={toPlain(data.employee)}
      company={toPlain(data.company)}
      brands={toPlain(brands)}
      stampDataUrl={stampDataUrl}
    />
  );
}
