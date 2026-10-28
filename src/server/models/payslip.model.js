import mongoose from 'mongoose';
import { ATTENDANCE_SUMMARY, DEDUCTIONS, EARNINGS } from '../../config/payslipFields.js';

// Monthly salary slips (one per employee and month). Collection `payslips`.
// A draft can be changed field by field; a final slip is locked (re-opened only with a reason).
// Money in paise. The employee and company details are copied in, so an old slip never changes
// when the employee file or company settings change later.

export const PAYSLIP_STATUSES = ['draft', 'final'];

const amounts = (lines) =>
  Object.fromEntries(lines.map((line) => [line.key, { type: Number, default: 0, min: 0 }]));

const payslipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    month: { type: String, required: true, index: true }, // "2026-09"
    status: { type: String, enum: PAYSLIP_STATUSES, default: 'draft', index: true },

    employee: {
      name: { type: String, default: '' },
      code: { type: String, default: '' },
      designation: { type: String, default: '' },
      department: { type: String, default: '' },
      joiningDate: { type: String, default: '' },
      bankName: { type: String, default: '' },
      // Mr. White Gloves or EngenX: the logo and header line of the slip.
      brandKey: { type: String, default: 'mwg' },
      // Sealed full numbers (lib/secretBox.js) and their last 4 digits for screens.
      panSealed: { type: String, default: null },
      panLast4: { type: String, default: '' },
      accountSealed: { type: String, default: null },
      accountLast4: { type: String, default: '' },
    },
    attendance: Object.fromEntries(
      ATTENDANCE_SUMMARY.map((line) => [line.key, { type: Number, default: 0, min: 0 }]),
    ),
    earnings: amounts(EARNINGS),
    deductions: amounts(DEDUCTIONS),
    totals: {
      earnings: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
    },
    netInWords: { type: String, default: '' },
    // How the attendance numbers and loss of pay were worked out when the slip was filled
    // (lib/payslipRules.js). Shown on the slip screen; changing a field by hand does not change it.
    calculation: { type: mongoose.Schema.Types.Mixed, default: null },
    notes: { type: String, default: '' },

    // Where the first values came from.
    salaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalaryStructure',
      default: null,
    },
    salaryVersion: { type: Number, default: null },

    // Copied in when the slip is made final.
    company: { type: mongoose.Schema.Types.Mixed, default: null },

    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastEditedAt: { type: Date, default: null },
    finalisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalisedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'payslips' },
);
payslipSchema.index({ userId: 1, month: 1 }, { unique: true });

export const Payslip = mongoose.models.Payslip || mongoose.model('Payslip', payslipSchema);
