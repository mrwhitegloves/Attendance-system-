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
    // app (the person punched), leave (approved leave), system (daily job), admin (corrected by HR)
    source: { type: String, default: 'app' },
    lat: Number,
    lon: Number,
    location: { type: String, default: 'Unknown' },
    remark: { type: String, default: '' },
    // New photos: the S3 key of the private file.
    selfieKey: { type: String, default: null },
    // Old photos: ImageKit address and file id (deleted after 30 days).
    selfie: { type: String, default: null },
    ikFileId: { type: String, default: null },
    leaveRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', default: null },
  },
  { timestamps: true },
);

attendanceSchema.index({ employeeId: 1, date: -1 });
attendanceSchema.index({ date: 1, status: 1 });

export const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
