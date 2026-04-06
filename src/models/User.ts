import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
  },
  staffType: {
    type: String,
    enum: ['Office Staff', 'Field Staff'],
    default: 'Office Staff',
  },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
