import mongoose from 'mongoose';
import { DeletedItem, TRASH_DAYS } from '../models/deletedItem.model.js';
import { Letter } from '../models/letter.model.js';
import { User } from '../models/user.model.js';
import { can, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { runListQuery } from '../lib/pagination.js';
import { recordAudit } from './audit.service.js';

// Recently deleted (founder, 2026-10-29). Every delete in the app goes through moveToTrash():
// the records are copied into `deleted_items` exactly as stored, then removed from their place.
// restoreFromTrash() puts the same records (same _id) back, so they show again where they were.
// Items older than TRASH_DAYS days are removed by MongoDB itself (TTL index).

// Who may restore (or delete forever) each kind, and its name on the screen.
export const TRASH_KINDS = {
  employee: { label: 'Employee', permission: 'users.manage' },
  offer_letter: { label: 'Offer letter', permission: 'letters.manage' },
  kyc_link: { label: 'KYC link', permission: 'users.manage' },
  holiday: { label: 'Holiday', permission: 'settings.manage' },
  comp_off: { label: 'Comp-off', permission: 'leave.decide' },
};

const raw = (collection) => mongoose.connection.db.collection(collection);

/**
 * Moves records to Recently deleted. `parts`: [{ model, filter }]; the first part is the main
 * record. Parts with `drop: true` are removed without a copy (sessions, push subscriptions).
 * @returns {Promise<{ trashId: string, counts: Record<string, number> }>}
 */
export async function moveToTrash(
  actor,
  { kind, label, detail = '', entityId, parts },
  { ip } = {},
) {
  const kept = [];
  const counts = {};
  for (const part of parts) {
    if (part.drop) continue;
    const collection = part.model.collection.name;
    const docs = await raw(collection).find(part.filter).toArray();
    counts[collection] = docs.length;
    if (docs.length) kept.push({ collection, docs });
  }
  if (!kept.length) throw notFound(TRASH_KINDS[kind]?.label ?? 'Record');
  const now = new Date();
  const item = await DeletedItem.create({
    kind,
    label,
    detail,
    entityId: entityId ? String(entityId) : '',
    parts: kept,
    deletedBy: actor?._id ?? null,
    deletedByName: actor?.name ?? '',
    deletedAt: now,
    expiresAt: new Date(now.getTime() + TRASH_DAYS * 24 * 60 * 60 * 1000),
  });
  for (const part of kept) {
    await raw(part.collection).deleteMany({ _id: { $in: part.docs.map((doc) => doc._id) } });
  }
  for (const part of parts.filter((item) => item.drop)) await part.model.deleteMany(part.filter);
  await recordAudit(actor, {
    action: `${kind}.deleted`,
    entity: kind,
    entityId,
    summary: `${TRASH_KINDS[kind]?.label ?? kind} deleted: ${label} (in Recently deleted for ${TRASH_DAYS} days)`,
    ip,
  });
  return { trashId: String(item._id), counts };
}

export async function listTrash(actor, { page = 1, kind } = {}) {
  requirePermission(actor, 'settings.manage');
  const result = await runListQuery(DeletedItem, {
    filter: kind ? { kind } : {},
    sort: { deletedAt: -1 },
    page,
    pageSize: 25,
    projection: '-parts',
  });
  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      kindLabel: TRASH_KINDS[item.kind]?.label ?? item.kind,
      canRestore: Boolean(can(actor, TRASH_KINDS[item.kind]?.permission)),
    })),
  };
}

async function loadItem(actor, id) {
  requirePermission(actor, 'settings.manage');
  const item = await DeletedItem.findById(id)
    .lean()
    .catch(() => null);
  if (!item) throw notFound('Deleted item');
  requirePermission(actor, TRASH_KINDS[item.kind]?.permission ?? 'settings.manage');
  return item;
}

// Checks before a restore, per kind (a plain reason when something now stands in the way).
const RESTORE_CHECKS = {
  // One offer letter per person: they may have a new one by now.
  offer_letter: async (item) => {
    const first = item.parts.find((part) => part.collection === 'letters')?.docs[0];
    if (!first) return;
    const owner = first.userId ? { userId: first.userId } : { candidateId: first.candidateId };
    if (await Letter.exists({ ...owner, kind: 'offer', status: { $ne: 'superseded' } })) {
      throw createAppError(
        409,
        'This person has a new offer letter now. Delete it first to restore this one.',
      );
    }
  },
  // A KYC link or comp-off belongs to an employee: the employee must exist.
  kyc_link: (item) => needsEmployee(item, 'kyc_links'),
  comp_off: (item) => needsEmployee(item, 'comp_offs'),
};

async function needsEmployee(item, collection) {
  const doc = item.parts.find((part) => part.collection === collection)?.docs[0];
  if (doc?.userId && !(await User.exists({ _id: doc.userId }))) {
    throw createAppError(409, 'Restore the employee first.');
  }
}

/** Puts the records back where they were (same _id). All or nothing. */
export async function restoreFromTrash(actor, id, { ip } = {}) {
  const item = await loadItem(actor, id);
  await RESTORE_CHECKS[item.kind]?.(item);
  // A record that is back already is never touched (so the undo below removes only ours).
  for (const part of item.parts) {
    if (await raw(part.collection).findOne({ _id: { $in: part.docs.map((doc) => doc._id) } })) {
      throw createAppError(409, 'This was already restored.');
    }
  }
  const inserted = [];
  try {
    for (const part of item.parts) {
      await raw(part.collection).insertMany(part.docs, { ordered: true });
      inserted.push(part);
    }
  } catch (error) {
    // Undo what was put back, so nothing is half restored.
    for (const part of [...inserted, ...item.parts.slice(inserted.length, inserted.length + 1)]) {
      await raw(part.collection).deleteMany({
        _id: { $in: part.docs.map((doc) => doc._id) },
      });
    }
    if (error?.code === 11000) {
      throw createAppError(
        409,
        'This cannot be restored: a record with the same details exists now.',
      );
    }
    throw error;
  }
  await DeletedItem.deleteOne({ _id: item._id });
  await recordAudit(actor, {
    action: `${item.kind}.restored`,
    entity: item.kind,
    entityId: item.entityId,
    summary: `${TRASH_KINDS[item.kind]?.label ?? item.kind} restored: ${item.label}`,
    ip,
  });
  return { ok: true, kind: item.kind, entityId: item.entityId };
}

/** Removes an item for good before its 90 days are over. */
export async function deleteForever(actor, id, { ip } = {}) {
  const item = await loadItem(actor, id);
  await DeletedItem.deleteOne({ _id: item._id });
  await recordAudit(actor, {
    action: `${item.kind}.deleted_forever`,
    entity: item.kind,
    entityId: item.entityId,
    summary: `${TRASH_KINDS[item.kind]?.label ?? item.kind} deleted for good: ${item.label}`,
    ip,
  });
  return { ok: true };
}
