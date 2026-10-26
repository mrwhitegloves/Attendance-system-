import mongoose from 'mongoose';

// A leave request. Collection `leaverequests` (same as the first version).

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

const leaveRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: LEAVE_STATUSES, default: 'pending', index: true },
    adminNote: { type: String, default: '' },
    processedAt: { type: Date, default: null },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true },
);

export const LeaveRequest =
  mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema);
