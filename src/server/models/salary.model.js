import mongoose from 'mongoose';
import { DEDUCTIONS, EARNINGS, EMPLOYER_CONTRIBUTIONS } from '../../config/payslipFields.js';

// Versioned salary structures (CEO spec section 5A). Every change is a new version; an approved
// version is never edited. Money is stored in paise (integers). Collection `salary_structures`.

// Monthly components, in the order shown on screens: the fixed lines of the salary slip
// (config/payslipFields.js), an incentive target, and the company's own contributions.
export const SALARY_COMPONENTS = {
  ...Object.fromEntries(
    EARNINGS.filter((line) => line.fixed).map((line) => [
      line.key,
      { label: line.label, kind: 'earning' },
    ]),
  ),
  incentiveTarget: { label: 'Incentive target (monthly)', kind: 'variable' },
  ...Object.fromEntries(
    EMPLOYER_CONTRIBUTIONS.map((line) => [line.key, { label: line.label, kind: 'employer' }]),
  ),
  ...Object.fromEntries(
    DEDUCTIONS.filter((line) => line.fixed).map((line) => [
      line.key,
      { label: line.label, kind: 'deduction' },
    ]),
  ),
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
