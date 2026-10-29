import mongoose from 'mongoose';
import {
  DEFAULT_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  DocumentType,
  EmployeeDocument,
} from '../models/document.model.js';
import { User } from '../models/user.model.js';
import { can, canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { decodeFileDataUrl, safeFileName } from '../lib/files.js';
import { indiaDay } from '../lib/dates.js';
import { containsRegex } from '../lib/pagination.js';
import { isStorageConfigured, putFile, signedUrl } from '../infra/storage.js';
import { recordAudit } from './audit.service.js';
import { refreshCompleteness } from './completeness.service.js';

// Employee documents (CEO spec section 4). Rules:
// - one record per employee and document type; every upload is a new version, all are kept;
// - a new version makes the document "submitted" again; it must be checked again;
// - the person who uploaded the latest version cannot verify it;
// - a type that needs a signature can be verified only when marked signed;
// - a type with expiry needs an expiry date; past that date the document becomes "expired".

// ---- Catalogue (Settings → Document types) ----

export async function listDocumentTypes({ includeInactive = false } = {}) {
  return DocumentType.find(includeInactive ? {} : { active: true })
    .sort({ order: 1, name: 1 })
    .lean();
}

export async function addDocumentType(actor, input, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const exists = await DocumentType.findOne({ name: input.name })
    .collation({ locale: 'en', strength: 2 })
    .lean();
  if (exists) throw createAppError(409, `Document type "${input.name}" already exists.`);
  const last = await DocumentType.findOne({}, 'order').sort({ order: -1 }).lean();
  const type = await DocumentType.create({ ...input, order: (last?.order ?? 0) + 1 });
  await recordAudit(actor, {
    action: 'document_type.added',
    entity: 'document_type',
    entityId: type._id,
    summary: type.name,
    ip,
  });
  if (type.required) await refreshEveryone();
  return type.toObject();
}

export async function updateDocumentType(actor, id, input, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const before = await DocumentType.findById(id)
    .lean()
    .catch(() => null);
  if (!before) throw notFound('Document type');
  if (input.name && input.name !== before.name) {
    const clash = await DocumentType.findOne({ name: input.name, _id: { $ne: id } })
      .collation({ locale: 'en', strength: 2 })
      .lean();
    if (clash) throw createAppError(409, `Document type "${input.name}" already exists.`);
  }
  await DocumentType.updateOne({ _id: id }, input);
  await recordAudit(actor, {
    action: 'document_type.updated',
    entity: 'document_type',
    entityId: id,
    summary: `${before.name}: ${Object.entries(input)
      .map(([key, value]) => `${key} → ${value}`)
      .join(', ')}`,
    ip,
  });
  // Whether a type is required (or active) changes everyone's file.
  if ('required' in input || 'active' in input) await refreshEveryone();
  return DocumentType.findById(id).lean();
}

async function refreshEveryone() {
  const users = await User.find({}, '_id').lean();
  for (const user of users) await refreshCompleteness(user._id);
}

/** Fills the catalogue the first time (migration). */
export async function seedDocumentTypes() {
  if (await DocumentType.exists({})) return;
  await DocumentType.insertMany(
    DEFAULT_DOCUMENT_TYPES.map(([category, name, flags = {}], index) => ({
      category,
      name,
      order: index + 1,
      ...flags,
    })),
  );
}

// ---- Employee documents ----

async function loadEmployee(actor, userId, permission) {
  const user = await User.findById(userId, '_id name employeeId')
    .lean()
    .catch(() => null);
  if (!user || !(await canSeeEmployee(actor, permission, user.employeeId)))
    throw notFound('Employee');
  return user;
}

const today = () => indiaDay();

async function documentView(actor, doc, type) {
  const latest = doc.versions.at(-1);
  const mayVerify = Boolean(can(actor, 'documents.verify'));
  return {
    _id: doc._id,
    status: doc.status,
    signature: doc.signature,
    expiresOn: doc.expiresOn,
    reviewedAt: doc.reviewedAt,
    rejectReason: doc.rejectReason,
    versions: await Promise.all(
      doc.versions
        .slice()
        .reverse()
        .map(async (version) => ({
          _id: version._id,
          fileName: version.fileName,
          note: version.note,
          uploadedAt: version.uploadedAt,
          url: await signedUrl(version.key),
        })),
    ),
    canReview:
      mayVerify &&
      ['submitted', 'under_review'].includes(doc.status) &&
      String(latest?.uploadedBy) !== String(actor._id) &&
      !(type.needsSignature && doc.signature !== 'signed'),
  };
}

/** The catalogue grouped by category, each type with this employee's document (or missing). */
export async function getEmployeeDocuments(actor, userId) {
  const user = await loadEmployee(actor, userId, 'documents.view');
  const [types, docs] = await Promise.all([
    listDocumentTypes(),
    EmployeeDocument.find({ userId: user._id }).lean(),
  ]);
  const byType = new Map(docs.map((doc) => [String(doc.typeId), doc]));
  const groups = [];
  for (const [category, label] of Object.entries(DOCUMENT_CATEGORIES)) {
    const items = await Promise.all(
      types
        .filter((type) => type.category === category)
        .map(async (type) => {
          const doc = byType.get(String(type._id));
          return { type, document: doc ? await documentView(actor, doc, type) : null };
        }),
    );
    if (items.length) groups.push({ category, label, items });
  }
  return {
    user,
    groups,
    permissions: {
      manage: Boolean(can(actor, 'documents.manage')),
      verify: Boolean(can(actor, 'documents.verify')),
    },
  };
}

/**
 * Adds an already stored file ({ key, fileName, contentType, size }) as the newest version of
 * an employee's document. `makerId`: who uploaded it (null for the employee's own KYC form).
 */
export async function writeDocumentVersion(user, type, file, options) {
  const { makerId, note = '', signed = false, expiresOn = '' } = options;
  const signature = type.needsSignature ? (signed ? 'signed' : 'pending') : 'not_needed';
  const expired = type.hasExpiry && expiresOn < today();
  await EmployeeDocument.updateOne(
    { userId: user._id, typeId: type._id },
    {
      $setOnInsert: { userId: user._id, employeeId: user.employeeId, typeId: type._id },
      $set: {
        status: expired ? 'expired' : 'submitted',
        signature,
        expiresOn: type.hasExpiry ? expiresOn : '',
        reviewedBy: null,
        reviewedAt: null,
        rejectReason: '',
      },
      $push: { versions: { ...file, note, uploadedBy: makerId } },
    },
    { upsert: true },
  );
  await refreshCompleteness(user._id);
}

/** Uploads a new version of a document. */
export async function uploadDocument(actor, userId, input, { ip } = {}) {
  requirePermission(actor, 'documents.manage');
  const user = await loadEmployee(actor, userId, 'documents.view');
  const type = await DocumentType.findOne({ _id: input.typeId, active: true })
    .lean()
    .catch(() => null);
  if (!type) throw createAppError(400, 'Choose a document type from the list.');
  if (type.hasExpiry && !input.expiresOn)
    throw createAppError(400, 'expiresOn: this document needs an expiry date');
  if (!isStorageConfigured()) throw createAppError(503, 'File storage is not set up yet.');
  const file = decodeFileDataUrl(input.file);
  const fileName = safeFileName(input.fileName || `${type.name}.${file.extension}`);
  const key = await putFile(
    `documents/${user.employeeId}/${type._id}/${Date.now()}-${fileName}`,
    file.bytes,
    file.contentType,
  );
  await writeDocumentVersion(
    user,
    type,
    { key, fileName, contentType: file.contentType, size: file.bytes.length },
    {
      makerId: actor._id,
      note: input.note ?? '',
      signed: input.signed,
      expiresOn: input.expiresOn,
    },
  );
  await recordAudit(actor, {
    action: 'document.uploaded',
    entity: 'document',
    entityId: user._id,
    summary: `${type.name} "${fileName}" uploaded for ${user.name} (${user.employeeId})`,
    ip,
  });
  return getEmployeeDocuments(actor, userId);
}

/** Verify or reject the latest version. Never by the person who uploaded it. */
export async function reviewDocument(actor, documentId, { decision, reason }, { ip } = {}) {
  requirePermission(actor, 'documents.verify');
  const doc = await EmployeeDocument.findById(documentId)
    .lean()
    .catch(() => null);
  if (!doc || !(await canSeeEmployee(actor, 'documents.view', doc.employeeId)))
    throw notFound('Document');
  const [type, user] = await Promise.all([
    DocumentType.findById(doc.typeId).lean(),
    User.findById(doc.userId, 'name employeeId').lean(),
  ]);
  if (!['submitted', 'under_review'].includes(doc.status)) {
    throw createAppError(
      409,
      `This document is ${doc.status.replace('_', ' ')}; there is nothing to check.`,
    );
  }
  if (String(doc.versions.at(-1)?.uploadedBy) === String(actor._id)) {
    throw createAppError(403, 'You uploaded this version, so someone else must check it.');
  }
  if (decision === 'verified' && type.needsSignature && doc.signature !== 'signed') {
    throw createAppError(
      400,
      'This document must be signed before it can be verified. Upload the signed copy.',
    );
  }
  if (decision === 'rejected' && !reason)
    throw createAppError(400, 'reason: write why it is rejected');
  await EmployeeDocument.updateOne(
    { _id: documentId },
    {
      status: decision,
      reviewedBy: actor._id,
      reviewedAt: new Date(),
      rejectReason: decision === 'rejected' ? reason : '',
    },
  );
  await refreshCompleteness(doc.userId);
  await recordAudit(actor, {
    action: `document.${decision}`,
    entity: 'document',
    entityId: doc.userId,
    summary: `${type.name} of ${user.name} ${decision}${reason ? `: ${reason}` : ''}`,
    ip,
  });
  return { ok: true };
}

// ---- The central repository (/documents) ----

/** Every document in scope with filters: status, category, type, expiring soon, employee search. */
export async function listAllDocuments(actor, query) {
  const scope = await employeeScopeFilter(actor, 'documents.view');
  const filter = { ...scope };
  if (query.status) filter.status = query.status;
  if (query.typeId) filter.typeId = new mongoose.Types.ObjectId(query.typeId);
  if (query.expiring === 'soon') {
    const limit = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    filter.expiresOn = { $ne: '', $lte: indiaDay(limit) };
    filter.status = filter.status ?? { $ne: 'expired' };
  }
  const typeFilter = query.category ? { category: query.category } : {};
  const types = await DocumentType.find(typeFilter).lean();
  if (query.category) filter.typeId = filter.typeId ?? { $in: types.map((type) => type._id) };
  if (query.q) {
    const pattern = containsRegex(query.q);
    const people = await User.find(
      { $or: [{ name: pattern }, { employeeId: pattern }] },
      'employeeId',
    ).lean();
    const found = people.map((person) => person.employeeId);
    // Stay inside the person's scope.
    const allowed = scope.employeeId
      ? found.filter((id) => scope.employeeId.$in.includes(id))
      : found;
    filter.employeeId = { $in: allowed };
  }
  const pageSize = 25;
  const page = Math.max(1, query.page);
  const [docs, total] = await Promise.all([
    EmployeeDocument.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    EmployeeDocument.countDocuments(filter),
  ]);
  const typeOf = new Map(
    (await DocumentType.find({}).lean()).map((type) => [String(type._id), type]),
  );
  const people = await User.find(
    { _id: { $in: docs.map((doc) => doc.userId) } },
    'name employeeId',
  ).lean();
  const personOf = new Map(people.map((person) => [String(person._id), person]));
  const items = await Promise.all(
    docs.map(async (doc) => {
      const latest = doc.versions.at(-1);
      const type = typeOf.get(String(doc.typeId));
      return {
        _id: doc._id,
        user: personOf.get(String(doc.userId)) ?? null,
        type: type ? { _id: type._id, name: type.name, category: type.category } : null,
        status: doc.status,
        signature: doc.signature,
        expiresOn: doc.expiresOn,
        versions: doc.versions.length,
        latest: latest
          ? {
              fileName: latest.fileName,
              uploadedAt: latest.uploadedAt,
              url: await signedUrl(latest.key),
            }
          : null,
      };
    }),
  );
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ---- Expiry ----

/** Documents past their expiry date become "expired" (safe to run any number of times). */
export async function markExpiredDocuments(now = new Date()) {
  const due = await EmployeeDocument.find(
    { expiresOn: { $ne: '', $lt: indiaDay(now) }, status: { $ne: 'expired' } },
    '_id userId',
  ).lean();
  if (!due.length) return { expired: 0 };
  await EmployeeDocument.updateMany(
    { _id: { $in: due.map((doc) => doc._id) } },
    { status: 'expired' },
  );
  for (const userId of new Set(due.map((doc) => String(doc.userId))))
    await refreshCompleteness(userId);
  return { expired: due.length };
}

let lastExpiryCheck = 0;
/** Runs the expiry check at most once an hour, without making the page wait. */
export function queueExpiryCheck() {
  if (Date.now() - lastExpiryCheck < 60 * 60 * 1000) return;
  lastExpiryCheck = Date.now();
  markExpiredDocuments().catch((error) => console.error('[documents] expiry check', error));
}
