import { Exit } from '../models/exit.model.js';
import { Lookup } from '../models/lookup.model.js';
import { User } from '../models/user.model.js';
import { canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { indiaDay } from '../lib/dates.js';
import { runListQuery } from '../lib/pagination.js';
import { EXIT_TYPES } from '../../config/exitOptions.js';
import { recordAudit } from './audit.service.js';
import { refreshCompleteness } from './completeness.service.js';
import { countAssetsWith } from './assets.service.js';
import { updateUser } from './users.service.js';
import { dayCondition } from '../lib/dateFilter.js';
import { settlementDone } from './settlement.service.js';

// Exits (CEO spec: "on resignation: start notice-period tracking, handover, asset recovery …;
// on exit: revoke access"). Rules:
// - one open exit per employee; starting it puts the employee in the notice period;
// - the tasks come from Settings → Lists (exit tasks); two checks are automatic: every company
//   asset is back, and the full-and-final settlement is approved (settlement.service);
// - closing needs every task and the check done; it marks the employee exited and deactivates
//   the account (signed out everywhere at once); records are kept;
// - a resignation can be withdrawn while open: the employment status goes back to what it was.

async function loadPerson(actor, userId, permission) {
  const person = await User.findById(userId, 'name employeeId status employmentStatus')
    .lean()
    .catch(() => null);
  if (!person || !(await canSeeEmployee(actor, permission, person.employeeId))) {
    throw notFound('Employee');
  }
  return person;
}

async function view(exit) {
  const assetsLeft = await countAssetsWith(exit.userId);
  const checks = [
    {
      key: 'assets',
      label: 'Every company asset returned',
      done: assetsLeft === 0,
      detail: assetsLeft ? `${assetsLeft} still with the employee` : '',
    },
    {
      key: 'settlement',
      label: 'Full and final settlement approved',
      done: settlementDone(exit),
      detail: exit.settlement ? 'Waiting for the CEO' : 'Not prepared yet',
    },
  ];
  const tasksDone = exit.tasks.filter((task) => task.done).length;
  const checksDone = checks.filter((check) => check.done).length;
  return {
    ...exit,
    checks,
    progress: { done: tasksDone + checksDone, total: exit.tasks.length + checks.length },
    ready: tasksDone === exit.tasks.length && checksDone === checks.length,
    overdue: exit.status === 'notice' && exit.lastWorkingDay < indiaDay(),
  };
}

/** The employee's exits, newest first (the open one, if any, is first). */
export async function exitsOf(actor, userId) {
  const person = await loadPerson(actor, userId, 'exits.view');
  const exits = await Exit.find({ userId: person._id }).sort({ createdAt: -1 }).lean();
  return Promise.all(exits.map(view));
}

async function loadOpenExit(actor, userId) {
  requirePermission(actor, 'exits.manage');
  const person = await loadPerson(actor, userId, 'exits.view');
  const exit = await Exit.findOne({ userId: person._id, status: 'notice' }).lean();
  if (!exit) throw createAppError(409, 'There is no open exit for this employee.');
  return { person, exit };
}

export async function startExit(actor, userId, input, { ip } = {}) {
  requirePermission(actor, 'exits.manage');
  const person = await loadPerson(actor, userId, 'exits.view');
  if (String(person._id) === String(actor._id)) {
    throw createAppError(400, 'Someone else must record your own exit.');
  }
  if (person.status !== 'active') throw createAppError(409, 'This account is not active.');
  if (input.lastWorkingDay < input.noticeDate) {
    throw createAppError(400, 'lastWorkingDay: the last working day is before the notice date');
  }
  if (await Exit.exists({ userId: person._id, status: 'notice' })) {
    throw createAppError(409, 'This employee already has an open exit.');
  }
  const tasks = await Lookup.find({ type: 'exit_task', active: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const exit = await Exit.create({
    userId: person._id,
    employeeId: person.employeeId,
    employeeName: person.name,
    type: input.type,
    noticeDate: input.noticeDate,
    lastWorkingDay: input.lastWorkingDay,
    reason: input.reason ?? '',
    tasks: tasks.map((item) => ({ label: item.name })),
    previousEmploymentStatus: person.employmentStatus ?? '',
    startedBy: actor._id,
  }).catch((error) => {
    if (error?.code === 11000) throw createAppError(409, 'This employee already has an open exit.');
    throw error;
  });
  await User.updateOne({ _id: person._id }, { employmentStatus: 'notice_period' });
  await refreshCompleteness(person._id);
  await recordAudit(actor, {
    action: 'exit.started',
    entity: 'user',
    entityId: person._id,
    summary: `${EXIT_TYPES[input.type]}: ${person.name} (${person.employeeId}), last working day ${input.lastWorkingDay}`,
    ip,
  });
  return view(exit.toObject());
}

/** Change the last working day or the reason while the exit is open. */
export async function updateExit(actor, userId, input, { ip } = {}) {
  const { person, exit } = await loadOpenExit(actor, userId);
  const next = { ...exit, ...input };
  if (next.lastWorkingDay < next.noticeDate) {
    throw createAppError(400, 'lastWorkingDay: the last working day is before the notice date');
  }
  await Exit.updateOne({ _id: exit._id }, { $set: input });
  await recordAudit(actor, {
    action: 'exit.updated',
    entity: 'user',
    entityId: person._id,
    summary: `Exit of ${person.name}: ${Object.keys(input).join(', ')} changed`,
    changes: Object.fromEntries(
      Object.entries(input)
        .filter(([key, value]) => exit[key] !== value)
        .map(([key, value]) => [key, { from: exit[key], to: value }]),
    ),
    ip,
  });
  return view(await Exit.findById(exit._id).lean());
}

export async function setExitTask(actor, userId, taskId, { done, note }, { ip } = {}) {
  const { person, exit } = await loadOpenExit(actor, userId);
  const task = exit.tasks.find((item) => String(item._id) === taskId);
  if (!task) throw notFound('Task');
  await Exit.updateOne(
    { _id: exit._id, 'tasks._id': task._id },
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
    action: done ? 'exit.task_done' : 'exit.task_undone',
    entity: 'user',
    entityId: person._id,
    summary: `${person.name}: ${task.label}${done ? '' : ' (not done)'}`,
    ip,
  });
  return view(await Exit.findById(exit._id).lean());
}

/** Closes the exit: the employee is exited and the account deactivated. */
export async function completeExit(actor, userId, { note }, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const { person, exit } = await loadOpenExit(actor, userId);
  const current = await view(exit);
  if (!current.ready) {
    const left = [
      ...current.tasks.filter((task) => !task.done).map((task) => task.label),
      ...current.checks.filter((check) => !check.done).map((check) => check.label),
    ];
    throw createAppError(409, `Still to do: ${left.join('; ')}.`);
  }
  const closed = await Exit.findOneAndUpdate(
    { _id: exit._id, status: 'notice' },
    {
      status: 'completed',
      closedAt: new Date(),
      closedBy: actor._id,
      closedByName: actor.name,
      closingNote: note ?? '',
    },
    { returnDocument: 'after' },
  ).lean();
  if (!closed) throw createAppError(409, 'This exit was just closed by someone else.');
  // Signs the person out everywhere and stops sign-in (users.service).
  await updateUser(
    actor,
    person._id,
    { status: 'deactivated', employmentStatus: 'exited' },
    { ip },
  );
  await recordAudit(actor, {
    action: 'exit.completed',
    entity: 'user',
    entityId: person._id,
    summary: `${person.name} (${person.employeeId}) exited; account deactivated`,
    ip,
  });
  return view(closed);
}

/** A resignation taken back (or an exit started by mistake): the old employment status returns. */
export async function withdrawExit(actor, userId, { note }, { ip } = {}) {
  const { person, exit } = await loadOpenExit(actor, userId);
  const closed = await Exit.findOneAndUpdate(
    { _id: exit._id, status: 'notice' },
    {
      status: 'withdrawn',
      closedAt: new Date(),
      closedBy: actor._id,
      closedByName: actor.name,
      closingNote: note ?? '',
    },
    { returnDocument: 'after' },
  ).lean();
  if (!closed) throw createAppError(409, 'This exit was just closed by someone else.');
  await User.updateOne(
    { _id: person._id },
    { employmentStatus: exit.previousEmploymentStatus || '' },
  );
  await refreshCompleteness(person._id);
  await recordAudit(actor, {
    action: 'exit.withdrawn',
    entity: 'user',
    entityId: person._id,
    summary: `Exit of ${person.name} (${person.employeeId}) withdrawn${note ? `: ${note}` : ''}`,
    ip,
  });
  return view(closed);
}

/** Exits in scope, newest first (the Exits screen). */
export async function listExits(actor, query) {
  requirePermission(actor, 'exits.view');
  const filter = { ...(await employeeScopeFilter(actor, 'exits.view')) };
  if (query.status !== 'all') filter.status = query.status;
  const lastDays = dayCondition(query);
  if (lastDays) filter.lastWorkingDay = lastDays;
  const result = await runListQuery(Exit, {
    filter,
    sort: { lastWorkingDay: 1, createdAt: -1 },
    page: query.page,
    pageSize: 25,
  });
  return { ...result, items: await Promise.all(result.items.map(view)) };
}

/** Open exits, and how many are past the last working day (dashboard). */
export async function exitCounts(actor) {
  const scope = await employeeScopeFilter(actor, 'exits.view').catch(() => null);
  if (!scope) return null;
  const [open, overdue] = await Promise.all([
    Exit.countDocuments({ ...scope, status: 'notice' }),
    Exit.countDocuments({ ...scope, status: 'notice', lastWorkingDay: { $lt: indiaDay() } }),
  ]);
  return { open, overdue };
}
