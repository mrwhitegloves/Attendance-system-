import mongoose from 'mongoose';
import { EXIT_STATUSES, EXIT_TYPES } from '../../config/exitOptions.js';
import { taskSchema } from './onboarding.model.js';

// An employee leaving (CEO spec: "resignation, notice period, asset recovery, final dues and
// relieving documents"). Collection `exits`. One open exit per employee; old ones are kept (a
// withdrawn resignation, or an earlier exit of someone re-hired). Tasks are copied from
// Settings → Lists (exit tasks) when it starts. The full-and-final settlement comes with payouts.

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
  },
  { timestamps: true },
);

export const Exit = mongoose.models.Exit || mongoose.model('Exit', exitSchema);
