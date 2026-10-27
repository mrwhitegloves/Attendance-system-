import Link from 'next/link';
import { Badge, Card, CardHeader } from '@/components/shared/ui.jsx';
import { formatDateTime } from '@/lib/format.js';
import { LETTER_STATUS, letterTitle } from './labels.js';

/** The signed-in person's letters; an issued one waits for their reply. */
export function MyLetters({ letters }) {
  return (
    <Card>
      <CardHeader title="My letters" />
      <ul className="divide-y divide-border">
        {letters.map((letter) => (
          <li key={letter._id}>
            <Link
              href={`/letters/${letter._id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-raised"
            >
              <span className="font-medium">{letterTitle(letter)}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted">{formatDateTime(letter.issuedAt)}</span>
                <Badge tone={LETTER_STATUS[letter.status].tone}>
                  {letter.status === 'issued'
                    ? 'Waiting for your reply'
                    : LETTER_STATUS[letter.status].label}
                </Badge>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
