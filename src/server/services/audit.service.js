import { AuditLog } from '../models/system.models.js';
import { runListQuery } from '../lib/pagination.js';

// The audit log: who changed what and when. Never stores a password.

const HIDDEN = new Set(['password']);

/**
 * @param {object|null} actor The signed-in user (null for the system).
 * @param {{ action: string, entity: string, entityId?: any, summary?: string, changes?: object, ip?: string }} entry
 */
export async function recordAudit(actor, entry) {
  const changes = entry.changes
    ? Object.fromEntries(Object.entries(entry.changes).filter(([key]) => !HIDDEN.has(key)))
    : null;
  await AuditLog.create({
    actorId: actor?._id ?? null,
    actorName: actor?.name ?? 'System',
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ? String(entry.entityId) : null,
    summary: entry.summary ?? '',
    changes,
    ip: entry.ip ?? '',
  });
}

const valueAt = (record, path) => path.split('.').reduce((value, key) => value?.[key], record);

/** Before/after of the fields that really changed: { field: { from, to } }. Fields may be "a.b". */
export function diffFields(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    if (valueAt(after, field) === undefined) continue;
    const from = valueAt(before, field) ?? null;
    const to = valueAt(after, field) ?? null;
    if (String(from) !== String(to)) changes[field] = { from, to };
  }
  return changes;
}

export async function listAuditLog({ page, action, entityId }) {
  const filter = {};
  if (action) filter.action = action;
  if (entityId) filter.entityId = entityId;
  return runListQuery(AuditLog, { filter, sort: { createdAt: -1 }, page, pageSize: 50 });
}
