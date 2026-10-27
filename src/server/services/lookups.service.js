import { EMPLOYEE_LIST_TYPES, Lookup } from '../models/lookup.model.js';
import { User } from '../models/user.model.js';
import { requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { recordAudit } from './audit.service.js';

// Managed lists (Settings → Lists): departments, designations, branches, and checklist tasks.

export const LOOKUP_LABELS = {
  department: 'Department',
  designation: 'Designation',
  branch: 'Branch',
  onboarding_task: 'Onboarding task',
  exit_task: 'Exit task',
};

const isEmployeeList = (type) => EMPLOYEE_LIST_TYPES.includes(type);

/** Items of one list (active only unless asked), sorted by name, with how many employees use each. */
export async function listLookups(type, { includeInactive = false, withCounts = false } = {}) {
  const items = await Lookup.find({ type, ...(includeInactive ? {} : { active: true }) })
    .collation({ locale: 'en', strength: 2 })
    .sort({ name: 1 })
    .lean();
  if (!withCounts || !isEmployeeList(type)) return items;
  const counts = await User.aggregate([
    { $match: { [type]: { $in: items.map((item) => item.name) } } },
    { $group: { _id: `$${type}`, count: { $sum: 1 } } },
  ]);
  const byName = Object.fromEntries(counts.map((row) => [row._id, row.count]));
  return items.map((item) => ({ ...item, employees: byName[item.name] ?? 0 }));
}

/** The three employee lists at once (for the employee form). */
export async function allLookups() {
  const entries = await Promise.all(
    EMPLOYEE_LIST_TYPES.map(async (type) => [
      type,
      (await listLookups(type)).map((item) => item.name),
    ]),
  );
  return Object.fromEntries(entries);
}

export async function addLookup(actor, { type, name }, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const exists = await Lookup.findOne({ type, name })
    .collation({ locale: 'en', strength: 2 })
    .lean();
  if (exists) throw createAppError(409, `${LOOKUP_LABELS[type]} "${name}" already exists.`);
  const item = await Lookup.create({ type, name });
  await recordAudit(actor, {
    action: 'lookup.added',
    entity: 'lookup',
    entityId: item._id,
    summary: `${LOOKUP_LABELS[type]}: ${name}`,
    ip,
  });
  return item.toObject();
}

/** Rename (every employee follows) or switch an item on/off. */
export async function updateLookup(actor, id, { name, active }, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const item = await Lookup.findById(id)
    .lean()
    .catch(() => null);
  if (!item) throw notFound('List item');
  if (name !== undefined && name !== item.name) {
    const clash = await Lookup.findOne({ type: item.type, name, _id: { $ne: id } })
      .collation({ locale: 'en', strength: 2 })
      .lean();
    if (clash) throw createAppError(409, `${LOOKUP_LABELS[item.type]} "${name}" already exists.`);
    await Lookup.updateOne({ _id: id }, { name });
    const moved = isEmployeeList(item.type)
      ? await User.updateMany({ [item.type]: item.name }, { [item.type]: name })
      : { modifiedCount: 0 };
    await recordAudit(actor, {
      action: 'lookup.renamed',
      entity: 'lookup',
      entityId: id,
      summary: `${LOOKUP_LABELS[item.type]} "${item.name}" renamed to "${name}"${isEmployeeList(item.type) ? ` (${moved.modifiedCount} employees)` : ''}`,
      ip,
    });
  }
  if (active !== undefined && active !== item.active) {
    await Lookup.updateOne({ _id: id }, { active });
    await recordAudit(actor, {
      action: active ? 'lookup.activated' : 'lookup.deactivated',
      entity: 'lookup',
      entityId: id,
      summary: `${LOOKUP_LABELS[item.type]} "${name ?? item.name}" ${active ? 'switched on' : 'switched off'}`,
      ip,
    });
  }
  return Lookup.findById(id).lean();
}

/**
 * An employee's department, designation and branch must come from the lists. A value that is
 * not changing is accepted even if its list item was switched off later.
 */
export async function checkLookupValues(input, before = {}) {
  for (const type of EMPLOYEE_LIST_TYPES) {
    const value = input[type];
    if (!value || value === before[type]) continue;
    const exists = await Lookup.exists({ type, name: value, active: true });
    if (!exists)
      throw createAppError(
        400,
        `${LOOKUP_LABELS[type]} "${value}" is not in the list. Add it in Settings → Lists first.`,
      );
  }
}

/** Fills the lists from the values employees already have (used once by a migration). */
export async function seedLookupsFromEmployees() {
  for (const type of EMPLOYEE_LIST_TYPES) {
    const names = (await User.distinct(type)).map((name) => String(name).trim()).filter(Boolean);
    for (const name of names) {
      await Lookup.updateOne(
        { type, name },
        { $setOnInsert: { type, name, active: true } },
        { upsert: true },
      );
    }
  }
}

/** The starting onboarding and exit tasks (a migration adds them once; HR edits them after). */
export const DEFAULT_CHECKLIST_TASKS = {
  onboarding_task: [
    'Welcome and induction done',
    'ID card given',
    'Email and system access given',
    'Policies explained (code of conduct, leave, IT and assets)',
    'Introduced to the team and manager',
  ],
  exit_task: [
    'Work handed over',
    'Email and system access removed',
    'Exit interview done',
    'Relieving letter issued',
    'Experience letter issued',
  ],
};

export async function seedChecklistTasks() {
  for (const [type, names] of Object.entries(DEFAULT_CHECKLIST_TASKS)) {
    if (await Lookup.exists({ type })) continue;
    await Lookup.insertMany(names.map((name) => ({ type, name })));
  }
}
