// Every line of the MWG salary slip, in the order printed. Shared by the server (models,
// validation) and the screens, so a line exists in exactly one place.
// `fixed: true` lines also belong to the monthly salary structure; the others change month to month.
// `fromAttendance: true` lines are worked out from the month's attendance (lib/payslipRules.js).

export const EARNINGS = [
  { key: 'basic', label: 'Basic Salary', fixed: true },
  // One day's salary for each paid leave day (founder, 2026-11-10).
  { key: 'paidLeave', label: 'Paid Leave', fromAttendance: true },
  { key: 'dearnessAllowance', label: 'Dearness Allowance', fixed: true },
  { key: 'hra', label: 'HRA', fixed: true },
  { key: 'tiffinAllowance', label: 'Tiffin Allowance', fixed: true },
  { key: 'compensatoryAllowance', label: 'Compensatory Allowance', fixed: true },
  { key: 'assistantAllowance', label: 'Assistant Allowance', fixed: true },
  { key: 'overtime', label: 'Over Time' },
  // Half a day's salary for each of the first 3 half days (founder, 2026-11-10).
  { key: 'hdAllowance', label: 'HD Allowance', fromAttendance: true },
  { key: 'reimbursement', label: 'Reimbursement' },
  { key: 'petrolAllowance', label: 'Petrol Allowance', fixed: true },
  { key: 'incentive', label: 'Incentive' },
  { key: 'medicalAllowance', label: 'Medical Allowance', fixed: true },
];

export const DEDUCTIONS = [
  { key: 'pf', label: 'PF', fixed: true },
  { key: 'professionalTax', label: 'Professional Tax', fixed: true },
  { key: 'tds', label: 'TDS', fixed: true },
  // Not filled any more (founder, 2026-11-10): unpaid days are already left out of the
  // earnings. Kept for old slips and for a cut typed by hand.
  { key: 'lossOfPay', label: 'Loss of Pay (unpaid days)' },
  { key: 'advance', label: 'Advance' },
  { key: 'salaryPaid', label: 'Salary Paid' },
  { key: 'penalty', label: 'Penalty' },
  { key: 'petrolAllowancePaid', label: 'Petrol Allowance Paid' },
];

export const ATTENDANCE_SUMMARY = [
  { key: 'totalWorkingDays', label: 'Total working days' },
  { key: 'fullDays', label: 'Full days' },
  { key: 'halfDays', label: 'Half days' },
  { key: 'leavesTaken', label: 'Leaves taken' },
  { key: 'balanceLeaves', label: 'Balance leaves' },
  // Unpaid leave, absence and half of each half day beyond the free ones (information only).
  { key: 'unpaidDays', label: 'Unpaid days' },
];

// Company contributions: part of the cost to company, never printed on the slip.
export const EMPLOYER_CONTRIBUTIONS = [
  { key: 'employerPf', label: 'Company PF' },
  { key: 'employerEsi', label: 'Company ESI' },
];
