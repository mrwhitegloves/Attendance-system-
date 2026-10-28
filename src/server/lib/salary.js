import { SALARY_COMPONENTS } from '../models/salary.model.js';

// Salary totals from the monthly components (all in paise). Pure function.
// Gross = fixed earnings; net = gross − employee deductions;
// monthly CTC = gross + variable target + company contributions; annual CTC = 12 × monthly.

export function salaryTotals(components) {
  const sum = (kind) =>
    Object.entries(SALARY_COMPONENTS)
      .filter(([, component]) => component.kind === kind)
      .reduce((total, [key]) => total + (components[key] ?? 0), 0);
  const monthlyGross = sum('earning');
  const monthlyDeductions = sum('deduction');
  const monthlyEmployer = sum('employer');
  const monthlyCtc = monthlyGross + sum('variable') + monthlyEmployer;
  return {
    monthlyGross,
    monthlyDeductions,
    monthlyNet: monthlyGross - monthlyDeductions,
    monthlyEmployer,
    monthlyCtc,
    annualCtc: monthlyCtc * 12,
  };
}
