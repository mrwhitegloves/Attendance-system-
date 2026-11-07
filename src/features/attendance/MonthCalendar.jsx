'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, History, Pencil } from 'lucide-react';
import { useListParams } from '@/lib/useListParams.js';
import { apiFetch } from '@/lib/apiFetch.js';
import {
  formatDayName,
  formatMinutes,
  formatMonth,
  shiftMonth,
  statusTone,
  todayKey,
} from '@/lib/format.js';
import { Badge, Button, Card, ErrorText, Spinner, StatTile } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';
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

/** "09:52 AM" or "19:09" → "09:52" / "19:09" for a time input; '' when unreadable. */
function toInputTime(text) {
  const match = String(text || '')
    .trim()
    .match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap])?/i);
  if (!match) return '';
  let hours = Number(match[1]);
  if (match[3]) hours = (hours % 12) + (match[3].toLowerCase() === 'p' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

const timesText = (punches) =>
  `${punches.status || '—'} · in ${punches.punchIn || '—'} · out ${punches.punchOut || '—'}`;

const timesWord = (count) => `${count} ${count === 1 ? 'time' : 'times'}`;

/** How often the month was edited, and this day's earlier edits. */
function EditHistory({ edits, monthEdits, month }) {
  return (
    <div className="space-y-2">
      <p
        className={`flex items-center gap-2 rounded-lg p-3 text-xs ${monthEdits ? 'bg-warning/10 text-warning' : 'bg-raised text-muted'}`}
      >
        <History size={14} />
        {monthEdits
          ? `This employee's attendance was edited ${timesWord(monthEdits)} in ${formatMonth(month)}.`
          : `No edits yet in ${formatMonth(month)}.`}
      </p>
      {edits.length > 0 && (
        <ul className="space-y-2 text-xs">
          {edits.map((edit) => (
            <li key={edit._id} className="rounded-lg border border-border p-2">
              <p className="text-muted">
                {new Date(edit.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Kolkata',
                })}{' '}
                · {edit.editedByName}
              </p>
              <p>
                {timesText(edit.before)} → {timesText(edit.after)}
              </p>
              <p className="text-muted">Reason: {edit.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** HR or the CEO sets the punch-in and punch-out of one day, with a reason. */
function EditDayForm({ userId, day, onDone, onCancel }) {
  const router = useRouter();
  const [punchInTime, setPunchIn] = useState(toInputTime(day.punchIn?.time));
  const [punchOutTime, setPunchOut] = useState(toInputTime(day.punchOut?.time));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/attendance/edit/${userId}`, {
        method: 'POST',
        body: { date: day.date, punchInTime, punchOutTime, reason: reason.trim() },
      });
      onDone();
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Punch in" htmlFor="edit-punch-in">
          <input
            id="edit-punch-in"
            type="time"
            required
            className={inputClass}
            value={punchInTime}
            onChange={(event) => setPunchIn(event.target.value)}
          />
        </Field>
        <Field label="Punch out (optional)" htmlFor="edit-punch-out">
          <input
            id="edit-punch-out"
            type="time"
            className={inputClass}
            value={punchOutTime}
            onChange={(event) => setPunchOut(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Reason (required)" htmlFor="edit-reason">
        <input
          id="edit-reason"
          className={inputClass}
          maxLength={300}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Forgot to punch, came at 9:30 (told the manager)"
        />
      </Field>
      <p className="text-xs text-muted">
        Late or on time is worked out from the expected time. An absent day stops being absent, and
        a draft salary slip of this month is worked out again.
      </p>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !punchInTime || reason.trim().length < 3}>
          {busy && <Spinner />} Save
        </Button>
      </div>
    </form>
  );
}

/**
 * One person's month: totals and a calendar; a day opens its punches. People who may correct
 * punch times can edit a day there, and see how often the month was edited.
 */
export function MonthCalendar({ calendar }) {
  const { set, isPending } = useListParams();
  const [openDay, setOpenDay] = useState(null);
  const [editing, setEditing] = useState(false);
  const edits = calendar.edits ?? [];
  const editedDays = new Set(edits.map((edit) => edit.date));
  const open = (day) => {
    setEditing(false);
    setOpenDay(day);
  };
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
          <div className="text-center">
            <h2 className="text-sm font-semibold">{formatMonth(calendar.month)}</h2>
            {calendar.canEdit && (
              <p className={`text-xs ${edits.length ? 'text-warning' : 'text-muted'}`}>
                Edited {timesWord(edits.length)} this month
              </p>
            )}
          </div>
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
              onClick={() => open(day)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border border-border text-xs disabled:opacity-30 sm:aspect-auto sm:min-h-16 ${day.status ? CELL_TONE[day.status] : ''}`}
            >
              {editedDays.has(day.date) && (
                <Pencil
                  size={10}
                  className="absolute top-1 right-1 text-muted"
                  aria-label="Edited"
                />
              )}
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
        {openDay && editing && (
          <div className="space-y-4">
            <EditHistory
              edits={edits.filter((edit) => edit.date === openDay.date)}
              monthEdits={edits.length}
              month={calendar.month}
            />
            <EditDayForm
              userId={calendar.user._id}
              day={openDay}
              onDone={() => setOpenDay(null)}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}
        {openDay && !editing && (
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
            {calendar.canEdit && (
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs text-muted">
                  Edited {timesWord(edits.length)} this month
                </span>
                {openDay.status === 'Leave' ? (
                  <span className="text-xs text-muted">Leave days change on the Leave screen</span>
                ) : (
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    <Pencil size={14} /> Edit punch times
                  </Button>
                )}
              </div>
            )}
          </dl>
        )}
      </Dialog>
    </div>
  );
}
