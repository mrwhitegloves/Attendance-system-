import { randomBytes } from 'node:crypto';
import { KycLink } from '../models/kycLink.model.js';
import { User } from '../models/user.model.js';
import { DocumentType } from '../models/document.model.js';
import { requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { containsRegex } from '../lib/pagination.js';
import { decodeFileDataUrl, safeFileName } from '../lib/files.js';
import { decodeImageDataUrl } from '../lib/images.js';
import { isFullPhone, phoneKey } from '../lib/phone.js';
import { isStorageConfigured, putFile } from '../infra/storage.js';
import { recordAudit } from './audit.service.js';
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
// - files are uploaded one at a time (Vercel takes at most 4.5 MB per request), the form is
//   submitted once; submitting fills the employee's file, KYC (status "submitted", to be checked
//   by HR: nobody is the maker, so any checker may verify) and documents. HR can edit it all later.

export const LINK_DAYS = 30;
// Documents the KYC form asks for, by their name in the catalogue (Settings → Document types).
export const KYC_FORM_DOCUMENTS = [
  'Resume',
  'Address proof',
  'Education certificate',
  'Experience certificate',
];
export const KYC_PROOFS = { panProof: 'pan', aadhaarProof: 'aadhaar', bankProof: 'bank' };
const REQUIRED_UPLOADS = ['photo', 'panProof', 'aadhaarProof', 'bankProof'];

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
    KycLink.find(filter, 'token userId employeeId status expiresAt submittedAt createdAt')
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

/** What the form shows: the person's name, the documents asked for, the files sent so far. */
export async function getPublicKyc(token) {
  const { link, state } = await openLink(token);
  const user = await User.findById(link.userId, 'name employeeId brandKey').lean();
  if (state === 'submitted') return { state, name: user?.name ?? '' };
  const documents = await formDocumentTypes();
  return {
    state,
    name: user?.name ?? '',
    employeeId: user?.employeeId ?? '',
    brandKey: user?.brandKey || 'mwg',
    expiresAt: link.expiresAt,
    documents: documents.map((type) => ({ field: `doc:${type._id}`, name: type.name })),
    uploads: Object.fromEntries(
      Object.entries(link.uploads ?? {}).map(([field, file]) => [field, file.fileName]),
    ),
  };
}

/** One file of the form, stored at once; the form is submitted later. */
export async function uploadKycFile(token, { field, file, fileName }) {
  const { link, state } = await openLink(token);
  if (state !== 'open') throw createAppError(409, 'This form was already sent.');
  const documents = await formDocumentTypes();
  const allowed = ['photo', ...Object.keys(KYC_PROOFS), ...documents.map((t) => `doc:${t._id}`)];
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

/** The employee sends the form: everything goes into their file, KYC and documents. */
export async function submitKyc(token, input, { ip } = {}) {
  const { link, state } = await openLink(token);
  if (state !== 'open') throw createAppError(409, 'This form was already sent.');
  const uploads = link.uploads ?? {};
  const missing = REQUIRED_UPLOADS.filter((field) => !uploads[field]);
  if (missing.length) {
    throw createAppError(400, `Please upload: ${missing.map((f) => FILE_LABELS[f]).join(', ')}.`);
  }
  // Claim the link first, so a double click never writes twice.
  const claimed = await KycLink.findOneAndUpdate(
    { _id: link._id, status: 'open' },
    { status: 'submitted', submittedAt: new Date() },
  );
  if (!claimed) throw createAppError(409, 'This form was already sent.');
  const user = await User.findById(link.userId, '_id name employeeId').lean();
  try {
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
      },
    );
    await writeKycDetails(user, 'pan', input.pan, null);
    await writeKycDetails(user, 'aadhaar', { last4: input.aadhaarLast4 }, null);
    await writeKycDetails(user, 'bank', input.bank, null);
    for (const [field, item] of Object.entries(KYC_PROOFS)) {
      await writeKycProof(user, item, uploads[field], null);
    }
    for (const type of await formDocumentTypes()) {
      const file = uploads[`doc:${type._id}`];
      if (file) await writeDocumentVersion(user, type, file, { makerId: null, note: 'KYC form' });
    }
    await refreshCompleteness(user._id);
  } catch (error) {
    await KycLink.updateOne({ _id: link._id }, { status: 'open', submittedAt: null });
    throw error;
  }
  // A copy of what was sent, without the full PAN and account number.
  const { pan, bank, ...personal } = input;
  await KycLink.updateOne(
    { _id: link._id },
    {
      submitted: {
        ...personal,
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
  await recordAudit(
    { _id: null, name: `${user.name} (KYC form)` },
    {
      action: 'kyc_link.submitted',
      entity: 'user',
      entityId: user._id,
      summary: `${user.name} (${user.employeeId}) sent the KYC form`,
      ip,
    },
  );
  return { ok: true };
}

export const FILE_LABELS = {
  photo: 'profile photo',
  panProof: 'PAN card',
  aadhaarProof: 'Aadhaar card',
  bankProof: 'bank proof (cheque or passbook)',
};
