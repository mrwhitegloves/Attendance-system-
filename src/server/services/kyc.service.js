import { Kyc } from '../models/kyc.model.js';
import { User } from '../models/user.model.js';
import { can, canSeeEmployee, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { seal, open } from '../lib/secretBox.js';
import { decodeFileDataUrl, safeFileName } from '../lib/files.js';
import { isStorageConfigured, putFile, signedUrl } from '../infra/storage.js';
import { recordAudit } from './audit.service.js';
import { refreshCompleteness } from './users.service.js';

// KYC and bank details (CEO spec section 4: sensitive, restricted, masked, every access logged).
// Rules:
// - full PAN and account numbers are sealed; screens see only the last 4 digits;
// - Aadhaar: only the last 4 digits and the verification record, never the full number;
// - new details or a new proof make the item "submitted" again (a check must be redone);
// - the person who entered the details or uploaded the latest proof cannot verify it;
// - "verified" needs at least one proof file;
// - every full-number view and every review is audited.

export const ITEM_LABELS = { pan: 'PAN', aadhaar: 'Aadhaar', bank: 'Bank account' };

async function loadEmployee(actor, userId, permission) {
  const user = await User.findById(userId, '_id name employeeId')
    .lean()
    .catch(() => null);
  if (!user || !(await canSeeEmployee(actor, permission, user.employeeId)))
    throw notFound('Employee');
  return user;
}

async function loadRecord(user) {
  return (
    (await Kyc.findOne({ userId: user._id }).lean()) ??
    (await Kyc.create({ userId: user._id, employeeId: user.employeeId })).toObject()
  );
}

/** Who may not verify: whoever entered the details or uploaded the latest proof. */
function makersOf(item) {
  const lastProof = item.proofs?.at(-1);
  return [item.enteredBy, lastProof?.uploadedBy].filter(Boolean).map(String);
}

const hasDetails = (name, item) =>
  name === 'pan'
    ? Boolean(item.sealed)
    : name === 'aadhaar'
      ? Boolean(item.last4)
      : Boolean(item.accountSealed);

/** The record as the screens see it: masked numbers, proof links, what this person may do. */
export async function getKyc(actor, userId) {
  const user = await loadEmployee(actor, userId, 'kyc.view');
  const record = await loadRecord(user);
  const people = await User.find(
    {
      _id: {
        $in: ['pan', 'aadhaar', 'bank']
          .flatMap((name) => [record[name].enteredBy, record[name].reviewedBy])
          .filter(Boolean),
      },
    },
    'name',
  ).lean();
  const nameOf = (id) => people.find((person) => String(person._id) === String(id))?.name ?? null;
  const mayVerify = Boolean(can(actor, 'kyc.verify'));

  const view = async (name) => {
    const item = record[name];
    const masked = {
      pan: item.last4 ? `******${item.last4}` : '',
      aadhaar: item.last4 ? `XXXX XXXX ${item.last4}` : '',
      bank: item.accountLast4 ? `XXXXXX${item.accountLast4}` : '',
    }[name];
    return {
      item: name,
      label: ITEM_LABELS[name],
      status: item.status,
      masked,
      details:
        name === 'pan'
          ? { nameOnPan: item.nameOnPan }
          : name === 'bank'
            ? {
                accountHolderName: item.accountHolderName,
                bankName: item.bankName,
                ifsc: item.ifsc,
              }
            : {},
      enteredBy: nameOf(item.enteredBy),
      enteredAt: item.enteredAt,
      reviewedBy: nameOf(item.reviewedBy),
      reviewedAt: item.reviewedAt,
      rejectReason: item.rejectReason,
      proofs: await Promise.all(
        item.proofs
          .slice()
          .reverse()
          .map(async (proof) => ({
            _id: proof._id,
            fileName: proof.fileName,
            uploadedAt: proof.uploadedAt,
            url: await signedUrl(proof.key),
          })),
      ),
      canReview:
        mayVerify &&
        ['submitted', 'under_review'].includes(item.status) &&
        !makersOf(item).includes(String(actor._id)),
      isMaker: makersOf(item).includes(String(actor._id)),
    };
  };

  return {
    user: { _id: user._id, name: user.name, employeeId: user.employeeId },
    items: await Promise.all(['pan', 'aadhaar', 'bank'].map(view)),
    permissions: {
      manage: Boolean(can(actor, 'kyc.manage')),
      verify: mayVerify,
      reveal: Boolean(can(actor, 'kyc.reveal')),
    },
  };
}

/** New or changed details. The item becomes "submitted" and must be checked again. */
export async function updateKycItem(actor, userId, name, input, { ip } = {}) {
  requirePermission(actor, 'kyc.manage');
  const user = await loadEmployee(actor, userId, 'kyc.view');
  const record = await loadRecord(user);
  const set = {};
  if (name === 'pan') {
    set['pan.sealed'] = seal(input.number);
    set['pan.last4'] = input.number.slice(-4);
    set['pan.nameOnPan'] = input.nameOnPan;
  } else if (name === 'aadhaar') {
    set['aadhaar.last4'] = input.last4;
  } else {
    if (!input.accountNumber && !record.bank.accountSealed) {
      throw createAppError(400, 'accountNumber: enter the account number');
    }
    if (input.accountNumber) {
      set['bank.accountSealed'] = seal(input.accountNumber);
      set['bank.accountLast4'] = input.accountNumber.slice(-4);
    }
    set['bank.accountHolderName'] = input.accountHolderName;
    set['bank.bankName'] = input.bankName;
    set['bank.ifsc'] = input.ifsc;
  }
  Object.assign(set, {
    [`${name}.status`]: 'submitted',
    [`${name}.enteredBy`]: actor._id,
    [`${name}.enteredAt`]: new Date(),
    [`${name}.reviewedBy`]: null,
    [`${name}.reviewedAt`]: null,
    [`${name}.rejectReason`]: '',
  });
  await Kyc.updateOne({ _id: record._id }, { $set: set });
  await refreshCompleteness(user._id);
  // Never the numbers themselves in the audit log.
  await recordAudit(actor, {
    action: 'kyc.updated',
    entity: 'kyc',
    entityId: user._id,
    summary: `${ITEM_LABELS[name]} details entered for ${user.name} (${user.employeeId})`,
    ip,
  });
  return getKyc(actor, userId);
}

/** A proof file (PDF or photo) for an item. Every upload is kept in S3. */
export async function addKycProof(actor, userId, name, { file, fileName }, { ip } = {}) {
  requirePermission(actor, 'kyc.manage');
  const user = await loadEmployee(actor, userId, 'kyc.view');
  const record = await loadRecord(user);
  if (!isStorageConfigured()) throw createAppError(503, 'File storage is not set up yet.');
  const decoded = decodeFileDataUrl(file);
  const cleanName = safeFileName(fileName || `${name}.${decoded.extension}`);
  const key = await putFile(
    `kyc/${user.employeeId}/${name}/${Date.now()}-${cleanName}`,
    decoded.bytes,
    decoded.contentType,
  );
  const item = record[name];
  const becomesSubmitted =
    hasDetails(name, item) && ['missing', 'rejected', 'verified'].includes(item.status);
  await Kyc.updateOne(
    { _id: record._id },
    {
      $push: {
        [`${name}.proofs`]: {
          key,
          fileName: cleanName,
          contentType: decoded.contentType,
          size: decoded.bytes.length,
          uploadedBy: actor._id,
        },
      },
      ...(becomesSubmitted
        ? {
            $set: {
              [`${name}.status`]: 'submitted',
              [`${name}.reviewedBy`]: null,
              [`${name}.reviewedAt`]: null,
              [`${name}.rejectReason`]: '',
            },
          }
        : {}),
    },
  );
  await refreshCompleteness(user._id);
  await recordAudit(actor, {
    action: 'kyc.proof_added',
    entity: 'kyc',
    entityId: user._id,
    summary: `${ITEM_LABELS[name]} proof "${cleanName}" uploaded for ${user.name}`,
    ip,
  });
  return getKyc(actor, userId);
}

/** Verify or reject an item. Independent check: the maker cannot review their own entry. */
export async function reviewKycItem(actor, userId, name, { decision, reason }, { ip } = {}) {
  requirePermission(actor, 'kyc.verify');
  const user = await loadEmployee(actor, userId, 'kyc.view');
  const record = await loadRecord(user);
  const item = record[name];
  if (!['submitted', 'under_review'].includes(item.status)) {
    throw createAppError(
      409,
      `${ITEM_LABELS[name]} is ${item.status.replace('_', ' ')}; there is nothing to check.`,
    );
  }
  if (makersOf(item).includes(String(actor._id))) {
    throw createAppError(
      403,
      'You entered these details or uploaded the proof, so someone else must check them.',
    );
  }
  if (decision === 'verified' && !item.proofs.length) {
    throw createAppError(400, 'Upload a proof file before verifying.');
  }
  if (decision === 'rejected' && !reason)
    throw createAppError(400, 'reason: write why it is rejected');
  await Kyc.updateOne(
    { _id: record._id },
    {
      $set: {
        [`${name}.status`]: decision,
        [`${name}.reviewedBy`]: actor._id,
        [`${name}.reviewedAt`]: new Date(),
        [`${name}.rejectReason`]: decision === 'rejected' ? reason : '',
      },
    },
  );
  await refreshCompleteness(user._id);
  await recordAudit(actor, {
    action: `kyc.${decision}`,
    entity: 'kyc',
    entityId: user._id,
    summary: `${ITEM_LABELS[name]} of ${user.name} ${decision}${reason ? `: ${reason}` : ''}`,
    ip,
  });
  return getKyc(actor, userId);
}

/** The full number, on an explicit click, always audited. */
export async function revealKycNumber(actor, userId, name, { ip } = {}) {
  requirePermission(actor, 'kyc.reveal');
  if (name === 'aadhaar') throw createAppError(400, 'The full Aadhaar number is never stored.');
  const user = await loadEmployee(actor, userId, 'kyc.view');
  const record = await loadRecord(user);
  const value = name === 'pan' ? open(record.pan.sealed) : open(record.bank.accountSealed);
  if (!value) throw notFound(`${ITEM_LABELS[name]} number`);
  await recordAudit(actor, {
    action: 'kyc.revealed',
    entity: 'kyc',
    entityId: user._id,
    summary: `Viewed the full ${ITEM_LABELS[name]} number of ${user.name}`,
    ip,
  });
  return { number: value };
}
