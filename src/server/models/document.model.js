import mongoose from 'mongoose';

// Employee documents (CEO spec section 4).
// `document_types` is the catalogue (Settings → Document types); `employee_documents` holds one
// record per employee and type, with every uploaded version kept (nothing is ever deleted).

export const DOCUMENT_CATEGORIES = {
  hiring: 'Hiring',
  identity: 'Identity',
  employment: 'Employment',
  qualifications: 'Qualifications',
  payroll: 'Payroll',
  policies: 'Policies',
  performance: 'Performance',
  exit: 'Exit',
};
export const DOCUMENT_STATUSES = ['submitted', 'under_review', 'verified', 'rejected', 'expired'];
export const SIGNATURE_STATUSES = ['not_needed', 'pending', 'signed'];

const documentTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: Object.keys(DOCUMENT_CATEGORIES), required: true },
    // Required types count in the file completeness.
    required: { type: Boolean, default: false },
    hasExpiry: { type: Boolean, default: false },
    needsSignature: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'document_types' },
);
documentTypeSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const DocumentType =
  mongoose.models.DocumentType || mongoose.model('DocumentType', documentTypeSchema);

const versionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  fileName: { type: String, default: '' },
  contentType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  note: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
});

const employeeDocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeId: { type: String, required: true, index: true },
    typeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentType', required: true },
    status: { type: String, enum: DOCUMENT_STATUSES, default: 'submitted', index: true },
    signature: { type: String, enum: SIGNATURE_STATUSES, default: 'not_needed' },
    expiresOn: { type: String, default: '', index: true }, // "2027-03-31"
    versions: { type: [versionSchema], default: [] },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectReason: { type: String, default: '' },
  },
  { timestamps: true, collection: 'employee_documents' },
);
employeeDocumentSchema.index({ userId: 1, typeId: 1 }, { unique: true });

export const EmployeeDocument =
  mongoose.models.EmployeeDocument || mongoose.model('EmployeeDocument', employeeDocumentSchema);

/** The starting catalogue, from the CEO spec's document table. */
export const DEFAULT_DOCUMENT_TYPES = [
  ['hiring', 'Resume', { required: true }],
  ['hiring', 'Interview evaluation'],
  ['hiring', 'Offer letter (signed)', { required: true, needsSignature: true }],
  ['identity', 'Address proof'],
  ['employment', 'Appointment letter (signed)', { required: true, needsSignature: true }],
  ['employment', 'Employment agreement (signed)', { required: true, needsSignature: true }],
  ['employment', 'NDA (signed)', { required: true, needsSignature: true }],
  ['employment', 'Role description'],
  ['qualifications', 'Education certificate', { required: true }],
  ['qualifications', 'Experience certificate'],
  ['qualifications', 'Professional certificate', { hasExpiry: true }],
  ['payroll', 'Tax declaration'],
  ['policies', 'Code of conduct acknowledgement', { required: true, needsSignature: true }],
  ['policies', 'Leave policy acknowledgement', { needsSignature: true }],
  ['policies', 'IT and asset policy acknowledgement', { needsSignature: true }],
  ['performance', 'Appraisal letter'],
  ['performance', 'Promotion letter'],
  ['performance', 'Salary revision letter'],
  ['performance', 'Warning letter'],
  ['exit', 'Resignation letter'],
  ['exit', 'Handover note'],
  ['exit', 'Asset clearance'],
  ['exit', 'Full-and-final statement'],
  ['exit', 'Relieving letter'],
  ['exit', 'Experience letter'],
];
