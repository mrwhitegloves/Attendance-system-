import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  phone: {
    type: String,
    default: '',
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
  },
  mwgId: { // Standard identifier for MWG system
    type: String,
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    required: false,   // Email is optional — admin can add users without one
    unique: true,
    sparse: true,      // Allows multiple docs to have no email without unique-key clash
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
    default: 'Office Staff',
  },
  expectedInTime: {
    type: String,
    default: '09:30', // Default format HH:MM
  },
  expectedOutTime: {
    type: String,
    default: '18:30',
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
