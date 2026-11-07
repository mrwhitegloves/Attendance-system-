import mongoose from 'mongoose';

// One correction of a day's punch times by HR or the CEO (founder, 2026-11-07), with the reason.
// Collection `attendance_edits`. Kept so the screen can say how often a person's month was edited.

const punchesSchema = new mongoose.Schema(
  {
    status: { type: String, default: '' }, // the day's status before / after ("Absent", "Late" …)
    punchIn: { type: String, default: '' }, // India clock, "09:41 AM"; '' when there was none
    punchOut: { type: String, default: '' },
  },
  { _id: false },
);

const attendanceEditSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeId: { type: String, required: true },
    date: { type: String, required: true }, // the day edited, "2026-10-14"
    month: { type: String, required: true }, // "2026-10"
    before: { type: punchesSchema, default: () => ({}) },
    after: { type: punchesSchema, default: () => ({}) },
    reason: { type: String, required: true, trim: true },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editedByName: { type: String, default: '' },
  },
  { timestamps: true, collection: 'attendance_edits' },
);

attendanceEditSchema.index({ employeeId: 1, month: 1, createdAt: -1 });

export const AttendanceEdit =
  mongoose.models.AttendanceEdit || mongoose.model('AttendanceEdit', attendanceEditSchema);
