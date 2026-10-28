'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useListParams } from '@/lib/useListParams.js';
import {
  formatDayName,
  formatMinutes,
  formatMonth,
  shiftMonth,
  statusTone,
  todayKey,
} from '@/lib/format.js';
import { Badge, Card, StatTile } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { PunchCell } from './PunchCell.jsx';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CELL_TONE = {
  Present: 'bg-success/10 text-success',
  Late: 'bg-warning/10 text-warning',
  Leave: 'bg-info/10 text-info',
  'Leave pending': 'bg-warning/5 text-warning',
  Absent: 'bg-danger/10 text-danger',
  'No punch': 'text-muted',
};

/** One person's month: totals and a calendar; a day opens its punches. */
export function MonthCalendar({ calendar }) {
  const { set, isPending } = useListParams();
  const [openDay, setOpenDay] = useState(null);
  const currentMonth = todayKey().slice(0, 7);
  const firstWeekday = (new Date(`${calendar.month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const goTo = (month) => set({ month: month === currentMonth ? '' : month });

  return (
    <div className={`space-y-4 ${isPending ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Present days" value={calendar.totals.present} tone="success" />
        <StatTile label="Late days" value={calendar.totals.late} tone="warning" />
        <StatTile label="Leave days" value={calendar.totals.leave} tone="info" />
        <StatTile label="Absent days" value={calendar.totals.absent} tone="danger" />
        <StatTile
          label="Overtime this month"
          value={
            calendar.totals.overtimeMinutes ? formatMinutes(calendar.totals.overtimeMinutes) : '—'
          }
          hint="Not paid; for information"
        />
      </div>
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg border border-border p-2"
            onClick={() => goTo(shiftMonth(calendar.month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-semibold">{formatMonth(calendar.month)}</h2>
          <button
            type="button"
            className="rounded-lg border border-border p-2 disabled:opacity-40"
            disabled={calendar.month >= currentMonth}
            onClick={() => goTo(shiftMonth(calendar.month, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
          {Array.from({ length: firstWeekday }, (_, index) => (
            <div key={`blank-${index}`} />
          ))}
          {calendar.days.map((day) => (
            <button
              key={day.date}
              type="button"
              disabled={day.future}
              onClick={() => setOpenDay(day)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border border-border text-xs disabled:opacity-30 sm:aspect-auto sm:min-h-16 ${day.status ? CELL_TONE[day.status] : ''}`}
            >
              <span className="font-semibold">{Number(day.date.slice(8))}</span>
              <span className="hidden truncate sm:block">
                {day.punchIn?.time ?? (day.status && day.status !== 'No punch' ? day.status : '')}
              </span>
            </button>
          ))}
        </div>
      </Card>
      <Dialog
        open={Boolean(openDay)}
        onClose={() => setOpenDay(null)}
        title={openDay ? formatDayName(openDay.date) : ''}
      >
        {openDay && (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Status</dt>
              <dd>
                <Badge tone={statusTone(openDay.status)}>{openDay.status}</Badge>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Punch in</dt>
              <dd>
                <PunchCell record={openDay.punchIn} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Punch out</dt>
              <dd>
                <PunchCell record={openDay.punchOut} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Worked</dt>
              <dd>{formatMinutes(openDay.minutesWorked)}</dd>
            </div>
            {openDay.remark && (
              <p className="rounded-lg bg-raised p-3 text-xs text-muted">{openDay.remark}</p>
            )}
          </dl>
        )}
      </Dialog>
    </div>
  );
}
