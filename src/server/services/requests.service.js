import { EmployeeRequest } from '../models/request.model.js';
import { Counter } from '../models/system.models.js';
import { User } from '../models/user.model.js';
import { SalaryStructure } from '../models/salary.model.js';
import { can, requirePermission, visibleEmployeeIds } from '../permissions/can.js';
import { rolesNow } from '../permissions/roles.js';
import { createAppError, notFound } from '../lib/errors.js';
import { decodeFileDataUrl, safeFileName } from '../lib/files.js';
import { containsRegex, runListQuery } from '../lib/pagination.js';
import { isStorageConfigured, putFile, signedUrl } from '../infra/storage.js';
import { REQUEST_KINDS, categoryLabel, missedPunches } from '../../config/requestKinds.js';
import { recordAudit } from './audit.service.js';
import { notifyUsers } from './push.service.js';
import { countPendingLeaves } from './leaves.service.js';
import { checkMissedPunch, writeMissedPunch } from './attendance.service.js';
import { momentCondition } from '../lib/dateFilter.js';

// Employee requests (CEO spec section 10). Rules:
// - a missed punch is added to attendance only when approved, after checking the day again;
// - a request is always for oneself; it can be withdrawn while it waits;
// - nobody decides their own request; a decision is final;
// - a team scope never includes grievances: only people who see everyone see or decide them;
// - money requests may be approved for less than asked; nothing is paid from here (payouts later).

const isPrivate = (kind) => Boolean(REQUEST_KINDS[kind]?.private);

/** Requests a person may see under a permission, as a Mongo filter. */
async function scopeFilter(actor, permission) {
  const scope = can(actor, permission);
  if (!scope) return null;
  if (scope === 'all' || scope === true) return {};
  const ids = await visibleEmployeeIds(actor, permission);
  // Own requests always; other people's only when they are not grievances.
  return {
    $or: [{ userId: actor._id }, { employeeId: { $in: ids }, kind: { $nin: privateKinds() } }],
  };
}

const privateKinds = () => Object.keys(REQUEST_KINDS).filter(isPrivate);

async function nextNumber() {
  const counter = await Counter.findOneAndUpdate(
    { id: 'requests' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return `REQ-${String(counter.seq).padStart(4, '0')}`;
}

export async function createRequest(actor, input, { ip } = {}) {
  requirePermission(actor, 'requests.create');
  const kind = REQUEST_KINDS[input.kind];
  if (kind.money && !input.amount) throw createAppError(400, 'amount: enter the amount');
  if (kind.categories && !kind.categories[input.category]) {
    throw createAppError(400, `category: choose the ${kind.categoryLabel.toLowerCase()}`);
  }
  if ((input.kind === 'expense' || kind.punches) && !input.date) {
    throw createAppError(400, 'date: enter the day');
  }
  if (!kind.punches && !input.subject) throw createAppError(400, 'subject: write a short subject');
  const punches = kind.punches ? punchTimes(input.category, input) : {};
  if (kind.punches) {
    const wanted = missedPunches(input.category);
    if (wanted.punchIn && !punches.punchInTime) {
      throw createAppError(400, 'punchInTime: enter the punch-in time');
    }
    if (wanted.punchOut && !punches.punchOutTime) {
      throw createAppError(400, 'punchOutTime: enter the punch-out time');
    }
    await checkMissedPunch(actor, { date: input.date, ...punches });
  }
  const subject = kind.punches
    ? `Missed ${categoryLabel(input.kind, input.category).toLowerCase()} on ${input.date}`
    : input.subject;
  if (kind.detailsRequired && !input.details)
    throw createAppError(400, 'details: write the details');

  const number = await nextNumber();
  const attachments = [];
  if (input.file) {
    if (!isStorageConfigured()) throw createAppError(503, 'File storage is not set up yet.');
    const file = decodeFileDataUrl(input.file);
    const fileName = safeFileName(input.fileName || `${number}.${file.extension}`);
    const key = await putFile(
      `requests/${actor.employeeId}/${number}-${fileName}`,
      file.bytes,
      file.contentType,
    );
    attachments.push({ key, fileName, contentType: file.contentType });
  }

  const created = await EmployeeRequest.create({
    number,
    kind: input.kind,
    userId: actor._id,
    employeeId: actor.employeeId,
    employeeName: actor.name,
    subject,
    details: input.details ?? '',
    ...punches,
    category: kind.categories ? input.category : '',
    amountPaise: kind.money ? Math.round(input.amount * 100) : null,
    date: kind.dateLabel ? input.date || null : null,
    attachments,
  });
  await recordAudit(actor, {
    action: 'request.created',
    entity: 'request',
    entityId: created._id,
    // A grievance's words stay out of the audit log.
    summary: `${kind.label} ${number}${isPrivate(input.kind) ? '' : `: ${subject}`}`,
    ip,
  });
  notifyDeciders(actor, created).catch(() => {});
  return getRequest(actor, created._id);
}

/** Only the times that match what was missed. */
function punchTimes(category, times) {
  const wanted = missedPunches(category);
  return {
    punchInTime: wanted.punchIn ? (times.punchInTime ?? null) : null,
    punchOutTime: wanted.punchOut ? (times.punchOutTime ?? null) : null,
  };
}

/** People who can decide this request: everyone-scope deciders, plus the manager for a team scope. */
async function deciderIds(owner, request) {
  const roles = rolesNow();
  const allKeys = Object.keys(roles).filter(
    (key) => roles[key].permissions['requests.decide'] === 'all',
  );
  const teamKeys = Object.keys(roles).filter(
    (key) => roles[key].permissions['requests.decide'] === 'team',
  );
  const or = [{ roleKey: { $in: allKeys } }];
  if (owner.managerId && !isPrivate(request.kind) && teamKeys.length) {
    or.push({ _id: owner.managerId, roleKey: { $in: teamKeys } });
  }
  const users = await User.find(
    { status: 'active', _id: { $ne: owner._id }, $or: or },
    '_id',
  ).lean();
  return users.map((user) => user._id);
}

async function notifyDeciders(owner, request) {
  const kind = REQUEST_KINDS[request.kind];
  await notifyUsers(await deciderIds(owner, request), {
    title: `${kind.label} from ${owner.name}`,
    body: isPrivate(request.kind) ? `${request.number}` : `${request.number}: ${request.subject}`,
    icon: '/logo.png',
    data: { url: `/requests/${request._id}` },
  });
}

/**
 * The inbox. box = 'mine' (own requests), 'decide' (waiting for this person's decision) or
 * 'all' (every request in scope).
 */
export async function listRequests(actor, query) {
  let filter;
  if (query.box === 'mine') {
    filter = { userId: actor._id };
  } else if (query.box === 'decide') {
    filter = await scopeFilter(actor, 'requests.decide');
    if (!filter) throw createAppError(403, 'You do not have access to this.');
    filter = { $and: [filter, { userId: { $ne: actor._id } }] };
  } else {
    filter = await scopeFilter(actor, 'requests.view');
    if (!filter) throw createAppError(403, 'You do not have access to this.');
  }
  const extra = {};
  if (query.kind) extra.kind = query.kind;
  const sent = momentCondition(query);
  if (sent) extra.createdAt = sent;
  if (query.status !== 'all') extra.status = query.status;
  if (query.q) {
    const pattern = containsRegex(query.q);
    extra.$or = [{ number: pattern }, { employeeName: pattern }, { employeeId: pattern }];
  }
  return runListQuery(EmployeeRequest, {
    filter: { $and: [filter, extra] },
    sort: { createdAt: -1 },
    page: query.page,
    pageSize: 25,
    projection: '-attachments -details -decisionNote',
  });
}

/** How many requests wait for this person's decision (0 without the permission). */
export async function countRequestsToDecide(actor) {
  const filter = await scopeFilter(actor, 'requests.decide');
  if (!filter) return 0;
  return EmployeeRequest.countDocuments({
    $and: [filter, { userId: { $ne: actor._id } }, { status: 'pending' }],
  });
}

/** The other things waiting in the inbox: leave and salary changes (they have their own screens). */
export async function otherApprovals(actor) {
  const items = [];
  const leave = await countPendingLeaves(actor);
  if (leave)
    items.push({
      key: 'leave',
      label: 'Leave requests',
      count: leave,
      href: '/leave?status=pending',
    });
  if (can(actor, 'salary.approve')) {
    const salary = await SalaryStructure.countDocuments({
      status: 'pending_approval',
      preparedBy: { $ne: actor._id },
    });
    if (salary)
      items.push({ key: 'salary', label: 'Salary changes', count: salary, href: '/salary' });
  }
  return items;
}

async function loadRequest(actor, id) {
  const request = await EmployeeRequest.findById(id)
    .lean()
    .catch(() => null);
  if (!request) throw notFound('Request');
  if (String(request.userId) === String(actor._id)) return request;
  for (const permission of ['requests.view', 'requests.decide']) {
    const filter = await scopeFilter(actor, permission);
    if (filter && (await EmployeeRequest.exists({ $and: [filter, { _id: request._id }] }))) {
      return request;
    }
  }
  throw notFound('Request');
}

async function mayDecide(actor, request) {
  if (String(request.userId) === String(actor._id)) return false;
  const filter = await scopeFilter(actor, 'requests.decide');
  return Boolean(
    filter && (await EmployeeRequest.exists({ $and: [filter, { _id: request._id }] })),
  );
}

export async function getRequest(actor, id) {
  const request = await loadRequest(actor, id);
  const pending = request.status === 'pending';
  return {
    ...request,
    attachments: await Promise.all(
      request.attachments.map(async (file) => ({
        fileName: file.fileName,
        contentType: file.contentType,
        uploadedAt: file.uploadedAt,
        url: await signedUrl(file.key),
      })),
    ),
    canDecide: pending && (await mayDecide(actor, request)),
    canCancel: pending && String(request.userId) === String(actor._id),
  };
}

export async function decideRequest(
  actor,
  id,
  { decision, note, approvedAmount, punchInTime, punchOutTime },
  { ip } = {},
) {
  const request = await loadRequest(actor, id);
  if (String(request.userId) === String(actor._id)) {
    throw createAppError(403, 'You cannot decide your own request.');
  }
  if (!(await mayDecide(actor, request)))
    throw createAppError(403, 'You do not have access to this.');
  if (request.status !== 'pending') {
    throw createAppError(409, 'This request has already been decided or withdrawn.');
  }
  const kind = REQUEST_KINDS[request.kind];
  let approvedAmountPaise = null;
  if (kind.money && decision === 'approved') {
    approvedAmountPaise =
      approvedAmount === undefined ? request.amountPaise : Math.round(approvedAmount * 100);
    if (approvedAmountPaise > request.amountPaise) {
      throw createAppError(400, 'approvedAmount: cannot be more than the amount asked');
    }
  }
  if (decision === 'rejected' && !note) {
    throw createAppError(400, 'note: write a reason for the employee');
  }
  // Missed punch: HR may correct the times; the day is checked again before anything is written.
  let owner = null;
  let approvedPunches = {};
  if (kind.punches && decision === 'approved') {
    owner = await User.findById(request.userId).lean();
    approvedPunches = punchTimes(request.category, {
      punchInTime: punchInTime ?? request.punchInTime,
      punchOutTime: punchOutTime ?? request.punchOutTime,
    });
    await checkMissedPunch(owner, { date: request.date, ...approvedPunches });
  }

  const updated = await EmployeeRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    {
      status: decision,
      decisionNote: note ?? '',
      approvedAmountPaise,
      approvedPunchInTime: approvedPunches.punchInTime ?? null,
      approvedPunchOutTime: approvedPunches.punchOutTime ?? null,
      decidedBy: actor._id,
      decidedByName: actor.name,
      decidedAt: new Date(),
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw createAppError(409, 'This request was just decided by someone else.');
  if (owner) {
    await writeMissedPunch(
      owner,
      { date: request.date, ...approvedPunches },
      { note: `Missed punch ${request.number}, approved by ${actor.name}` },
    );
  }

  const word = kind.done[decision];
  await recordAudit(actor, {
    action: `request.${decision}`,
    entity: 'request',
    entityId: id,
    summary: `${word}: ${kind.label} ${request.number} of ${request.employeeName}`,
    changes: changedOnApproval(request, approvedAmountPaise, approvedPunches),
    ip,
  });
  notifyUsers([request.userId], {
    title: `${kind.label} ${word.toLowerCase()}`,
    body: `${request.number}${note ? `: ${note}` : ''}`,
    icon: '/logo.png',
    data: { url: `/requests/${id}` },
  }).catch(() => {});
  return getRequest(actor, id);
}

/** What the decider changed from what was asked (amount, punch times), for the audit log. */
function changedOnApproval(request, approvedAmountPaise, approvedPunches) {
  const changes = {};
  if (approvedAmountPaise !== null && approvedAmountPaise !== request.amountPaise) {
    changes.amountPaise = { from: request.amountPaise, to: approvedAmountPaise };
  }
  for (const key of ['punchInTime', 'punchOutTime']) {
    if (approvedPunches[key] && approvedPunches[key] !== request[key]) {
      changes[key] = { from: request[key], to: approvedPunches[key] };
    }
  }
  return Object.keys(changes).length ? changes : undefined;
}

/** The employee withdraws their own request while it waits. */
export async function cancelRequest(actor, id, { ip } = {}) {
  const request = await loadRequest(actor, id);
  if (String(request.userId) !== String(actor._id)) throw notFound('Request');
  const updated = await EmployeeRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { status: 'cancelled' },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw createAppError(409, 'This request has already been decided.');
  await recordAudit(actor, {
    action: 'request.cancelled',
    entity: 'request',
    entityId: id,
    summary: `Withdrew ${REQUEST_KINDS[request.kind].label} ${request.number}`,
    ip,
  });
  return getRequest(actor, id);
}
