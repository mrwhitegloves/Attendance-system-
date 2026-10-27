import mongoose from 'mongoose';

// One punch (in or out), a leave day or a system "Absent" mark. Collection `attendances`.
// `date` is the India-time day ("2026-10-26") and `time` the India clock ("09:41 AM"), as in
// the first version; `at` is the exact moment, set by the server.

export const ATTENDANCE_STATUSES = ['Checked In', 'Checked Out', 'Leave', 'Late', 'Absent'];
export const PUNCH_IN_STATUSES = ['Checked In', 'Late'];

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    userName: { type: String, default: 'Unknown User' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    date: { type: String, required: true, index: true },
    time: { type: String, required: true },
    at: { type: Date, default: null },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    // app (the person punched), leave (approved leave), admin (corrected by HR), system (old auto-absent rows)
    source: { type: String, default: 'app' },
    lat: Number,
    lon: Number,
    location: { type: String, default: 'Unknown' },
    remark: { type: String, default: '' },
    // New photos: the S3 key of the private file.
    selfieKey: { type: String, default: null },
    // Photos of the first version: an ImageKit address (shown as is; ImageKit is no longer used).
    selfie: { type: String, default: null },
    ikFileId: { type: String, default: null },
    // On a "Leave" row: paid (true), unpaid (false) or not marked (null, counted as paid).
    paidLeave: { type: Boolean, default: null },
    leaveRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', default: null },
  },
  { timestamps: true },
);

attendanceSchema.index({ employeeId: 1, date: -1 });
attendanceSchema.index({ date: 1, status: 1 });

export const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
