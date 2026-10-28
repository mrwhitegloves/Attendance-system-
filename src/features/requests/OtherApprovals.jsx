import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/** Leave and salary changes waiting for this person: they are decided on their own screens. */
export function OtherApprovals({ items }) {
  if (!items.length) return null;
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm hover:bg-raised"
        >
          <span>
            <span className="font-semibold tabular-nums">{item.count}</span> {item.label} waiting
          </span>
          <ChevronRight size={16} className="text-muted" />
        </Link>
      ))}
    </div>
  );
}
