import mongoose from 'mongoose';
import { BRAND_KEYS } from '../../config/brands.js';
import {
  ACCOUNT_STATUS,
  EMPLOYMENT_STATUS,
  EMPLOYMENT_TYPE,
  GENDER,
  WORK_MODE,
} from '../../config/employeeOptions.js';

// The employee master record: one document per person (employee, intern, consultant, field
// worker), who is also the person who signs in. Collection `users` (the same collection the
// first version used; old fields are kept). There is no second employee collection.

export const USER_STATUSES = ACCOUNT_STATUS.values;
export { STAFF_TYPES } from '../../config/employeeOptions.js';
export const GENDERS = GENDER.values;
export const EMPLOYMENT_TYPES = EMPLOYMENT_TYPE.values;
export const WORK_MODES = WORK_MODE.values;
export const EMPLOYMENT_STATUSES = EMPLOYMENT_STATUS.values;

const userSchema = new mongoose.Schema(
  {
    // ---- Identity and sign-in ----
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    // Permanent ID "MWG-001", given once, never changed or reused.
    employeeId: { type: String, required: true, unique: true },
    mwgId: { type: String, unique: true, sparse: true },
    // The code printed on salary slips and letters ("MWG-FSD-25-001"); the ID above when empty.
    employeeCode: { type: String, default: '', trim: true },
    // Work email, also usable to sign in.
    email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    // Sign-in name for accounts without an email (the first admin account).
    username: { type: String, unique: true, sparse: true, trim: true },
    // Stored as typed (founder decision, same as the CRM). Compared only by passwordsMatch().
    password: { type: String, required: true },
    // Old flag of the first version; the role decides access now. Kept for old records.
    isAdmin: { type: Boolean, default: false },
    roleKey: { type: String, default: 'employee', index: true },
    // Sign-in allowed or not. The employment status below is a separate thing.
    status: { type: String, enum: USER_STATUSES, default: 'active', index: true },
    lastLoginAt: { type: Date, default: null },

    // ---- Personal ----
    // S3 key of the profile photo (private; shown through a signed link).
    photoKey: { type: String, default: null },
    dateOfBirth: { type: String, default: '' }, // "1995-04-21"
    gender: { type: String, enum: [...GENDERS, ''], default: '' },
    bloodGroup: { type: String, default: '' },
    personalEmail: { type: String, default: '', trim: true, lowercase: true },
    currentAddress: { type: String, default: '' },
    permanentAddress: { type: String, default: '' },
    emergencyContact: {
      name: { type: String, default: '' },
      relation: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    // From the KYC form (founder, 2026-10-30): fresher, or the last company before this one.
    previousEmployment: {
      experienceType: { type: String, enum: ['fresher', 'experienced', ''], default: '' },
      companyName: { type: String, default: '' },
      hrName: { type: String, default: '' },
      hrPhone: { type: String, default: '' },
      hrEmail: { type: String, default: '' },
      reportingManager: { type: String, default: '' },
      lastDrawnMonthlyPaise: { type: Number, default: null },
    },

    // ---- Employment ----
    // Names from the managed lists (Settings → Lists); a rename updates every employee.
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
    branch: { type: String, default: '' },
    staffType: { type: String, default: 'Office Staff' },
    employmentType: { type: String, enum: [...EMPLOYMENT_TYPES, ''], default: '' },
    workMode: { type: String, enum: [...WORK_MODES, ''], default: '' },
    employmentStatus: {
      type: String,
      enum: [...EMPLOYMENT_STATUSES, ''],
      default: '',
      index: true,
    },
    joiningDate: { type: String, default: '' },
    probationEndDate: { type: String, default: '' },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Mr. White Gloves or EngenX (config/brands.js); old records have none: the parent brand.
    brandKey: { type: String, enum: [...BRAND_KEYS, ''], default: 'mwg' },
    // Weekly days off, 0 = Sunday … 6 = Saturday (founder, 2026-10-28: any day, one or two).
    // Old records have none: Sunday.
    weeklyOffs: { type: [Number], default: undefined },
    expectedInTime: { type: String, default: '09:30' },
    expectedOutTime: { type: String, default: '18:30' },

    // ---- Worked out by the server, never typed ----
    // How complete the employee's file is. Recomputed on every change (lib/completeness.js).
    completeness: {
      percent: { type: Number, default: 0, index: true },
      missing: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);

/** Fields any API answer may show. Never the password. */
export const PUBLIC_USER_FIELDS = [
  '_id name phone employeeId employeeCode email username roleKey status lastLoginAt createdAt updatedAt',
  'photoKey dateOfBirth gender bloodGroup personalEmail currentAddress permanentAddress emergencyContact',
  'previousEmployment',
  'department designation branch staffType employmentType workMode employmentStatus joiningDate',
  'probationEndDate managerId expectedInTime expectedOutTime completeness brandKey weeklyOffs',
].join(' ');
