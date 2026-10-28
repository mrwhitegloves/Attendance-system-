import { DEDUCTIONS, EARNINGS, EMPLOYER_CONTRIBUTIONS } from './payslipFields.js';

// The monthly salary structure components with the words the screens show (same keys as the
// server model): the fixed lines of the salary slip, an incentive target, company contributions.
export const SALARY_COMPONENTS = [
  ...EARNINGS.filter((line) => line.fixed).map((line) => ({ ...line, kind: 'earning' })),
  { key: 'incentiveTarget', label: 'Incentive target (monthly)', kind: 'variable' },
  ...EMPLOYER_CONTRIBUTIONS.map((line) => ({ ...line, kind: 'employer' })),
  ...DEDUCTIONS.filter((line) => line.fixed).map((line) => ({ ...line, kind: 'deduction' })),
];

export const COMPONENT_GROUPS = [
  { kind: 'earning', label: 'Earnings (monthly)' },
  { kind: 'variable', label: 'Variable (monthly target)' },
  { kind: 'employer', label: 'Company contributions (monthly)' },
  { kind: 'deduction', label: 'Employee deductions (monthly)' },
];

export const SALARY_STATUS = {
  pending_approval: { label: 'Waiting for approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};
