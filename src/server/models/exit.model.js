import mongoose from 'mongoose';
import { EXIT_STATUSES, EXIT_TYPES } from '../../config/exitOptions.js';
import { taskSchema } from './onboarding.model.js';

// An employee leaving (CEO spec: "resignation, notice period, asset recovery, final dues and
// relieving documents"). Collection `exits`. One open exit per employee; old ones are kept (a
// withdrawn resignation, or an earlier exit of someone re-hired). Tasks are copied from
// Settings → Lists (exit tasks) when it starts. The full-and-final settlement is on the exit.

// One line of the full-and-final settlement: money added for the employee, or taken back.
const settlementLineSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['add', 'deduct'], required: true },
    label: { type: String, required: true, maxlength: 120 },
    amountPaise: { type: Number, required: true, min: 0 },
    note: { type: String, default: '', maxlength: 300 },
  },
  { _id: false },
);

// The full-and-final settlement (founder, 2026-10-28). Prepared by HR, approved by the CEO
// like every payout, then paid (or the money owed recovered) with a reference.
const settlementSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
    // Days of notice the employee had to give (the offer letter says 30).
    noticeDays: { type: Number, default: 30, min: 0, max: 180 },
    lines: { type: [settlementLineSchema], default: [] },
    // Paise. net > 0: the company pays; net < 0: the employee pays back.
    totals: {
      add: { type: Number, default: 0 },
      deduct: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
    },
    // How the suggested lines were worked out (shown on the screen and the statement).
    basis: { type: mongoose.Schema.Types.Mixed, default: null },
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    preparedByName: { type: String, default: '' },
    preparedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedByName: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    paidOn: { type: String, default: null },
    mode: { type: String, default: '' },
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    paidByName: { type: String, default: '' },
  },
  { _id: false },
);

const exitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    type: { type: String, enum: Object.keys(EXIT_TYPES), required: true },
    // The day the resignation was given or the employee was told.
    noticeDate: { type: String, required: true },
    lastWorkingDay: { type: String, required: true },
    reason: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: EXIT_STATUSES, default: 'notice', index: true },
    tasks: { type: [taskSchema], default: [] },
    // Restored when a resignation is withdrawn.
    previousEmploymentStatus: { type: String, default: '' },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedByName: { type: String, default: '' },
    closingNote: { type: String, default: '' },
    settlement: { type: settlementSchema, default: null },
  },
  { timestamps: true },
);

export const Exit = mongoose.models.Exit || mongoose.model('Exit', exitSchema);
