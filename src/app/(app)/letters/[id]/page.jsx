import Link from 'next/link';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getLetter } from '@/server/services/letters.service.js';
import { LetterScreen } from '@/features/letters/LetterScreen.jsx';

export const metadata = { title: 'Letter' };

export default async function LetterPage({ params }) {
  const user = await requirePageUser('letters.view');
  const { id } = await params;
  const data = await getLetter(user, id);
  const isOwn = String(data.employee._id) === String(user._id);
  const back = isOwn
    ? { href: '/me', label: 'My profile' }
    : data.employee._id
      ? {
          href: `/employees/${data.employee._id}/letters`,
          label: `${data.employee.name}'s letters`,
        }
      : {
          href: `/recruitment/${data.employee.candidateId}`,
          label: `Candidate ${data.employee.name}`,
        };
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={back.href} className="text-brand underline">
          ← {back.label}
        </Link>
      </p>
      <LetterScreen data={toPlain(data)} isOwn={isOwn} />
    </>
  );
}
