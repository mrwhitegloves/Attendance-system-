'use client';

import { useState, useSyncExternalStore } from 'react';
import { ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react';
import { formatDayName, formatMinutes, formatRupees } from '@/lib/format.js';
import { Badge, Button, Card, CardHeader } from '@/components/shared/ui.jsx';
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
  sunday: { label: 'Sunday', tone: 'neutral' },
  sundayWorked: { label: 'Sunday worked', tone: 'brand' },
  future: { label: 'Not yet', tone: 'neutral' },
};

/** The last column: holiday name, comp-off link, or place and remark. */
function placeText(day) {
  if (day.holiday) return day.holiday;
  if (day.compOffFor) return `Day off for Sunday ${formatDayName(day.compOffFor)}`;
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
 * Every day of the slip's month with its punches, so HR or the CEO can count by hand.
 * Hidden or shown with one button; the choice is remembered on this device.
 */
export function MonthAttendance({ data, slipAttendance, expectedInTime }) {
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
    slipAttendance.totalWorkingDays !== calculation.workingDays ||
    slipAttendance.fullDays !== calculation.fullDays ||
    slipAttendance.halfDays !== calculation.halfDays;

  const facts = [
    ['Working days (no Sundays)', calculation.workingDays],
    ['Full days', calculation.fullDays],
    [
      `Half days (first 3 free)`,
      `${calculation.halfDays} (${calculation.chargedHalfDays} charged)`,
    ],
    ['Paid leave', calculation.paidLeaveDays],
    ['Holidays (paid)', calculation.holidayDays ?? 0],
    ['Comp-off days (paid)', calculation.compOffDays ?? 0],
    ['Sundays worked', calculation.sundaysWorked ?? 0],
    ['Unpaid leave', calculation.unpaidLeaveDays],
    ['Absent', calculation.absentDays],
    ['One day of salary', formatRupees(calculation.perDayPaise)],
    ['Days of pay cut', calculation.lossOfPayDays],
    ['Loss of pay', formatRupees(calculation.lossOfPayPaise)],
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
                    <tr key={day.date} className={day.countedAs === 'sunday' ? 'bg-raised/60' : ''}>
                      <td className="whitespace-nowrap px-4 py-2">{formatDayName(day.date)}</td>
                      <td className="px-2 py-2">
                        <Badge tone={counted.tone}>{counted.label}</Badge>
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
    </Card>
  );
}
