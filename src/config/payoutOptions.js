// Salary payouts (CEO answers, 2026-10-28): a final salary slip is paid only after the CEO
// approves it; HR or Finance pays it by hand (bank upload file, UPI, cash or cheque) and records
// the date and the reference. The salary of a month is due on the 10th of the next month.

export const PAYOUT_STATUS = {
  unpaid: { label: 'Waiting for approval', tone: 'warning' },
  approved: { label: 'Approved, not paid', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
};
export const PAYOUT_STATUSES = Object.keys(PAYOUT_STATUS);

export const PAY_MODES = {
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  cash: 'Cash',
};
export const payModeOptions = Object.entries(PAY_MODES).map(([value, label]) => ({ value, label }));

/** Every way of paying except cash leaves a reference (UTR, UPI or cheque number). */
export const needsReference = (mode) => mode !== 'cash';

export const SALARY_DUE_DAY = 10;

/** "2026-10" → "2026-11-10": the day the salary of a month is due. */
export function salaryDueOn(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber, SALARY_DUE_DAY));
  return next.toISOString().slice(0, 10);
}
