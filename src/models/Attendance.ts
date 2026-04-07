import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
  },
  userName: {
    type: String,
    default: 'Unknown User'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  time: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Checked In', 'Checked Out', 'Leave', 'Late'],
    required: true,
  },
  lat: Number,
  lon: Number,
  location: {
    type: String,
    default: 'Unknown',
  },
  remark: {
    type: String,
    default: '',
  },
  selfie: {
    type: String, // Store ImageKit URL
    default: null,
  },
  ikFileId: {
    type: String, // Store ImageKit File ID for deletion
    default: null,
  },
}, { timestamps: true });

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
