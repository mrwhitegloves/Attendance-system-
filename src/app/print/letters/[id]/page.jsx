import Image from 'next/image';
import { requirePageUser } from '@/server/auth/current.js';
import { getLetter } from '@/server/services/letters.service.js';
import { BRANDING } from '@/config/branding.js';
import { LetterBody } from '@/features/letters/LetterBody.jsx';
import { PrintButton } from '@/features/letters/PrintButton.jsx';

export const metadata = { title: 'Print letter' };

// An A4 page for printing or "Save as PDF" in the browser. No app frame, always light colours.
export default async function PrintLetterPage({ params }) {
  const user = await requirePageUser('letters.view');
  const { id } = await params;
  const { letter, rendered, company } = await getLetter(user, id);
  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      <style>
        {
          '@page { size: A4; margin: 18mm; } @media print { .no-print { display: none !important; } }'
        }
      </style>
      <div className="no-print flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-700">
        <span>
          {letter.status === 'draft'
            ? 'Draft preview: not issued yet.'
            : 'Use “Save as PDF” in the print window to keep a PDF.'}
        </span>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[180mm] px-6 py-10 text-[11pt] print:px-0 print:py-0">
        <header className="mb-8 flex items-start justify-between gap-6 border-b-2 border-brand pb-4">
          <div>
            <p className="text-lg font-bold">{company.name}</p>
            {company.address && (
              <p className="whitespace-pre-line text-xs text-gray-600">{company.address}</p>
            )}
            <p className="text-xs text-gray-600">
              {[company.phone, company.email, company.website].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Image src={BRANDING.logo} alt="" width={48} height={48} />
        </header>
        {letter.subject && <p className="mb-6 font-semibold">Subject: {letter.subject}</p>}
        <LetterBody text={rendered.text} highlightMissing={letter.status === 'draft'} />
        {letter.status !== 'draft' && (
          <footer className="mt-12 border-t border-gray-200 pt-3 text-[8pt] text-gray-500">
            {letter.employeeId} · {letter.kind.replace('_', ' ')} v{letter.version} · issued{' '}
            {new Date(letter.issuedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </footer>
        )}
      </article>
    </div>
  );
}
