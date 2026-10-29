import mongoose from 'mongoose';

// Employee KYC links (founder, 2026-10-29). Collection `kyc_links`. HR makes a link for one
// employee; the employee opens /kyc/<token> without signing in, uploads files one by one
// (`uploads`) and submits the form once. Submitting writes everything into the employee's file,
// KYC record and documents; `submitted` keeps what was sent (no full PAN or account number).

export const KYC_LINK_STATUSES = ['open', 'submitted', 'closed'];

const kycLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true },
    status: { type: String, enum: KYC_LINK_STATUSES, default: 'open', index: true },
    expiresAt: { type: Date, required: true },
    // Files uploaded so far: { photo: { key, fileName, contentType, size }, panProof: …, 'doc:<typeId>': … }
    uploads: { type: mongoose.Schema.Types.Mixed, default: {} },
    submitted: { type: mongoose.Schema.Types.Mixed, default: null },
    submittedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'kyc_links' },
);

export const KycLink = mongoose.models.KycLink || mongoose.model('KycLink', kycLinkSchema);
