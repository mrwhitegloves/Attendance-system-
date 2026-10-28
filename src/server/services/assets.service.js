import { Asset } from '../models/asset.model.js';
import { Counter } from '../models/system.models.js';
import { User } from '../models/user.model.js';
import { canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { containsRegex, runListQuery } from '../lib/pagination.js';
import { ASSET_CATEGORIES } from '../../config/assetOptions.js';
import { recordAudit } from './audit.service.js';
import { notifyUsers } from './push.service.js';

// Company assets. Rules:
// - an asset is with at most one employee; it must come back before it goes to someone else;
// - only an active employee can be given an asset;
// - every hand-over, return and status change is kept in the asset's history;
// - an employee sees only what they have (and had); a manager sees the team's.

async function nextCode() {
  const counter = await Counter.findOneAndUpdate(
    { id: 'assets' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return `AST-${String(counter.seq).padStart(4, '0')}`;
}

const by = (actor) => ({ by: actor._id, byName: actor.name, at: new Date() });

/** Assets in the person's scope: everything, or only what they (or their team) have. */
async function scopeFilter(actor) {
  const scope = await employeeScopeFilter(actor, 'assets.view');
  return scope.employeeId ? { employeeId: scope.employeeId } : {};
}

export async function listAssets(actor, query) {
  const filter = { ...(await scopeFilter(actor)) };
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.employeeId) {
    if (!(await canSeeEmployee(actor, 'assets.view', query.employeeId))) {
      return { items: [], total: 0, page: query.page, pageSize: 25, pages: 1 };
    }
    filter.employeeId = query.employeeId;
  }
  if (query.q) {
    const pattern = containsRegex(query.q);
    filter.$or = [
      { code: pattern },
      { name: pattern },
      { serialNumber: pattern },
      { employeeName: pattern },
    ];
  }
  return runListQuery(Asset, {
    filter,
    sort: { code: 1 },
    page: query.page,
    pageSize: 25,
    projection: '-history',
  });
}

/** Counts for the top of the assets screen (people who see every asset). */
export async function assetCounts(actor) {
  const scope = requirePermission(actor, 'assets.view');
  if (scope !== 'all' && scope !== true) return null;
  const rows = await Asset.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}

async function loadAsset(actor, id) {
  requirePermission(actor, 'assets.view');
  const asset = await Asset.findById(id)
    .lean()
    .catch(() => null);
  if (!asset) throw notFound('Asset');
  const scope = await scopeFilter(actor);
  if (scope.employeeId) {
    // Their own (or the team's) asset now, or one they had before.
    const ids = scope.employeeId.$in;
    const hadIt = asset.history.some((entry) => ids.includes(entry.employeeId));
    if (!ids.includes(asset.employeeId) && !hadIt) throw notFound('Asset');
  }
  return asset;
}

export async function getAsset(actor, id) {
  const asset = await loadAsset(actor, id);
  const scope = await scopeFilter(actor);
  // Someone with a limited scope sees only the history entries of the people they may see.
  const history = scope.employeeId
    ? asset.history.filter(
        (entry) => !entry.employeeId || scope.employeeId.$in.includes(entry.employeeId),
      )
    : asset.history;
  return { ...asset, history: [...history].reverse() };
}

export async function addAsset(actor, input, { ip } = {}) {
  requirePermission(actor, 'assets.manage');
  const asset = await Asset.create({
    ...assetFields(input),
    code: await nextCode(),
    status: 'in_stock',
    history: [{ action: 'added', status: 'in_stock', ...by(actor) }],
  });
  await recordAudit(actor, {
    action: 'asset.added',
    entity: 'asset',
    entityId: asset._id,
    summary: `${asset.code} ${asset.name} (${ASSET_CATEGORIES[asset.category]})`,
    ip,
  });
  return getAsset(actor, asset._id);
}

const assetFields = (input) => ({
  name: input.name,
  category: input.category,
  serialNumber: input.serialNumber ?? '',
  valuePaise:
    input.value === undefined || input.value === null ? null : Math.round(input.value * 100),
  purchasedOn: input.purchasedOn ?? '',
  note: input.note ?? '',
});

/** Edit the details; or change the status while nobody has it (repair, lost, retired). */
export async function updateAsset(actor, id, input, { ip } = {}) {
  requirePermission(actor, 'assets.manage');
  const asset = await loadAsset(actor, id);
  const set = {};
  for (const key of ['name', 'category', 'serialNumber', 'purchasedOn', 'note']) {
    if (input[key] !== undefined) set[key] = input[key];
  }
  if (input.value !== undefined) set.valuePaise = assetFields(input).valuePaise;
  const push = {};
  if (input.status && input.status !== asset.status) {
    if (asset.status === 'assigned') {
      throw createAppError(409, 'Take the asset back from the employee first.');
    }
    set.status = input.status;
    push.history = {
      action: 'status',
      status: input.status,
      note: input.statusNote ?? '',
      ...by(actor),
    };
  }
  await Asset.updateOne({ _id: id }, { $set: set, ...(push.history ? { $push: push } : {}) });
  await recordAudit(actor, {
    action: 'asset.updated',
    entity: 'asset',
    entityId: id,
    summary: `${asset.code} ${asset.name}${set.status ? `: ${set.status.replace('_', ' ')}` : ''}`,
    ip,
  });
  return getAsset(actor, id);
}

/** Hands an asset in stock to an active employee. */
export async function assignAsset(actor, id, { userId, condition, note }, { ip } = {}) {
  requirePermission(actor, 'assets.manage');
  const asset = await loadAsset(actor, id);
  const person = await User.findOne({ _id: userId, status: 'active' })
    .lean()
    .catch(() => null);
  if (!person) throw createAppError(400, 'Choose an active employee.');
  const updated = await Asset.findOneAndUpdate(
    { _id: id, status: 'in_stock' },
    {
      $set: {
        status: 'assigned',
        userId: person._id,
        employeeId: person.employeeId,
        employeeName: person.name,
        assignedAt: new Date(),
      },
      $push: {
        history: {
          action: 'assigned',
          userId: person._id,
          employeeId: person.employeeId,
          employeeName: person.name,
          condition: condition ?? '',
          note: note ?? '',
          ...by(actor),
        },
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) {
    throw createAppError(
      409,
      asset.status === 'assigned'
        ? `This asset is with ${asset.employeeName}. Take it back first.`
        : 'Only an asset in stock can be handed over.',
    );
  }
  await recordAudit(actor, {
    action: 'asset.assigned',
    entity: 'asset',
    entityId: id,
    summary: `${asset.code} ${asset.name} given to ${person.name} (${person.employeeId})`,
    ip,
  });
  notifyUsers([person._id], {
    title: 'Company asset handed over to you',
    body: `${asset.name} (${asset.code})`,
    icon: '/logo.png',
    data: { url: `/assets/${id}` },
  }).catch(() => {});
  return getAsset(actor, id);
}

/** Takes an asset back: to stock, to repair, or recorded as lost. */
export async function returnAsset(actor, id, { status, condition, note }, { ip } = {}) {
  requirePermission(actor, 'assets.manage');
  const asset = await loadAsset(actor, id);
  if (asset.status !== 'assigned') throw createAppError(409, 'Nobody has this asset now.');
  const updated = await Asset.findOneAndUpdate(
    { _id: id, status: 'assigned', userId: asset.userId },
    {
      $set: { status, userId: null, employeeId: '', employeeName: '', assignedAt: null },
      $push: {
        history: {
          action: 'returned',
          userId: asset.userId,
          employeeId: asset.employeeId,
          employeeName: asset.employeeName,
          status,
          condition: condition ?? '',
          note: note ?? '',
          ...by(actor),
        },
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw createAppError(409, 'This asset was just changed by someone else.');
  await recordAudit(actor, {
    action: 'asset.returned',
    entity: 'asset',
    entityId: id,
    summary: `${asset.code} ${asset.name} ${status === 'lost' ? 'recorded lost' : 'taken back'} from ${asset.employeeName} (${asset.employeeId})`,
    ip,
  });
  return getAsset(actor, id);
}

/** What an employee has now (for the employee file, onboarding and exit). */
export async function assetsWith(actor, userId) {
  const person = await User.findById(userId, 'employeeId name')
    .lean()
    .catch(() => null);
  if (!person || !(await canSeeEmployee(actor, 'assets.view', person.employeeId))) {
    throw notFound('Employee');
  }
  return Asset.find({ userId: person._id, status: 'assigned' }, '-history')
    .sort({ code: 1 })
    .lean();
}

/** How many assets a person still has (no permission check: used by the exit rules). */
export const countAssetsWith = (userId) => Asset.countDocuments({ userId, status: 'assigned' });
