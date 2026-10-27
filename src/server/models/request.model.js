import mongoose from 'mongoose';
import { REQUEST_KIND_KEYS, REQUEST_STATUSES } from '../../config/requestKinds.js';

// An employee request: expense claim, salary advance, document request or grievance.
// Collection `requests`. Leave keeps `leaverequests`; salary revisions keep `salary_structures`.
// Money in paise. Files are S3 keys (the bucket is private; answers carry signed links).

const attachmentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    fileName: { type: String, required: true },
    contentType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const requestSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    kind: { type: String, enum: REQUEST_KIND_KEYS, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    subject: { type: String, required: true, maxlength: 120 },
    details: { type: String, default: '', maxlength: 2000 },
    category: { type: String, default: '' },
    amountPaise: { type: Number, default: null, min: 0 },
    // Expense: the day the money was spent. Document: the day it is needed by.
    date: { type: String, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    status: { type: String, enum: REQUEST_STATUSES, default: 'pending', index: true },
    // Money requests may be approved for less than asked.
    approvedAmountPaise: { type: Number, default: null, min: 0 },
    decisionNote: { type: String, default: '' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedByName: { type: String, default: '' },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

requestSchema.index({ status: 1, createdAt: -1 });

export const EmployeeRequest =
  mongoose.models.EmployeeRequest || mongoose.model('EmployeeRequest', requestSchema, 'requests');
