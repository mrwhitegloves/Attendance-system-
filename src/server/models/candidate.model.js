import mongoose from 'mongoose';
import { BRAND_KEYS } from '../../config/brands.js';
import { EMPLOYMENT_TYPE, WORK_MODE } from '../../config/employeeOptions.js';
import { CANDIDATE_STATUSES } from '../../config/recruitmentOptions.js';

// A person HR wants to hire (CEO spec section 4, offer letter lifecycle). Collection
// `candidates`. Their offer letters are ordinary `letters` with `candidateId`. When they join,
// an employee (`users`) is made from this record and the letters move to the employee.

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, default: '' },
    // The last 10 digits of the phone (lib/phone.js): one offer letter per phone number.
    phoneKey: { type: String, default: '', index: true },
    // City and state ("Jamshedpur, Jharkhand"): printed under the name on the offer letter.
    address: { type: String, default: '' },
    // The planned job: names from Settings → Lists, like an employee's.
    designation: { type: String, default: '' },
    department: { type: String, default: '' },
    branch: { type: String, default: '' },
    staffType: { type: String, default: 'Office Staff' },
    employmentType: { type: String, enum: [...EMPLOYMENT_TYPE.values, ''], default: '' },
    workMode: { type: String, enum: [...WORK_MODE.values, ''], default: '' },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    roleKey: { type: String, default: 'employee' },
    brandKey: { type: String, enum: BRAND_KEYS, default: 'mwg' },
    expectedJoiningDate: { type: String, default: '' },
    source: { type: String, default: '' }, // referral, job portal …
    note: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: CANDIDATE_STATUSES, default: 'open', index: true },
    dropReason: { type: String, default: '' },
    dropNote: { type: String, default: '' },
    // Set when the candidate joins.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    joinedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
