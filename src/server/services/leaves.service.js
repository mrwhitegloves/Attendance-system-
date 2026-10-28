import { LeaveRequest } from '../models/leaveRequest.model.js';
import { Attendance } from '../models/attendance.model.js';
import { User } from '../models/user.model.js';
import { canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { runListQuery } from '../lib/pagination.js';
import { daysBetween } from '../lib/dates.js';
import { recordAudit } from './audit.service.js';
import { notifyUsers, notifyPunchWatchers } from './push.service.js';
import { takeFromBalance } from './leaveRules.service.js';
import { overlapCondition } from '../lib/dateFilter.js';

// Leave requests. Approving writes one "Leave" attendance row per day (never twice).
// Nobody decides their own leave.

export async function requestLeave(actor, input) {
  requirePermission(actor, 'leave.request');
  const overlap = await LeaveRequest.exists({
    employeeId: actor.employeeId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: input.endDate },
    endDate: { $gte: input.startDate },
  });
  if (overlap) throw createAppError(409, 'You already have a leave request for these dates.');
  const leave = await LeaveRequest.create({
    ...input,
    employeeId: actor.employeeId,
    employeeName: actor.name,
    userId: actor._id,
    status: 'pending',
  });
  const approvers = actor.managerId ? [actor.managerId] : [];
  const payload = {
    title: `Leave request from ${actor.name}`,
    body: `${input.startDate} to ${input.endDate}: ${input.reason}`,
    icon: '/logo.png',
    data: { url: '/leave?status=pending' },
  };
  if (approvers.length) notifyUsers(approvers, payload).catch(() => {});
  notifyPunchWatchers(payload).catch(() => {});
  return leave.toObject();
}

export async function listLeaves(actor, query) {
  const filter = {
    ...(await employeeScopeFilter(actor, 'leave.view')),
    // Leave that touches the chosen days.
    ...overlapCondition(query, 'startDate', 'endDate'),
  };
  if (query.status !== 'all') filter.status = query.status;
  if (query.employeeId) {
    if (!(await canSeeEmployee(actor, 'leave.view', query.employeeId))) {
      return { items: [], total: 0, page: query.page, pageSize: 25, pages: 1 };
    }
    filter.employeeId = query.employeeId;
  }
  return runListQuery(LeaveRequest, {
    filter,
    sort: { status: -1, createdAt: -1 },
    page: query.page,
    pageSize: 25,
  });
}

export async function countPendingLeaves(actor) {
  if (!actorCanDecide(actor)) return 0;
  const filter = { ...(await employeeScopeFilter(actor, 'leave.decide')), status: 'pending' };
  filter.employeeId = { ...(filter.employeeId || {}), $ne: actor.employeeId };
  return LeaveRequest.countDocuments(filter);
}

const actorCanDecide = (actor) => {
  try {
    requirePermission(actor, 'leave.decide');
    return true;
  } catch {
    return false;
  }
};

async function loadLeave(actor, id, permission) {
  const leave = await LeaveRequest.findById(id)
    .lean()
    .catch(() => null);
  if (!leave || !(await canSeeEmployee(actor, permission, leave.employeeId)))
    throw notFound('Leave request');
  return leave;
}

export async function decideLeave(
  actor,
  id,
  { decision, note, paid, useBalance = false, balanceMonth },
  { ip } = {},
) {
  requirePermission(actor, 'leave.decide');
  const leave = await loadLeave(actor, id, 'leave.decide');
  if (leave.employeeId === actor.employeeId) {
    throw createAppError(403, 'You cannot approve or reject your own leave.');
  }
  if (decision === 'approved' && typeof paid !== 'boolean') {
    throw createAppError(400, 'Choose paid leave or unpaid leave.');
  }
  if (leave.status !== 'pending')
    throw createAppError(409, `This request is already ${leave.status}.`);

  const updated = await LeaveRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    {
      status: decision,
      adminNote: note,
      processedAt: new Date(),
      processedBy: actor._id,
      paid: decision === 'approved' ? paid : null,
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw createAppError(409, 'This request was just decided by someone else.');

  if (decision === 'approved') await writeLeaveDays(updated, actor, note);
  if (decision === 'approved' && paid && useBalance) {
    await takeFromBalance(actor, updated, balanceMonth || updated.startDate.slice(0, 7));
  }
  await recordAudit(actor, {
    action: `leave.${decision}`,
    entity: 'leave',
    entityId: id,
    summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} leave of ${leave.employeeName} (${leave.startDate} to ${leave.endDate})`,
    ip,
  });
  const owner = await User.findOne({ employeeId: leave.employeeId }, '_id').lean();
  if (owner) {
    notifyUsers([owner._id], {
      title: `Leave ${decision}`,
      body: `${leave.startDate} to ${leave.endDate}${note ? `: ${note}` : ''}`,
      icon: '/logo.png',
      data: { url: '/leave' },
    }).catch(() => {});
  }
  return updated;
}

/** One "Leave" row per day of an approved request. Safe to run twice. */
export async function writeLeaveDays(leave, actor, note = '') {
  for (const date of daysBetween(leave.startDate, leave.endDate)) {
    await Attendance.updateOne(
      { employeeId: leave.employeeId, date, status: 'Leave' },
      {
        $setOnInsert: {
          employeeId: leave.employeeId,
          userId: leave.userId,
          userName: leave.employeeName,
          date,
          time: '09:00 AM',
          status: 'Leave',
          source: 'leave',
          location: 'Approved leave',
          remark: `Approved leave: ${leave.reason}${note ? ` (note from ${actor.name}: ${note})` : ''}`,
          leaveRequestId: leave._id,
          paidLeave: leave.paid ?? null,
        },
      },
      { upsert: true },
    );
  }
}

/** The person withdraws their own pending request. */
export async function cancelLeave(actor, id) {
  const leave = await loadLeave(actor, id, 'leave.view');
  if (leave.employeeId !== actor.employeeId)
    throw createAppError(403, 'Only the person who asked can withdraw it.');
  if (leave.status !== 'pending')
    throw createAppError(409, `This request is already ${leave.status}.`);
  return LeaveRequest.findByIdAndUpdate(
    id,
    { status: 'cancelled', processedAt: new Date() },
    { returnDocument: 'after' },
  ).lean();
}
