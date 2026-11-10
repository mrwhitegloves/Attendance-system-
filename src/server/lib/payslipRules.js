// The founder's rules for a month's salary from attendance (2026-10-27, earnings by paid days
// 2026-11-10). Pure functions.
//
// - Days before the joining date do not count at all: "Not joined yet" (no absence, no holiday,
//   no weekly off, no pay).
// - A punch-in more than 5 minutes after the expected time (from minute 6) is a half day;
//   an earlier punch-in is a full day.
// - One day's salary = monthly gross ÷ calendar days of the month (31 days: 22,000 → 709.68).
// - The salary is earned by paid days, line by line:
//   · each fixed earning (Basic …) is paid for full days, weekly offs, paid holidays, comp-off
//     days and half a day for every half day (its share of the month: value × days ÷ month);
//   · "Paid Leave" = one day's salary × paid leave days;
//   · "HD Allowance" = the other half of every half day (founder, 2026-11-10);
//   · unpaid leave and absence earn nothing.
// - "Loss of Pay" cuts half a day's salary for each half day beyond the first 3, so the first 3
//   half days are paid in full and every further one only half. Absence and unpaid leave are
//   not cut again: they are already left out of the earnings.
// - Days after today are not counted yet (paid like a full day until they happen).
// - On the slip: Total working days = full days + half days; Leaves taken = weekly offs +
//   holidays + comp-off days + paid leave + unpaid leave.

export const FREE_HALF_DAYS = 3;

/** How each day counts. */
export const DAY_COUNTS = {
  full: 'Full day',
  half: 'Half day (late)',
  paidLeave: 'Paid leave',
  unpaidLeave: 'Unpaid leave',
  unmarkedLeave: 'Leave (not marked paid or unpaid: counted as paid)',
  absent: 'Absent (no punch, no leave)',
  holiday: 'Holiday (paid)',
  compOff: 'Comp-off (paid, for a weekly off worked)',
  weeklyOff: 'Weekly off',
  weeklyOffWorked: 'Weekly off worked',
  notJoined: 'Not joined yet',
  future: 'Not yet',
};

/**
 * @param {{ days: { countedAs: string }[], monthlyGrossPaise: number, calendarDays: number }} input
 * @returns the attendance numbers for the slip, the paid days and the unpaid days (paise)
 */
export function calculateMonth({ days, monthlyGrossPaise, calendarDays }) {
  const count = (kind) => days.filter((day) => day.countedAs === kind).length;
  const notJoinedDays = count('notJoined');
  const weeklyOffs = count('weeklyOff');
  const weeklyOffsWorked = count('weeklyOffWorked');
  const workingDays = days.length - notJoinedDays - weeklyOffs - weeklyOffsWorked;
  const fullDays = count('full');
  const halfDays = count('half');
  const freeHalfDays = Math.min(halfDays, FREE_HALF_DAYS);
  const chargedHalfDays = halfDays - freeHalfDays;
  const paidLeaveDays = count('paidLeave') + count('unmarkedLeave');
  const unpaidLeaveDays = count('unpaidLeave');
  const absentDays = count('absent');
  const holidayDays = count('holiday');
  const compOffDays = count('compOff');
  const notYetDays = count('future');
  const lossOfPayDays = unpaidLeaveDays + absentDays + chargedHalfDays / 2;
  // Days paid through the fixed earnings (Basic …).
  const earnedDays =
    fullDays +
    weeklyOffs +
    weeklyOffsWorked +
    holidayDays +
    compOffDays +
    notYetDays +
    halfDays / 2;
  const perDayPaise = calendarDays ? monthlyGrossPaise / calendarDays : 0;
  return {
    workingDays,
    notJoinedDays,
    fullDays,
    halfDays,
    freeHalfDays,
    chargedHalfDays,
    paidLeaveDays,
    unmarkedLeaveDays: count('unmarkedLeave'),
    holidayDays,
    compOffDays,
    weeklyOffs,
    weeklyOffsWorked,
    unpaidLeaveDays,
    absentDays,
    notYetDays,
    earnedDays,
    calendarDays,
    // On the slip.
    slipWorkingDays: fullDays + halfDays,
    leavesTaken: weeklyOffs + holidayDays + compOffDays + paidLeaveDays + unpaidLeaveDays,
    // For information: the days not paid in all (absence, unpaid leave, the cut half days).
    lossOfPayDays,
    lossOfPayPaise: Math.round(perDayPaise * lossOfPayDays),
    perDayPaise: Math.round(perDayPaise),
    monthlyGrossPaise,
    paidLeavePaise: Math.round(perDayPaise * paidLeaveDays),
    hdAllowancePaise: Math.round((perDayPaise / 2) * halfDays),
    // The "Loss of Pay" deduction: half a day for each half day beyond the free ones.
    halfDayCutPaise: Math.round((perDayPaise / 2) * chargedHalfDays),
  };
}

/**
 * The earnings the attendance decides: each fixed line for its share of the earned days, the
 * paid leave and the HD allowance. `fixedEarnings`: the monthly amounts of the salary structure.
 */
export function attendanceEarnings(fixedEarnings, calculation) {
  const { earnedDays, calendarDays } = calculation;
  const share = (value) => (calendarDays ? Math.round((value * earnedDays) / calendarDays) : 0);
  return {
    ...Object.fromEntries(
      Object.entries(fixedEarnings).map(([key, value]) => [key, share(value ?? 0)]),
    ),
    paidLeave: calculation.paidLeavePaise,
    hdAllowance: calculation.hdAllowancePaise,
  };
}
