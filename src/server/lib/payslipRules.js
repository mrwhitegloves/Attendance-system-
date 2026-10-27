// The founder's rules for a month's salary from attendance (2026-10-27). Pure functions.
//
// - Working days: every day of the month except Sundays.
// - A punch-in more than 5 minutes after the expected time (from minute 6) is a half day;
//   an earlier punch-in is a full day.
// - The first 3 half days of a month are free; each further half day costs half a day's salary.
// - Paid leave costs nothing; unpaid leave costs a full day's salary.
// - A working day with no punch and no leave is an absence and costs a full day's salary.
// - One day's salary = monthly gross ÷ calendar days of the month (30 days: 27,000 → 900;
//   31 days: 27,000 → 870.97).
// - Days after today are not counted yet.

export const FREE_HALF_DAYS = 3;

/** How each day counts. */
export const DAY_COUNTS = {
  full: 'Full day',
  half: 'Half day (late)',
  paidLeave: 'Paid leave',
  unpaidLeave: 'Unpaid leave',
  unmarkedLeave: 'Leave (not marked paid or unpaid: counted as paid)',
  absent: 'Absent (no punch, no leave)',
  sunday: 'Sunday (off)',
  future: 'Not yet',
};

/**
 * @param {{ days: { countedAs: string }[], monthlyGrossPaise: number, calendarDays: number }} input
 * @returns the attendance numbers for the slip and the loss of pay in paise
 */
export function calculateMonth({ days, monthlyGrossPaise, calendarDays }) {
  const count = (kind) => days.filter((day) => day.countedAs === kind).length;
  const workingDays = days.filter((day) => day.countedAs !== 'sunday').length;
  const halfDays = count('half');
  const chargedHalfDays = Math.max(0, halfDays - FREE_HALF_DAYS);
  const unpaidLeaveDays = count('unpaidLeave');
  const absentDays = count('absent');
  const lossOfPayDays = unpaidLeaveDays + absentDays + chargedHalfDays / 2;
  const perDayPaise = calendarDays ? monthlyGrossPaise / calendarDays : 0;
  return {
    workingDays,
    fullDays: count('full'),
    halfDays,
    freeHalfDays: Math.min(halfDays, FREE_HALF_DAYS),
    chargedHalfDays,
    paidLeaveDays: count('paidLeave') + count('unmarkedLeave'),
    unmarkedLeaveDays: count('unmarkedLeave'),
    unpaidLeaveDays,
    absentDays,
    notYetDays: count('future'),
    lossOfPayDays,
    perDayPaise: Math.round(perDayPaise),
    monthlyGrossPaise,
    lossOfPayPaise: Math.round(perDayPaise * lossOfPayDays),
  };
}
