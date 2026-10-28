import mongoose from 'mongoose';

// KYC and bank details: one document per employee. Collection `kyc_records`.
// Full PAN and bank account numbers are sealed (lib/secretBox.js); screens see only the last
// digits. Aadhaar: only the last 4 digits and the verification record are kept, never the number.

export const KYC_ITEMS = ['pan', 'aadhaar', 'bank'];
export const KYC_STATUSES = ['missing', 'submitted', 'under_review', 'verified', 'rejected'];

const proofSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    fileName: { type: String, default: '' },
    contentType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// What every item has: its status, who entered it, who checked it, and its proof files
// (every upload is kept; the last one is the current proof).
const reviewFields = {
  status: { type: String, enum: KYC_STATUSES, default: 'missing' },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  enteredAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectReason: { type: String, default: '' },
  proofs: { type: [proofSchema], default: [] },
};

const kycSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: String, required: true },
    pan: {
      ...reviewFields,
      sealed: { type: String, default: null },
      last4: { type: String, default: '' },
      nameOnPan: { type: String, default: '' },
    },
    aadhaar: {
      ...reviewFields,
      last4: { type: String, default: '' },
    },
    bank: {
      ...reviewFields,
      accountHolderName: { type: String, default: '' },
      bankName: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      accountSealed: { type: String, default: null },
      accountLast4: { type: String, default: '' },
    },
  },
  { timestamps: true, collection: 'kyc_records' },
);

kycSchema.index({ 'pan.status': 1 });
kycSchema.index({ 'aadhaar.status': 1 });
kycSchema.index({ 'bank.status': 1 });

export const Kyc = mongoose.models.Kyc || mongoose.model('Kyc', kycSchema);
