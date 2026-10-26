import { User, PUBLIC_USER_FIELDS } from '../models/user.model.js';
import { Counter } from '../models/system.models.js';
import { can, canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { destroyUserSessions } from '../auth/session.js';
import { createAppError, notFound } from '../lib/errors.js';
import { runListQuery, containsRegex } from '../lib/pagination.js';
import { recordAudit, diffFields } from './audit.service.js';

// Employees (login accounts). Phase 1 adds the full employee master record.

const EDITABLE = [
  'name',
  'phone',
  'email',
  'department',
  'staffType',
  'expectedInTime',
  'expectedOutTime',
  'roleKey',
  'managerId',
  'status',
];

/** Next permanent ID: MWG-001, MWG-002 … (same counter as the first version). */
export async function nextEmployeeId() {
  const counter = await Counter.findOneAndUpdate(
    { id: 'employeeId' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return `MWG-${String(counter.seq).padStart(3, '0')}`;
}

const SORTS = {
  name: { name: 1 },
  '-name': { name: -1 },
  employeeId: { employeeId: 1 },
  '-employeeId': { employeeId: -1 },
  '-createdAt': { createdAt: -1 },
};

export async function listUsers(actor, query) {
  const filter = { ...(await employeeScopeFilter(actor, 'users.view')) };
  if (query.status !== 'all') filter.status = query.status;
  if (query.staffType) filter.staffType = query.staffType;
  if (query.roleKey) filter.roleKey = query.roleKey;
  if (query.q) {
    const pattern = containsRegex(query.q);
    filter.$or = [
      { name: pattern },
      { employeeId: pattern },
      { phone: pattern },
      { email: pattern },
      { department: pattern },
    ];
  }
  return runListQuery(User, {
    filter,
    sort: { ...SORTS[query.sort], _id: 1 },
    page: query.page,
    pageSize: 25,
    projection: PUBLIC_USER_FIELDS,
  });
}

/** Everyone in scope, short form, for pickers and filters. */
export async function listUserOptions(actor, permission = 'users.view') {
  const filter = { ...(await employeeScopeFilter(actor, permission)), status: 'active' };
  return User.find(filter, '_id name employeeId').sort({ name: 1 }).lean();
}

/** One employee the person may see, or 404. */
export async function getUser(actor, id) {
  const user = await User.findById(id, PUBLIC_USER_FIELDS)
    .lean()
    .catch(() => null);
  if (!user || !(await canSeeEmployee(actor, 'users.view', user.employeeId)))
    throw notFound('Employee');
  return user;
}

async function checkManager(managerId, selfId) {
  if (!managerId) return null;
  if (selfId && String(managerId) === String(selfId)) {
    throw createAppError(400, 'A person cannot be their own manager.');
  }
  const manager = await User.exists({ _id: managerId, status: 'active' });
  if (!manager) throw createAppError(400, 'The chosen manager does not exist.');
  return managerId;
}

/** Only a CEO may give or take the CEO role. */
function checkRoleChange(actor, roleKey, previous) {
  if (
    (roleKey === 'ceo' || previous === 'ceo') &&
    roleKey !== previous &&
    actor.roleKey !== 'ceo'
  ) {
    throw createAppError(403, 'Only the CEO can give or remove the CEO role.');
  }
}

export async function createUser(actor, input, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  checkRoleChange(actor, input.roleKey, 'employee');
  const managerId = await checkManager(input.managerId);
  const employeeId = await nextEmployeeId();
  const created = await User.create({
    ...input,
    email: input.email || undefined,
    managerId,
    employeeId,
    status: 'active',
  });
  await recordAudit(actor, {
    action: 'user.created',
    entity: 'user',
    entityId: created._id,
    summary: `Added ${created.name} (${employeeId})`,
    ip,
  });
  return getUser(actor, created._id);
}

export async function updateUser(actor, id, input, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const before = await User.findById(id)
    .lean()
    .catch(() => null);
  if (!before) throw notFound('Employee');
  if (input.roleKey) checkRoleChange(actor, input.roleKey, before.roleKey);
  if (
    String(before._id) === String(actor._id) &&
    (input.status === 'inactive' || (input.roleKey && input.roleKey !== before.roleKey))
  ) {
    throw createAppError(400, 'You cannot switch off or change the role of your own account.');
  }

  const update = { ...input };
  if ('managerId' in update) update.managerId = await checkManager(update.managerId || null, id);
  const unset = {};
  if (update.email === '') {
    delete update.email;
    unset.email = 1;
  }
  await User.updateOne(
    { _id: id },
    { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
  );

  const changes = diffFields(before, input, EDITABLE);
  if (input.password) changes.password = 'changed';
  if (input.password || input.status === 'inactive') await destroyUserSessions(id);
  if (Object.keys(changes).length) {
    await recordAudit(actor, {
      action: 'user.updated',
      entity: 'user',
      entityId: id,
      summary: `Edited ${before.name} (${before.employeeId})`,
      changes: Object.fromEntries(Object.entries(changes).filter(([key]) => key !== 'password')),
      ip,
    });
    if (input.password) {
      await recordAudit(actor, {
        action: 'user.password_set',
        entity: 'user',
        entityId: id,
        summary: `Set a new password for ${before.name}`,
        ip,
      });
    }
  }
  return getUser(actor, id);
}

/** Shows a password on an explicit click; always audited. */
export async function revealPassword(actor, id, { ip } = {}) {
  requirePermission(actor, 'users.password');
  const user = await User.findById(id, 'name employeeId password')
    .lean()
    .catch(() => null);
  if (!user) throw notFound('Employee');
  await recordAudit(actor, {
    action: 'user.password_viewed',
    entity: 'user',
    entityId: id,
    summary: `Viewed the password of ${user.name}`,
    ip,
  });
  return { password: user.password };
}

/** What the screens may show for this person (menu, buttons). */
export function permissionsOf(user) {
  return {
    punch: Boolean(can(user, 'attendance.punch')),
    attendance: can(user, 'attendance.view'),
    leaveRequest: Boolean(can(user, 'leave.request')),
    leaves: can(user, 'leave.view'),
    leaveDecide: can(user, 'leave.decide'),
    users: can(user, 'users.view'),
    usersManage: Boolean(can(user, 'users.manage')),
    usersPassword: Boolean(can(user, 'users.password')),
    broadcast: Boolean(can(user, 'notifications.broadcast')),
    punchAlerts: Boolean(can(user, 'notifications.punches')),
    audit: Boolean(can(user, 'audit.view')),
  };
}
