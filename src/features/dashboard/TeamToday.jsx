import Link from 'next/link';
import { Badge, Card, CardHeader, EmptyState, StatTile } from '@/components/shared/ui.jsx';
import { PersonCell } from '@/components/shared/Avatar.jsx';
import { statusTone } from '@/lib/format.js';

// "09:41 PM" → 1301, to sort punches by time of day.
function clockMinutes(text) {
  const [, hours, minutes, half] = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i) ?? [];
  if (!hours) return 0;
  return ((Number(hours) % 12) + (half.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(minutes);
}

/** Today's attendance of everyone in scope, and what needs a decision. */
export function TeamToday({ sheet, pendingLeaves }) {
  const latest = sheet.rows
    .filter((row) => row.punchIn)
    .sort(
      (a, b) =>
        clockMinutes((b.punchOut ?? b.punchIn).time) - clockMinutes((a.punchOut ?? a.punchIn).time),
    )
    .slice(0, 8);
  const missing = sheet.rows.filter((row) => row.status === 'No punch');

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="People" value={sheet.summary.people} href="/employees" />
        <StatTile label="Present" value={sheet.summary.present} tone="success" href="/attendance" />
        <StatTile label="Late" value={sheet.summary.late} tone="warning" href="/attendance" />
        <StatTile label="On leave" value={sheet.summary.leave} tone="info" href="/attendance" />
        <StatTile label="No punch yet" value={sheet.summary.noPunch} href="/attendance" />
        <StatTile
          label="Leave to decide"
          value={pendingLeaves}
          tone={pendingLeaves ? 'brand' : 'neutral'}
          href="/leave?status=pending"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Latest punches"
            action={
              <Link href="/attendance" className="text-xs text-brand">
                Day sheet
              </Link>
            }
          />
          {latest.length ? (
            <ul className="divide-y divide-border">
              {latest.map((row) => (
                <li
                  key={row.user._id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <PersonCell name={row.user.name} employeeId={row.user.employeeId} />
                  <span className="flex items-center gap-2 text-right">
                    <span className="tabular-nums text-muted">
                      {row.punchOut ? `Out ${row.punchOut.time}` : `In ${row.punchIn.time}`}
                    </span>
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No punches yet today" />
          )}
        </Card>
        <Card>
          <CardHeader
            title="Not punched in yet"
            subtitle={`${missing.length} ${missing.length === 1 ? 'person' : 'people'}`}
          />
          {missing.length ? (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {missing.map((row) => (
                <li
                  key={row.user._id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <PersonCell
                    name={row.user.name}
                    employeeId={row.user.employeeId}
                    sub={row.user.department}
                  />
                  <span className="text-xs text-muted">Expected {row.user.expectedInTime}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Everyone has punched in" />
          )}
        </Card>
      </div>
    </>
  );
}
