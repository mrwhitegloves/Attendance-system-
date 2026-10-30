import mongoose from 'mongoose';

// Employee KYC links (founder, 2026-10-29). Collection `kyc_links`. HR makes a link for one
// employee; the employee opens /kyc/<token> without signing in, uploads files one by one
// (`uploads`) and submits the form once. Submitting writes everything into the employee's file,
// KYC record and documents; `submitted` keeps what was sent (no full PAN or account number).

// open → submitted (waiting for HR) → approved (written into the file); HR may send it back
// (open again, with `rejectReason`). Closed: stopped by HR.
export const KYC_LINK_STATUSES = ['open', 'submitted', 'approved', 'closed'];

const kycLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true },
    status: { type: String, enum: KYC_LINK_STATUSES, default: 'open', index: true },
    expiresAt: { type: Date, required: true },
    // Files uploaded so far: { photo: { key, fileName, contentType, size }, panProof: …, 'doc:<typeId>': … }
    uploads: { type: mongoose.Schema.Types.Mixed, default: {} },
    // What the employee has typed so far, saved while they type (sealed: it can hold the PAN
    // and account number). `draftRev` only grows, so an older save never overwrites a newer one.
    draftSealed: { type: String, default: null },
    draftRev: { type: Number, default: 0 },
    // The sent form, sealed, until HR approves it (then written into the file and removed).
    submissionSealed: { type: String, default: null },
    // After approval: a copy without the full PAN and account number.
    submitted: { type: mongoose.Schema.Types.Mixed, default: null },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectReason: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'kyc_links' },
);

export const KycLink = mongoose.models.KycLink || mongoose.model('KycLink', kycLinkSchema);
