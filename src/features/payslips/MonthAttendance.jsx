'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDayName, formatMinutes, formatRupees } from '@/lib/format.js';
import { Badge, Button, Card, CardHeader, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';
import { PunchCell } from '@/features/attendance/PunchCell.jsx';

// How each day counts, in the words and colours of this screen (rules: lib/payslipRules.js).
const COUNTED = {
  full: { label: 'Full day', tone: 'success' },
  half: { label: 'Half day (late)', tone: 'warning' },
  paidLeave: { label: 'Paid leave', tone: 'info' },
  unpaidLeave: { label: 'Unpaid leave', tone: 'danger' },
  unmarkedLeave: { label: 'Leave (counted as paid)', tone: 'info' },
  absent: { label: 'Absent', tone: 'danger' },
  holiday: { label: 'Holiday (paid)', tone: 'info' },
  compOff: { label: 'Comp-off (paid)', tone: 'info' },
  weeklyOff: { label: 'Weekly off', tone: 'neutral' },
  weeklyOffWorked: { label: 'Weekly off worked', tone: 'brand' },
  // Slips filled before weekly offs existed.
  sunday: { label: 'Sunday', tone: 'neutral' },
  sundayWorked: { label: 'Sunday worked', tone: 'brand' },
  notJoined: { label: 'Not joined yet', tone: 'neutral' },
  future: { label: 'Not yet', tone: 'neutral' },
};

/** The last column: holiday name, comp-off link, or place and remark. */
function placeText(day) {
  if (day.holiday) return day.holiday;
  if (day.compOffFor) return `Day off for ${formatDayName(day.compOffFor)}`;
  if (day.compOffOn) return `Comp-off on ${formatDayName(day.compOffOn)}`;
  return day.punchIn?.location || day.remark || '—';
}

const STORAGE_KEY = 'payslip-attendance-open';
const noSubscribe = () => () => {};
function readOpen() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

/**
 * An absent day that was really leave (founder, 2026-11-05): paid or unpaid, optionally taken
 * from the paid leave balance. Saved as an approved leave; the slip's days and earnings follow.
 */
function MarkLeaveDialog({ slipId, day, balance, onClose }) {
  const router = useRouter();
  const [paid, setPaid] = useState(true);
  const [useBalance, setUseBalance] = useState(balance > 0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/payslips/${slipId}/mark-leave`, {
        method: 'POST',
        body: { date: day.date, paid, useBalance: paid && useBalance, reason: reason.trim() },
      });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${formatDayName(day.date)}: mark as leave`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || reason.trim().length < 3}>
            {busy && <Spinner />} Save as {paid ? 'paid' : 'unpaid'} leave
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          This day counts as absent because there is no punch and no leave. If the employee was on
          leave, mark it here: it is saved as an approved leave, and the slip&rsquo;s days, Basic,
          Paid Leave and HD Allowance are worked out again. Incentive, advance and other amounts you
          typed stay as they are.
        </p>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          {[
            [true, 'Paid leave', 'Paid under "Paid Leave" (one day of salary).'],
            [false, 'Unpaid leave', 'Not paid, like an absence.'],
          ].map(([value, label, hint]) => (
            <label
              key={label}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${paid === value ? 'border-brand bg-brand/5' : 'border-border'}`}
            >
              <input
                type="radio"
                name="leave-paid"
                className="mt-1"
                checked={paid === value}
                onChange={() => setPaid(value)}
              />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {paid && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={useBalance}
              onChange={(event) => setUseBalance(event.target.checked)}
            />
            <span>
              Take this day from the paid leave balance
              <span className="block text-xs text-muted">
                Balance at the end of the month: {balance}
              </span>
            </span>
          </label>
        )}
        <Field label="Reason (saved with the leave)" htmlFor="mark-leave-reason">
          <input
            id="mark-leave-reason"
            className={inputClass}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Sick, told the manager by phone"
          />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Dialog>
  );
}

/**
 * Every day of the slip's month with its punches, so HR or the CEO can count by hand.
 * Hidden or shown with one button; the choice is remembered on this device. On a draft slip,
 * people who prepare slips can mark an absent day as leave.
 */
export function MonthAttendance({
  data,
  slipAttendance,
  expectedInTime,
  slipId,
  canMarkLeave = false,
  leaveBalance = 0,
}) {
  const [marking, setMarking] = useState(null);
  // Shown unless this device last chose "Hide" (read from the browser, never on the server).
  const remembered = useSyncExternalStore(noSubscribe, readOpen, () => true);
  const [choice, setChoice] = useState(null);
  const open = choice ?? remembered;
  const toggle = () => {
    setChoice(!open);
    try {
      localStorage.setItem(STORAGE_KEY, open ? '0' : '1');
    } catch {
      // Private mode: not remembered.
    }
  };
  const { days, calculation } = data;
  const differs =
    slipAttendance.totalWorkingDays !== (calculation.slipWorkingDays ?? calculation.workingDays) ||
    slipAttendance.fullDays !== calculation.fullDays ||
    slipAttendance.halfDays !== calculation.halfDays;

  const facts = [
    ['Working days (full + half)', calculation.slipWorkingDays ?? calculation.workingDays],
    ['Full days', calculation.fullDays],
    [
      `Half days (first 3 paid in full)`,
      `${calculation.halfDays} (${calculation.chargedHalfDays} paid half)`,
    ],
    ['Weekly offs (paid)', (calculation.weeklyOffs ?? 0) + (calculation.weeklyOffsWorked ?? 0)],
    ['Holidays (paid)', calculation.holidayDays ?? 0],
    ['Comp-off days (paid)', calculation.compOffDays ?? 0],
    ['Paid leave', calculation.paidLeaveDays],
    ['Unpaid leave', calculation.unpaidLeaveDays],
    ['Absent', calculation.absentDays],
    ['Not joined yet', calculation.notJoinedDays ?? 0],
    ['One day of salary', formatRupees(calculation.perDayPaise)],
    ['Paid Leave amount', formatRupees(calculation.paidLeavePaise ?? 0)],
    ['HD Allowance', formatRupees(calculation.hdAllowancePaise ?? 0)],
    ['Loss of Pay (half days after 3)', formatRupees(calculation.halfDayCutPaise ?? 0)],
  ];

  return (
    <Card>
      <CardHeader
        title="Attendance of the month"
        subtitle={`Every day, as the salary rules count it. Expected in-time ${expectedInTime}; late from the 6th minute.`}
        action={
          <Button variant="secondary" size="sm" onClick={toggle} aria-expanded={open}>
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {open ? 'Hide' : 'Show'}
          </Button>
        }
      />
      {open && (
        <>
          {differs && (
            <p className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              The slip&rsquo;s days differ from the attendance below (changed by hand, or attendance
              changed later). Use &ldquo;Fill again from records&rdquo; to take the numbers below.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 p-4 text-sm sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2 border-b border-border py-1">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-y border-border text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Day</th>
                  <th className="px-2 py-2 font-medium">Counted as</th>
                  <th className="px-2 py-2 font-medium">Punch in</th>
                  <th className="px-2 py-2 font-medium">Punch out</th>
                  <th className="px-2 py-2 font-medium">Worked</th>
                  <th className="px-2 py-2 font-medium">Place / remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {days.map((day) => {
                  const counted = COUNTED[day.countedAs];
                  return (
                    <tr
                      key={day.date}
                      className={
                        ['weeklyOff', 'sunday', 'notJoined'].includes(day.countedAs)
                          ? 'bg-raised/60'
                          : ''
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-2">{formatDayName(day.date)}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={counted.tone}>{counted.label}</Badge>
                          {canMarkLeave && day.countedAs === 'absent' && (
                            <button
                              type="button"
                              onClick={() => setMarking(day)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted hover:border-brand hover:text-brand"
                            >
                              <CalendarCheck size={12} /> Mark as leave
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <PunchCell record={day.punchIn} />
                      </td>
                      <td className="px-2 py-2">
                        <PunchCell record={day.punchOut} />
                      </td>
                      <td className="px-2 py-2 tabular-nums">{formatMinutes(day.minutesWorked)}</td>
                      <td className="max-w-xs px-2 py-2 text-xs text-muted">
                        <span className="line-clamp-2">{placeText(day)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {marking && (
        <MarkLeaveDialog
          slipId={slipId}
          day={marking}
          balance={leaveBalance}
          onClose={() => setMarking(null)}
        />
      )}
    </Card>
  );
}
