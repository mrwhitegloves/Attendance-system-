// The monthly salary components with the words the screens show (same keys as the server model).
export const SALARY_COMPONENTS = [
  { key: 'basic', label: 'Basic', kind: 'earning' },
  { key: 'hra', label: 'HRA', kind: 'earning' },
  { key: 'specialAllowance', label: 'Special allowance', kind: 'earning' },
  { key: 'conveyance', label: 'Conveyance', kind: 'earning' },
  { key: 'otherAllowances', label: 'Other allowances', kind: 'earning' },
  { key: 'variablePay', label: 'Variable pay / incentive target', kind: 'variable' },
  { key: 'employerPf', label: 'Company PF', kind: 'employer' },
  { key: 'employerEsi', label: 'Company ESI', kind: 'employer' },
  { key: 'employeePf', label: 'Employee PF', kind: 'deduction' },
  { key: 'employeeEsi', label: 'Employee ESI', kind: 'deduction' },
  { key: 'professionalTax', label: 'Professional tax', kind: 'deduction' },
  { key: 'tds', label: 'Income tax (TDS) estimate', kind: 'deduction' },
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
