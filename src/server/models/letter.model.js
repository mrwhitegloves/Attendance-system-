import mongoose from 'mongoose';

// Letters (CEO spec section 4: offer letter lifecycle). `letter_templates` are edited in
// Settings → Letter templates; `letters` are the letters issued to employees and candidates. A letter keeps the
// exact text it was issued with; re-issuing makes a new version and supersedes the old one.

export const LETTER_KINDS = {
  offer: 'Offer letter',
  appointment: 'Appointment letter',
  salary_revision: 'Salary revision letter',
  confirmation: 'Confirmation letter',
  relieving: 'Relieving letter',
  experience: 'Experience letter',
  other: 'Other letter',
};
export const LETTER_STATUSES = ['draft', 'issued', 'accepted', 'declined', 'superseded'];

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: Object.keys(LETTER_KINDS), required: true },
    subject: { type: String, default: '' },
    // Plain text; a blank line starts a new paragraph; {{placeholders}} are filled in.
    body: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'letter_templates' },
);
export const LetterTemplate =
  mongoose.models.LetterTemplate || mongoose.model('LetterTemplate', templateSchema);

const letterSchema = new mongoose.Schema(
  {
    // The employee; empty for a candidate's offer letter until the candidate joins.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    employeeId: { type: String, default: '', index: true },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      default: null,
      index: true,
    },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'LetterTemplate', default: null },
    kind: { type: String, enum: Object.keys(LETTER_KINDS), required: true },
    version: { type: Number, default: 1 },
    status: { type: String, enum: LETTER_STATUSES, default: 'draft', index: true },
    subject: { type: String, default: '' },
    // The template text while a draft; the final filled-in text once issued.
    body: { type: String, default: '' },
    // Values typed for this letter (CTC in paise, probation months, accept-by date …).
    fields: {
      ctcAnnualPaise: { type: Number, default: null },
      probationMonths: { type: Number, default: null },
      acceptBy: { type: String, default: '' },
      joiningDate: { type: String, default: '' },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    issuedAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    // 'employee' when accepted in the app, 'hr' when HR recorded a signed copy or a reply.
    respondedVia: { type: String, default: '' },
    responseNote: { type: String, default: '' },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Letter', default: null },
  },
  { timestamps: true, collection: 'letters' },
);
export const Letter = mongoose.models.Letter || mongoose.model('Letter', letterSchema);

/** Company details printed on letters (Settings → Company). One document, key "company". */
const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'app_settings' },
);
export const AppSetting =
  mongoose.models.AppSetting || mongoose.model('AppSetting', appSettingSchema);
