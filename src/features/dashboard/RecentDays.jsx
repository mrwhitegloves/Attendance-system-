'use client';

import { useState } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import { formatDayName, formatMinutes, statusTone } from '@/lib/format.js';
import { Badge, Card, CardHeader } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';

/** The employee's last 7 days on the dashboard; a day opens its punches (photo, place). */
export function RecentDays({ days }) {
  const [open, setOpen] = useState(null);
  return (
    <Card>
      <CardHeader title="Last 7 days" subtitle="Tap a day to see its punches." />
      <ul className="divide-y divide-border">
        {days.map((day) => (
          <li key={day.date}>
            <button
              type="button"
              onClick={() => setOpen(day)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-raised"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{formatDayName(day.date)}</p>
                <p className="text-xs text-muted">
                  In {day.punchIn?.time ?? '—'} · Out {day.punchOut?.time ?? '—'}
                  {day.minutesWorked !== null ? ` · ${formatMinutes(day.minutesWorked)}` : ''}
                </p>
              </div>
              <Badge tone={statusTone(day.status)}>{day.status}</Badge>
              <ChevronRight size={16} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <Dialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? formatDayName(open.date) : ''}
      >
        {open && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(open.status)}>{open.status}</Badge>
              {open.minutesWorked !== null && (
                <span className="text-muted">Worked {formatMinutes(open.minutesWorked)}</span>
              )}
            </div>
            {!open.punchIn && !open.punchOut ? (
              <p className="text-muted">No punch on this day.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Punch title="Punch in" record={open.punchIn} />
                <Punch title="Punch out" record={open.punchOut} />
              </div>
            )}
            {open.remark && <p className="text-muted">Note: {open.remark}</p>}
          </div>
        )}
      </Dialog>
    </Card>
  );
}

function Punch({ title, record }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted">{title}</p>
      {record ? (
        <>
          <p className="text-lg font-semibold tabular-nums">{record.time}</p>
          {record.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={record.photoUrl}
              alt={`${title} photo`}
              className="mt-2 aspect-[4/3] w-full rounded-md object-cover"
            />
          )}
          <p className="mt-2 flex items-start gap-1 text-xs text-muted">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            {record.location || 'Unknown place'}
          </p>
        </>
      ) : (
        <p className="text-muted">—</p>
      )}
    </div>
  );
}
