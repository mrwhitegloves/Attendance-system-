import Link from 'next/link';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { Card, CardHeader, StatTile } from '@/components/shared/ui.jsx';
import { CompletenessBar } from '@/components/shared/Avatar.jsx';
import { formatRupees } from '@/lib/format.js';

const DOT = {
  warning: 'bg-warning',
  info: 'bg-info',
  danger: 'bg-danger',
  brand: 'bg-brand',
  success: 'bg-success',
};

/** The CEO view: four numbers, the priority queue, and the people overview. */
export function ControlCenter({ data }) {
  const { people, verified, payroll, queue, openItems } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="All staff"
          value={people.total}
          href="/employees"
          hint={`${people.probation} on probation · ${people.notice} on notice`}
        />
        <StatTile
          label="Verified %"
          value={verified ? `${verified.percent}%` : '—'}
          tone={
            !verified
              ? 'neutral'
              : verified.percent >= 90
                ? 'success'
                : verified.percent >= 50
                  ? 'warning'
                  : 'danger'
          }
          hint={
            verified
              ? `${verified.verifiedItems} of ${verified.neededItems} KYC and required documents`
              : undefined
          }
          href="/documents"
        />
        <StatTile
          label="₹ Total per month"
          value={payroll ? formatRupees(payroll.monthlyCtc) : '—'}
          tone="brand"
          hint={
            payroll
              ? `Cost to company · ${payroll.withSalary} of ${payroll.people} with a salary`
              : undefined
          }
          href="/salary"
        />
        <StatTile
          label="Open items"
          value={openItems}
          tone={openItems ? 'warning' : 'success'}
          hint="Waiting for someone"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title="Priority queue"
            subtitle="What needs attention, most important first."
          />
          {queue.length ? (
            <ul className="divide-y divide-border">
              {queue.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-raised"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[item.tone]}`} />
                    <span className="flex-1">{item.label}</span>
                    <span className="font-semibold tabular-nums">{item.count}</span>
                    <ChevronRight size={16} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 p-4 text-sm text-success">
              <CircleCheck size={16} /> Nothing is waiting. Every file, check and approval is done.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Employee files"
            subtitle={`Average ${people.averageCompleteness}% complete`}
          />
          {people.leastComplete.length ? (
            <ul className="divide-y divide-border">
              {people.leastComplete.map((person) => (
                <li key={person._id}>
                  <Link
                    href={`/employees/${person._id}`}
                    className="block px-4 py-2.5 text-sm hover:bg-raised"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{person.name}</span>
                      <CompletenessBar percent={person.percent} />
                    </span>
                    <span className="block truncate text-xs text-muted">
                      Missing: {person.missing.join(', ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-success">Every file is complete.</p>
          )}
          {people.notSet > 0 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted">
              {people.notSet} {people.notSet === 1 ? 'person has' : 'people have'} no employment
              status yet.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
