import mongoose from 'mongoose';

// A person who signs in: every employee, and the CEO/HR/Finance accounts.
// Collection `users` (the same collection the first version used; old fields are kept).
// Phase 1 adds the full employee master record next to it.

export const USER_STATUSES = ['active', 'inactive'];
export const STAFF_TYPES = ['Office Staff', 'Field Staff', 'Management', 'Intern'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    // Permanent ID "MWG-001", given once, never changed or reused.
    employeeId: { type: String, required: true, unique: true },
    mwgId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    // Sign-in name for accounts without an email (the first admin account).
    username: { type: String, unique: true, sparse: true, trim: true },
    // Stored as typed (founder decision, same as the CRM). Compared only by passwordsMatch().
    password: { type: String, required: true },
    department: { type: String, default: '' },
    staffType: { type: String, default: 'Office Staff' },
    expectedInTime: { type: String, default: '09:30' },
    expectedOutTime: { type: String, default: '18:30' },
    // Old flag of the first version; the role decides access now. Kept for old records.
    isAdmin: { type: Boolean, default: false },
    roleKey: { type: String, default: 'employee', index: true },
    status: { type: String, enum: USER_STATUSES, default: 'active', index: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);

/** Fields any API answer may show. Never the password. */
export const PUBLIC_USER_FIELDS =
  '_id name phone employeeId email username department staffType expectedInTime expectedOutTime roleKey status managerId lastLoginAt createdAt updatedAt';
