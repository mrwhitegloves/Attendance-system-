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
  return (
    <>
      <p className="mb-2 text-sm">
        <Link
          href={isOwn ? '/me' : `/employees/${data.employee._id}/letters`}
          className="text-brand underline"
        >
          ← {isOwn ? 'My profile' : `${data.employee.name}'s letters`}
        </Link>
      </p>
      <LetterScreen data={toPlain(data)} isOwn={isOwn} />
    </>
  );
}
