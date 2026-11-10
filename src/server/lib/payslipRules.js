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
//     days and half a day for each half day beyond the first 3 (its share of the month:
//     value × days ÷ month);
//   · "HD Allowance" = one full day's salary for each of the first 3 half days;
//   · "Paid Leave" = one day's salary × paid leave days;
//   · unpaid leave and absence earn nothing.
// - "Loss of Pay" shows what was not paid: a full day for each absence and unpaid leave day,
//   half a day for each half day beyond the first 3. It is shown, not subtracted again (the
//   earnings already leave it out): total earnings + loss of pay = the monthly salary, and the
//   net is the earnings less the other deductions (founder, 2026-11-10).
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
    chargedHalfDays / 2;
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
    // "Loss of Pay": the days not paid (absence, unpaid leave, half of each extra half day).
    lossOfPayDays,
    lossOfPayPaise: Math.round(perDayPaise * lossOfPayDays),
    // Shown on the slip, not subtracted from the net (the earnings already leave it out).
    lossOfPayShownOnly: true,
    perDayPaise: Math.round(perDayPaise),
    monthlyGrossPaise,
    paidLeavePaise: Math.round(perDayPaise * paidLeaveDays),
    hdAllowancePaise: Math.round(perDayPaise * freeHalfDays),
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
