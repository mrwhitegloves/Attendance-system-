import { randomBytes } from 'node:crypto';
import { KycLink } from '../models/kycLink.model.js';
import { User } from '../models/user.model.js';
import { DocumentType, EmployeeDocument } from '../models/document.model.js';
import { Kyc } from '../models/kyc.model.js';
import { can, requirePermission } from '../permissions/can.js';
import { open, seal } from '../lib/secretBox.js';
import { createAppError, notFound } from '../lib/errors.js';
import { containsRegex } from '../lib/pagination.js';
import { decodeFileDataUrl, safeFileName } from '../lib/files.js';
import { decodeImageDataUrl } from '../lib/images.js';
import { isFullPhone, phoneKey } from '../lib/phone.js';
import { isStorageConfigured, putFile, signedUrl } from '../infra/storage.js';
import { recordAudit } from './audit.service.js';
import { notifyUsers, usersWithPermission } from './push.service.js';
import { moveToTrash } from './trash.service.js';
import { refreshCompleteness } from './completeness.service.js';
import { createUser } from './users.service.js';
import { writeKycDetails, writeKycProof } from './kyc.service.js';
import { writeDocumentVersion } from './documents.service.js';

// Employee KYC links (founder, 2026-10-29). Rules:
// - HR (users.manage) makes a link for an employee, or for a new person from a name and phone
//   (an inactive employee is made at once; HR adds the job details and password later);
// - one open link per employee: a new link closes the older one; a link lasts LINK_DAYS days;
// - the link works without signing in; the long random token is the only key;
// - what the employee types is saved as a sealed draft while they type (reload keeps it);
// - files are uploaded one at a time (at most 3 MB per request); the form is submitted once and
//   waits for HR (users.manage + kyc.verify: HR Admin, CEO). Approve writes it into the
//   employee's file, KYC (verified) and documents (verified); send back opens the form again
//   with a reason and the answers filled in. HR can edit everything later.

export const LINK_DAYS = 30;
// Documents the KYC form asks for, by their name in the catalogue (Settings → Document types).
// (The experience certificate is asked in the previous company section.)
export const KYC_FORM_DOCUMENTS = ['Resume', 'Address proof', 'Education certificate'];
export const KYC_PROOFS = { panProof: 'pan', aadhaarProof: 'aadhaar', bankProof: 'bank' };
// Needed from everyone; an experienced person also sends PREVIOUS_FILES.
const REQUIRED_UPLOADS = ['photo', 'panProof', 'aadhaarProof', 'bankProof', 'signedOfferLetter'];

const linkPath = (token) => `/kyc/${token}`;

const stateOf = (link, now = new Date()) =>
  link.status === 'open' && link.expiresAt < now ? 'expired' : link.status;

async function employeeWithPhone(key) {
  const users = await User.find({ phone: { $nin: ['', null] } }, 'name employeeId phone').lean();
  return users.find((user) => phoneKey(user.phone) === key) ?? null;
}

/** The links, newest first, with the employee each is for. */
export async function listKycLinks(actor, { q, page = 1 } = {}) {
  requirePermission(actor, 'users.manage');
  const filter = {};
  if (q) {
    const pattern = containsRegex(q);
    const users = await User.find(
      { $or: [{ name: pattern }, { employeeId: pattern }, { phone: pattern }] },
      '_id',
    ).lean();
    filter.userId = { $in: users.map((user) => user._id) };
  }
  const pageSize = 25;
  const [links, total] = await Promise.all([
    KycLink.find(
      filter,
      'token userId employeeId status expiresAt submittedAt createdAt rejectReason reviewedAt',
    )
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    KycLink.countDocuments(filter),
  ]);
  const users = await User.find(
    { _id: { $in: links.map((link) => link.userId) } },
    'name phone employeeId status',
  ).lean();
  const userOf = new Map(users.map((user) => [String(user._id), user]));
  return {
    items: links.map((link) => ({
      _id: link._id,
      path: linkPath(link.token),
      state: stateOf(link),
      expiresAt: link.expiresAt,
      submittedAt: link.submittedAt,
      reviewedAt: link.reviewedAt,
      rejectReason: link.rejectReason || '',
      createdAt: link.createdAt,
      employee: userOf.get(String(link.userId)) ?? { name: '—', employeeId: link.employeeId },
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** A new link for an employee; their older open link stops working. */
export async function createKycLink(actor, userId, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const user = await User.findById(userId, 'name employeeId')
    .lean()
    .catch(() => null);
  if (!user) throw notFound('Employee');
  await KycLink.updateMany({ userId: user._id, status: 'open' }, { status: 'closed' });
  const link = await KycLink.create({
    token: randomBytes(24).toString('base64url'),
    userId: user._id,
    employeeId: user.employeeId,
    expiresAt: new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000),
    createdBy: actor._id,
  });
  await recordAudit(actor, {
    action: 'kyc_link.created',
    entity: 'user',
    entityId: user._id,
    summary: `KYC link made for ${user.name} (${user.employeeId})`,
    ip,
  });
  return { _id: link._id, path: linkPath(link.token), userId: user._id };
}

/**
 * A link for someone who is not in the system yet: an inactive employee is made from the name
 * and phone (random password, cannot sign in). HR completes the file and the password later.
 */
export async function createKycLinkForNewPerson(actor, { name, phone }, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  if (!isFullPhone(phone)) throw createAppError(400, 'phone: enter a 10-digit mobile number');
  const existing = await employeeWithPhone(phoneKey(phone));
  if (existing) {
    throw createAppError(
      409,
      `${existing.name} (${existing.employeeId}) already has this phone. Make the link for them instead.`,
    );
  }
  const user = await createUser(
    actor,
    {
      name,
      phone,
      password: randomBytes(18).toString('base64url'),
      roleKey: 'employee',
      staffType: 'Office Staff',
    },
    { ip },
  );
  await User.updateOne({ _id: user._id }, { status: 'inactive' });
  return createKycLink(actor, user._id, { ip });
}

/** HR stops a link before it is used. */
export async function closeKycLink(actor, id, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const link = await KycLink.findOneAndUpdate({ _id: id, status: 'open' }, { status: 'closed' })
    .lean()
    .catch(() => null);
  if (!link) throw createAppError(409, 'This link is not open.');
  await recordAudit(actor, {
    action: 'kyc_link.closed',
    entity: 'user',
    entityId: link.userId,
    summary: `KYC link of ${link.employeeId} closed`,
    ip,
  });
  return { ok: true };
}

/** Moves a link to Recently deleted (90 days, restorable); it stops working at once. */
export async function deleteKycLink(actor, id, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const link = await KycLink.findById(id)
    .lean()
    .catch(() => null);
  if (!link) throw notFound('KYC link');
  const user = await User.findById(link.userId, 'name').lean();
  await moveToTrash(
    actor,
    {
      kind: 'kyc_link',
      label: `KYC link of ${user?.name ?? link.employeeId} (${link.employeeId})`,
      detail: link.status === 'submitted' ? 'Submitted' : 'Not submitted',
      entityId: id,
      parts: [{ model: KycLink, filter: { _id: link._id } }],
    },
    { ip },
  );
  return { ok: true };
}

// ---- The public form (no sign-in; the token is the key) ----

async function openLink(token) {
  const link = await KycLink.findOne({ token: String(token) }).lean();
  if (!link) throw notFound('KYC link');
  const state = stateOf(link);
  if (state === 'expired' || state === 'closed') {
    throw createAppError(410, 'This KYC link no longer works. Please ask HR for a new one.', state);
  }
  return { link, state };
}

async function formDocumentTypes() {
  const types = await DocumentType.find({ active: true }, 'name hasExpiry')
    .collation({ locale: 'en', strength: 2 })
    .lean();
  return KYC_FORM_DOCUMENTS.map((name) =>
    types.find((type) => type.name.toLowerCase() === name.toLowerCase()),
  ).filter((type) => type && !type.hasExpiry);
}

async function typeNamed(name) {
  return DocumentType.findOne({ name, active: true })
    .collation({ locale: 'en', strength: 2 })
    .lean();
}

const requiredUploads = (experienceType) => [
  ...REQUIRED_UPLOADS,
  ...(experienceType === 'experienced' ? Object.keys(PREVIOUS_FILES) : []),
];

const readSealed = (sealed) => {
  if (!sealed) return null;
  try {
    return JSON.parse(open(sealed));
  } catch {
    return null;
  }
};

/** What the form shows: name, documents asked for, files sent so far, the saved draft. */
export async function getPublicKyc(token) {
  const { link, state } = await openLink(token);
  const user = await User.findById(link.userId, 'name employeeId brandKey').lean();
  if (state !== 'open') return { state, name: user?.name ?? '' };
  const documents = await formDocumentTypes();
  return {
    state,
    name: user?.name ?? '',
    employeeId: user?.employeeId ?? '',
    brandKey: user?.brandKey || 'mwg',
    expiresAt: link.expiresAt,
    rejectReason: link.rejectReason || '',
    documents: documents.map((type) => ({ field: `doc:${type._id}`, name: type.name })),
    uploads: Object.fromEntries(
      Object.entries(link.uploads ?? {}).map(([field, file]) => [field, file.fileName]),
    ),
    draft: readSealed(link.draftSealed),
    draftRev: link.draftRev ?? 0,
  };
}

/**
 * Saves what the employee typed so far (while they type). `rev` must grow: a save that arrives
 * late (older rev) is ignored, so the newest draft always wins.
 */
export async function saveKycDraft(token, { rev, draft }) {
  const { link, state } = await openLink(token);
  if (state !== 'open') throw createAppError(409, 'This form was already sent.');
  const result = await KycLink.updateOne(
    { _id: link._id, status: 'open', draftRev: { $lt: rev } },
    { draftSealed: seal(JSON.stringify(draft)), draftRev: rev },
  );
  return { saved: result.modifiedCount === 1, rev };
}

/** One file of the form, stored at once; the form is submitted later. */
export async function uploadKycFile(token, { field, file, fileName }) {
  const { link, state } = await openLink(token);
  if (state !== 'open') throw createAppError(409, 'This form was already sent.');
  const documents = await formDocumentTypes();
  const allowed = [...Object.keys(FILE_LABELS), ...documents.map((type) => `doc:${type._id}`)];
  if (!allowed.includes(field)) throw createAppError(400, 'Unknown file field.');
  if (!isStorageConfigured()) throw createAppError(503, 'File storage is not set up yet.');
  const decoded = field === 'photo' ? decodeImageDataUrl(file) : decodeFileDataUrl(file);
  const cleanName = safeFileName(fileName || `${field.replace(':', '-')}.${decoded.extension}`);
  const key = await putFile(
    `kyc-form/${link.employeeId}/${field.replace(':', '-')}/${Date.now()}-${cleanName}`,
    decoded.bytes,
    decoded.contentType,
  );
  await KycLink.updateOne(
    { _id: link._id, status: 'open' },
    {
      $set: {
        [`uploads.${field}`]: {
          key,
          fileName: cleanName,
          contentType: decoded.contentType,
          size: decoded.bytes.length,
        },
      },
    },
  );
  return { field, fileName: cleanName };
}

/** The employee sends the form. It waits for HR's review; nothing reaches the file yet. */
export async function submitKyc(token, input, { ip } = {}) {
  const { link, state } = await openLink(token);
  if (state !== 'open') throw createAppError(409, 'This form was already sent.');
  const uploads = link.uploads ?? {};
  const missing = requiredUploads(input.experienceType).filter((field) => !uploads[field]);
  if (missing.length) {
    throw createAppError(400, `Please upload: ${missing.map((f) => FILE_LABELS[f]).join(', ')}.`);
  }
  const claimed = await KycLink.findOneAndUpdate(
    { _id: link._id, status: 'open' },
    {
      status: 'submitted',
      submittedAt: new Date(),
      submissionSealed: seal(JSON.stringify(input)),
      draftSealed: null,
      rejectReason: '',
    },
  );
  if (!claimed) throw createAppError(409, 'This form was already sent.');
  const user = await User.findById(link.userId, '_id name employeeId').lean();
  await recordAudit(
    { _id: null, name: `${user.name} (KYC form)` },
    {
      action: 'kyc_link.submitted',
      entity: 'user',
      entityId: user._id,
      summary: `${user.name} (${user.employeeId}) sent the KYC form for review`,
      ip,
    },
  );
  // The people who review KYC forms get a notification (best effort).
  const reviewers = await usersWithPermission('kyc.verify').catch(() => []);
  notifyUsers(reviewers, {
    type: 'kyc_submitted',
    title: 'KYC form to review',
    body: `${user.name} (${user.employeeId}) sent the KYC form.`,
    icon: '/logo.png',
    data: { url: `/kyc-links/${link._id}` },
  }).catch(() => {});
  return { ok: true };
}

// ---- HR review: approve (write into the file) or send back ----

async function loadForReview(actor, id) {
  requirePermission(actor, 'users.manage');
  requirePermission(actor, 'kyc.verify');
  const link = await KycLink.findById(id)
    .lean()
    .catch(() => null);
  if (!link) throw notFound('KYC form');
  return link;
}

const mask = (value) =>
  value ? `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : '';

/** The sent form for HR: every answer and file. Full PAN and account only with kyc.reveal. */
export async function getKycSubmission(actor, id, { ip } = {}) {
  const link = await loadForReview(actor, id);
  const user = await User.findById(link.userId, 'name employeeId phone status').lean();
  if (link.status !== 'submitted') {
    return { link: { _id: link._id, status: link.status, submittedAt: link.submittedAt }, user };
  }
  const input = readSealed(link.submissionSealed) ?? {};
  const reveal = Boolean(can(actor, 'kyc.reveal'));
  if (reveal) {
    await recordAudit(actor, {
      action: 'kyc_link.viewed',
      entity: 'user',
      entityId: link.userId,
      summary: `Opened the KYC form of ${user?.name} for review (full PAN and account shown)`,
      ip,
    });
  }
  const documents = await formDocumentTypes();
  const labelOf = Object.fromEntries([
    ...Object.entries(FILE_LABELS),
    ...documents.map((type) => [`doc:${type._id}`, type.name]),
  ]);
  const files = await Promise.all(
    Object.entries(link.uploads ?? {})
      .filter(([field]) => labelOf[field])
      .filter(([field]) => input.experienceType === 'experienced' || !PREVIOUS_FILES[field])
      .map(async ([field, file]) => ({
        field,
        label: labelOf[field],
        fileName: file.fileName,
        contentType: file.contentType,
        url: await signedUrl(file.key),
      })),
  );
  return {
    link: { _id: link._id, status: link.status, submittedAt: link.submittedAt },
    user,
    input: {
      ...input,
      pan: { ...input.pan, number: reveal ? input.pan?.number : mask(input.pan?.number) },
      bank: {
        ...input.bank,
        accountNumber: reveal ? input.bank?.accountNumber : mask(input.bank?.accountNumber),
      },
    },
    files,
    reveal,
  };
}

/** Writes an approved form into the employee's file, KYC (verified) and documents (verified). */
async function applyToFile(actor, link, input) {
  const uploads = link.uploads ?? {};
  const user = await User.findById(link.userId, '_id name employeeId').lean();
  if (!user) throw createAppError(409, 'The employee of this form no longer exists.');
  const experienced = input.experienceType === 'experienced';
  await User.updateOne(
    { _id: user._id },
    {
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      bloodGroup: input.bloodGroup,
      personalEmail: input.personalEmail,
      currentAddress: input.currentAddress,
      permanentAddress: input.permanentAddress,
      emergencyContact: input.emergencyContact,
      photoKey: uploads.photo.key,
      previousEmployment: {
        experienceType: input.experienceType,
        companyName: experienced ? input.previousCompany.name : '',
        hrName: experienced ? input.previousCompany.hrName : '',
        hrPhone: experienced ? input.previousCompany.hrPhone : '',
        hrEmail: experienced ? input.previousCompany.hrEmail : '',
        reportingManager: experienced ? (input.previousCompany.reportingManager ?? '') : '',
        lastDrawnMonthlyPaise: experienced ? Math.round(input.lastDrawnSalary * 100) : null,
      },
    },
  );
  // The employee entered the KYC details; the reviewer checked them, so they are verified.
  await writeKycDetails(user, 'pan', input.pan, null);
  await writeKycDetails(user, 'aadhaar', { last4: input.aadhaarLast4 }, null);
  await writeKycDetails(user, 'bank', input.bank, null);
  for (const [field, item] of Object.entries(KYC_PROOFS)) {
    await writeKycProof(user, item, uploads[field], null);
  }
  const now = new Date();
  await Kyc.updateOne(
    { userId: user._id },
    {
      $set: Object.fromEntries(
        Object.values(KYC_PROOFS).flatMap((item) => [
          [`${item}.status`, 'verified'],
          [`${item}.reviewedBy`, actor._id],
          [`${item}.reviewedAt`, now],
        ]),
      ),
    },
  );
  // Documents: the optional ones, the previous company's, and the signed offer letter.
  const written = [];
  const add = async (type, file, options = {}) => {
    if (!type || !file) return;
    await writeDocumentVersion(user, type, file, { makerId: null, note: 'KYC form', ...options });
    written.push(type._id);
  };
  for (const type of await formDocumentTypes()) await add(type, uploads[`doc:${type._id}`]);
  if (experienced) {
    await add(await typeNamed('Experience certificate'), uploads.experienceDoc);
    const slipType = await typeNamed('Previous salary slip');
    for (const [index, field] of ['salarySlip1', 'salarySlip2', 'salarySlip3'].entries()) {
      await add(slipType, uploads[field], { note: `KYC form, salary month ${index + 1} of 3` });
    }
  }
  await add(await typeNamed('Offer letter (signed)'), uploads.signedOfferLetter, { signed: true });
  if (written.length) {
    await EmployeeDocument.updateMany(
      { userId: user._id, typeId: { $in: written } },
      { status: 'verified', reviewedBy: actor._id, reviewedAt: now },
    );
  }
  await refreshCompleteness(user._id);
  return user;
}

/** HR approves: everything goes into the employee's file. */
export async function approveKyc(actor, id, { ip } = {}) {
  await loadForReview(actor, id);
  const link = await KycLink.findOneAndUpdate(
    { _id: id, status: 'submitted' },
    { status: 'approved', reviewedBy: actor._id, reviewedAt: new Date() },
  ).lean();
  if (!link) throw createAppError(409, 'This form is not waiting for review.');
  const input = readSealed(link.submissionSealed);
  let user;
  try {
    if (!input) throw createAppError(409, 'The sent form could not be read.');
    user = await applyToFile(actor, link, input);
  } catch (error) {
    await KycLink.updateOne(
      { _id: link._id },
      { status: 'submitted', reviewedBy: null, reviewedAt: null },
    );
    throw error;
  }
  // Keep a copy without the full PAN and account number; drop the sealed form.
  const { pan, bank, ...rest } = input;
  await KycLink.updateOne(
    { _id: link._id },
    {
      submissionSealed: null,
      submitted: {
        ...rest,
        pan: { last4: pan.number.slice(-4), nameOnPan: pan.nameOnPan },
        bank: {
          accountHolderName: bank.accountHolderName,
          bankName: bank.bankName,
          ifsc: bank.ifsc,
          accountLast4: bank.accountNumber.slice(-4),
        },
      },
    },
  );
  await recordAudit(actor, {
    action: 'kyc_link.approved',
    entity: 'user',
    entityId: user._id,
    summary: `KYC form of ${user.name} (${user.employeeId}) approved and saved to the file`,
    ip,
  });
  return { ok: true, userId: String(user._id) };
}

/**
 * HR sends the form back with a reason: the link opens again with the answers filled in (the
 * uploaded files stay), for LINK_DAYS more days.
 */
export async function rejectKyc(actor, id, { reason }, { ip } = {}) {
  const current = await loadForReview(actor, id);
  const link = await KycLink.findOneAndUpdate(
    { _id: id, status: 'submitted' },
    {
      status: 'open',
      rejectReason: reason,
      reviewedBy: actor._id,
      reviewedAt: new Date(),
      draftSealed: current.submissionSealed,
      draftRev: Date.now(),
      submissionSealed: null,
      submittedAt: null,
      expiresAt: new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000),
    },
  ).lean();
  if (!link) throw createAppError(409, 'This form is not waiting for review.');
  const user = await User.findById(link.userId, 'name employeeId').lean();
  await recordAudit(actor, {
    action: 'kyc_link.rejected',
    entity: 'user',
    entityId: link.userId,
    summary: `KYC form of ${user?.name} sent back: ${reason}`,
    ip,
  });
  return { ok: true, path: linkPath(link.token) };
}

export const PREVIOUS_FILES = {
  salarySlip1: 'salary slip or bank statement, month 1',
  salarySlip2: 'salary slip or bank statement, month 2',
  salarySlip3: 'salary slip or bank statement, month 3',
  experienceDoc: 'experience certificate / joining letter / offer letter of the previous company',
};

export const FILE_LABELS = {
  photo: 'profile photo',
  panProof: 'PAN card',
  aadhaarProof: 'Aadhaar card',
  bankProof: 'bank proof (cheque or passbook)',
  ...PREVIOUS_FILES,
  signedOfferLetter: 'signed White Gloves Technology offer letter',
};
