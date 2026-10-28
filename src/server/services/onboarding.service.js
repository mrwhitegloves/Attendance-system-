import { Onboarding } from '../models/onboarding.model.js';
import { Letter } from '../models/letter.model.js';
import { Lookup } from '../models/lookup.model.js';
import { User } from '../models/user.model.js';
import { canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { runListQuery } from '../lib/pagination.js';
import { recordAudit } from './audit.service.js';

// Onboarding (CEO spec: "on joining … assign onboarding tasks"). Rules:
// - starts by itself when a candidate joins; HR can start it for anyone else;
// - the tasks come from Settings → Lists (onboarding tasks) at the start;
// - two checks are automatic: the employee file is complete (KYC, bank, documents, salary)
//   and an offer or appointment letter is accepted;
// - joining is confirmed only when every task and both checks are done; then it is closed.

async function loadPerson(actor, userId, permission) {
  const person = await User.findById(userId, 'name employeeId completeness')
    .lean()
    .catch(() => null);
  if (!person || !(await canSeeEmployee(actor, permission, person.employeeId))) {
    throw notFound('Employee');
  }
  return person;
}

/** The automatic checks of one employee, worked out now. */
async function automaticChecks(person) {
  const letter = await Letter.exists({
    userId: person._id,
    kind: { $in: ['offer', 'appointment'] },
    status: 'accepted',
  });
  const missing = person.completeness?.missing ?? [];
  return [
    {
      key: 'file',
      label: 'Employee file complete (KYC, bank, documents, salary)',
      done: (person.completeness?.percent ?? 0) === 100,
      detail: missing.length
        ? `Missing: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`
        : '',
    },
    {
      key: 'letter',
      label: 'Offer or appointment letter accepted',
      done: Boolean(letter),
      detail: '',
    },
  ];
}

function view(onboarding, checks) {
  const tasksDone = onboarding.tasks.filter((task) => task.done).length;
  const checksDone = checks.filter((check) => check.done).length;
  const total = onboarding.tasks.length + checks.length;
  return {
    ...onboarding,
    checks,
    progress: { done: tasksDone + checksDone, total },
    ready: tasksDone === onboarding.tasks.length && checksDone === checks.length,
  };
}

/** The checklist of one employee, or null when it was never started. */
export async function getOnboarding(actor, userId) {
  const person = await loadPerson(actor, userId, 'users.view');
  const onboarding = await Onboarding.findOne({ userId: person._id }).lean();
  if (!onboarding) return null;
  return view(onboarding, await automaticChecks(person));
}

/**
 * Starts the checklist with the tasks in Settings → Lists. Safe to run twice (one per employee).
 * Used by HR, and by recruitment when a candidate joins.
 */
export async function startOnboarding(actor, userId, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const person = await loadPerson(actor, userId, 'users.view');
  const names = await Lookup.find({ type: 'onboarding_task', active: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const result = await Onboarding.updateOne(
    { userId: person._id },
    {
      $setOnInsert: {
        userId: person._id,
        employeeId: person.employeeId,
        tasks: names.map((item) => ({ label: item.name })),
        startedBy: actor._id,
      },
    },
    { upsert: true },
  );
  if (result.upsertedCount) {
    await recordAudit(actor, {
      action: 'onboarding.started',
      entity: 'user',
      entityId: person._id,
      summary: `Onboarding started for ${person.name} (${person.employeeId})`,
      ip,
    });
  }
  return getOnboarding(actor, userId);
}

/** Ticks or unticks one task (while the checklist is open). */
export async function setTask(actor, userId, taskId, { done, note }, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const person = await loadPerson(actor, userId, 'users.view');
  const onboarding = await Onboarding.findOne({ userId: person._id }).lean();
  if (!onboarding) throw notFound('Onboarding');
  if (onboarding.status !== 'in_progress')
    throw createAppError(409, 'Onboarding is already closed.');
  const task = onboarding.tasks.find((item) => String(item._id) === taskId);
  if (!task) throw notFound('Task');
  await Onboarding.updateOne(
    { _id: onboarding._id, 'tasks._id': task._id },
    {
      $set: {
        'tasks.$.done': done,
        'tasks.$.doneAt': done ? new Date() : null,
        'tasks.$.doneBy': done ? actor._id : null,
        'tasks.$.doneByName': done ? actor.name : '',
        ...(note !== undefined ? { 'tasks.$.note': note } : {}),
      },
    },
  );
  await recordAudit(actor, {
    action: done ? 'onboarding.task_done' : 'onboarding.task_undone',
    entity: 'user',
    entityId: person._id,
    summary: `${person.name}: ${task.label}${done ? '' : ' (not done)'}`,
    ip,
  });
  return getOnboarding(actor, userId);
}

/** Confirms the joining: everything must be done. Closes the checklist. */
export async function completeOnboarding(actor, userId, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const person = await loadPerson(actor, userId, 'users.view');
  const current = await getOnboarding(actor, userId);
  if (!current) throw notFound('Onboarding');
  if (current.status !== 'in_progress') throw createAppError(409, 'Onboarding is already closed.');
  if (!current.ready) {
    const left = [
      ...current.tasks.filter((task) => !task.done).map((task) => task.label),
      ...current.checks.filter((check) => !check.done).map((check) => check.label),
    ];
    throw createAppError(409, `Still to do: ${left.join('; ')}.`);
  }
  const closed = await Onboarding.findOneAndUpdate(
    { userId: person._id, status: 'in_progress' },
    {
      status: 'completed',
      completedAt: new Date(),
      completedBy: actor._id,
      completedByName: actor.name,
    },
  );
  if (!closed) throw createAppError(409, 'Onboarding was just closed by someone else.');
  await recordAudit(actor, {
    action: 'onboarding.completed',
    entity: 'user',
    entityId: person._id,
    summary: `Joining confirmed for ${person.name} (${person.employeeId})`,
    ip,
  });
  return getOnboarding(actor, userId);
}

/** Open checklists in scope, with progress (the Onboarding screen). */
export async function listOnboardings(actor, query) {
  requirePermission(actor, 'users.view');
  const scope = await employeeScopeFilter(actor, 'users.view');
  const filter = { ...scope, ...(query.status !== 'all' ? { status: query.status } : {}) };
  const result = await runListQuery(Onboarding, {
    filter,
    sort: { createdAt: -1 },
    page: query.page,
    pageSize: 25,
  });
  const people = await User.find(
    { _id: { $in: result.items.map((item) => item.userId) } },
    'name employeeId designation joiningDate completeness',
  ).lean();
  const personOf = new Map(people.map((person) => [String(person._id), person]));
  const items = await Promise.all(
    result.items.map(async (item) => {
      const person = personOf.get(String(item.userId));
      const full = view(item, person ? await automaticChecks(person) : []);
      return {
        _id: item._id,
        userId: item.userId,
        status: item.status,
        progress: full.progress,
        ready: full.ready,
        person: person
          ? {
              name: person.name,
              employeeId: person.employeeId,
              designation: person.designation,
              joiningDate: person.joiningDate,
            }
          : null,
      };
    }),
  );
  return { ...result, items };
}

/** How many checklists are still open (dashboard). */
export async function countOpenOnboardings(actor) {
  const scope = await employeeScopeFilter(actor, 'users.view').catch(() => null);
  if (!scope) return 0;
  return Onboarding.countDocuments({ ...scope, status: 'in_progress' });
}
