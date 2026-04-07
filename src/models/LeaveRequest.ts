import mongoose from 'mongoose';

const LeaveRequestSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
  },
  employeeName: {
    type: String,
    required: true,
  },
  startDate: {
    type: String, // String for YYYY-MM-DD
    required: true,
  },
  endDate: {
    type: String, // String for YYYY-MM-DD
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  adminNote: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
}, { timestamps: true });

export default mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);
