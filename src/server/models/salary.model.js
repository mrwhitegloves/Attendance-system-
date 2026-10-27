import mongoose from 'mongoose';

// Versioned salary structures (CEO spec section 5A). Every change is a new version; an approved
// version is never edited. Money is stored in paise (integers). Collection `salary_structures`.

// Monthly components, in the order shown on screens.
export const SALARY_COMPONENTS = {
  basic: { label: 'Basic', kind: 'earning' },
  hra: { label: 'HRA', kind: 'earning' },
  specialAllowance: { label: 'Special allowance', kind: 'earning' },
  conveyance: { label: 'Conveyance', kind: 'earning' },
  otherAllowances: { label: 'Other allowances', kind: 'earning' },
  variablePay: { label: 'Variable pay / incentive target', kind: 'variable' },
  employerPf: { label: 'Company PF', kind: 'employer' },
  employerEsi: { label: 'Company ESI', kind: 'employer' },
  employeePf: { label: 'Employee PF', kind: 'deduction' },
  employeeEsi: { label: 'Employee ESI', kind: 'deduction' },
  professionalTax: { label: 'Professional tax', kind: 'deduction' },
  tds: { label: 'Income tax (TDS) estimate', kind: 'deduction' },
};
export const SALARY_STATUSES = ['pending_approval', 'approved', 'rejected', 'withdrawn'];

const amounts = Object.fromEntries(
  Object.keys(SALARY_COMPONENTS).map((key) => [key, { type: Number, default: 0, min: 0 }]),
);

const salarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    effectiveFrom: { type: String, required: true }, // "2026-11-01"
    status: { type: String, enum: SALARY_STATUSES, default: 'pending_approval', index: true },
    reason: { type: String, default: '' },
    components: amounts,
    // Worked out by the server from the components (paise).
    totals: {
      monthlyGross: { type: Number, default: 0 },
      monthlyDeductions: { type: Number, default: 0 },
      monthlyNet: { type: Number, default: 0 },
      monthlyEmployer: { type: Number, default: 0 },
      monthlyCtc: { type: Number, default: 0 },
      annualCtc: { type: Number, default: 0 },
    },
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    preparedAt: { type: Date, default: Date.now },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: '' },
  },
  { timestamps: true, collection: 'salary_structures' },
);
salarySchema.index({ userId: 1, version: 1 }, { unique: true });

export const SalaryStructure =
  mongoose.models.SalaryStructure || mongoose.model('SalaryStructure', salarySchema);
