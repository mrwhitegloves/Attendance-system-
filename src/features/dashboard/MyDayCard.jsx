import { Camera, CheckCircle2 } from 'lucide-react';
import { Badge, ButtonLink, Card } from '@/components/shared/ui.jsx';
import { statusTone } from '@/lib/format.js';

/** The person's own day with the next punch. */
export function MyDayCard({ day }) {
  const message =
    day.next === 'done'
      ? 'Your day is complete.'
      : day.onLeave
        ? 'You are on approved leave today.'
        : day.next === 'out'
          ? `You punched in at ${day.punchIn.time}.`
          : `Your shift starts at ${day.expectedInTime} (late after ${day.graceMinutes} minutes).`;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full ${day.next === 'done' ? 'bg-success/10 text-success' : 'bg-brand/10 text-brand'}`}
        >
          {day.next === 'done' ? <CheckCircle2 size={22} /> : <Camera size={22} />}
        </span>
        <div>
          <p className="text-sm font-semibold">My day</p>
          <p className="text-sm text-muted">{message}</p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {day.punchIn && (
              <Badge tone={statusTone(day.punchIn.status)}>In {day.punchIn.time}</Badge>
            )}
            {day.punchOut && <Badge tone="info">Out {day.punchOut.time}</Badge>}
            <Badge tone={day.lateDaysThisMonth >= day.lateLimit ? 'danger' : 'neutral'}>
              Late this month: {day.lateDaysThisMonth}/{day.lateLimit}
            </Badge>
          </p>
        </div>
      </div>
      {day.next !== 'done' && (
        <ButtonLink href="/attendance/punch" size="lg">
          <Camera size={18} /> {day.next === 'in' ? 'Punch in' : 'Punch out'}
        </ButtonLink>
      )}
    </Card>
  );
}
