import { Review } from '../models/review.model.js';
import { User } from '../models/user.model.js';
import {
  can,
  canSeeEmployee,
  employeeScopeFilter,
  requirePermission,
  visibleEmployeeIds,
} from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { runListQuery } from '../lib/pagination.js';
import { REVIEW_KINDS } from '../../config/performanceOptions.js';
import { recordAudit } from './audit.service.js';
import { notifyUsers } from './push.service.js';
import { overlapCondition } from '../lib/dateFilter.js';

// Performance reviews and improvement plans. Rules:
// - written by someone who manages the employee (a manager for the team, HR for everyone),
//   never for oneself;
// - a draft is seen only by the people who may write it; sharing it shows it to the employee;
// - after sharing the review text is fixed; the employee reads it and may add a comment once;
// - an improvement plan gets its outcome (met, extended, not met) after it is shared.

/** True if the person may write reviews for this employee. */
async function mayManage(actor, employeeId) {
  if (!can(actor, 'performance.manage')) return false;
  if (employeeId === actor.employeeId) return false;
  return canSeeEmployee(actor, 'performance.manage', employeeId);
}

async function loadReview(actor, id) {
  requirePermission(actor, 'performance.view');
  const review = await Review.findById(id)
    .lean()
    .catch(() => null);
  if (!review) throw notFound('Review');
  const manage = await mayManage(actor, review.employeeId);
  const sees = manage || (await canSeeEmployee(actor, 'performance.view', review.employeeId));
  if (!sees || (review.status === 'draft' && !manage)) throw notFound('Review');
  return { review, manage };
}

export async function getReview(actor, id) {
  const { review, manage } = await loadReview(actor, id);
  const isEmployee = String(review.userId) === String(actor._id);
  return {
    ...review,
    permissions: {
      edit: manage && review.status === 'draft',
      share: manage && review.status === 'draft',
      outcome: manage && review.kind === 'improvement_plan' && review.status !== 'draft',
      acknowledge: isEmployee && review.status === 'shared',
    },
  };
}

/** Reviews in scope. Drafts only for the people who may write them. */
export async function listReviews(actor, query) {
  requirePermission(actor, 'performance.view');
  const scope = await employeeScopeFilter(actor, 'performance.view');
  const manageIds = can(actor, 'performance.manage')
    ? await visibleEmployeeIds(actor, 'performance.manage')
    : [];
  const draftsVisible =
    manageIds === null
      ? { employeeId: { $ne: actor.employeeId } }
      : { employeeId: { $in: manageIds.filter((id) => id !== actor.employeeId) } };
  const filter = {
    $and: [
      scope.employeeId ? { $or: [scope, draftsVisible] } : {},
      { $or: [{ status: { $ne: 'draft' } }, draftsVisible] },
    ],
  };
  if (query.employeeId) filter.$and.push({ employeeId: query.employeeId });
  filter.$and.push(overlapCondition(query, 'periodStart', 'periodEnd'));
  if (query.kind) filter.$and.push({ kind: query.kind });
  if (query.status) filter.$and.push({ status: query.status });
  return runListQuery(Review, {
    filter,
    sort: { periodEnd: -1, createdAt: -1 },
    page: query.page,
    pageSize: 25,
    projection:
      'employeeId employeeName userId kind periodStart periodEnd rating status reviewerName outcome',
  });
}

const reviewFields = (input) => {
  const fields = {};
  for (const key of [
    'kind',
    'periodStart',
    'periodEnd',
    'goals',
    'strengths',
    'improvements',
    'training',
  ]) {
    if (input[key] !== undefined) fields[key] = input[key];
  }
  if (input.rating !== undefined) fields.rating = input.rating || null;
  return fields;
};

export async function createReview(actor, userId, input, { ip } = {}) {
  requirePermission(actor, 'performance.manage');
  const person = await User.findById(userId, 'name employeeId status')
    .lean()
    .catch(() => null);
  if (!person) throw notFound('Employee');
  if (person.employeeId === actor.employeeId) {
    throw createAppError(403, 'Someone else must write your own review.');
  }
  if (!(await mayManage(actor, person.employeeId))) throw notFound('Employee');
  if (input.periodEnd < input.periodStart) {
    throw createAppError(400, 'periodEnd: the period ends before it starts');
  }
  const review = await Review.create({
    ...reviewFields(input),
    userId: person._id,
    employeeId: person.employeeId,
    employeeName: person.name,
    reviewerId: actor._id,
    reviewerName: actor.name,
  });
  await recordAudit(actor, {
    action: 'review.drafted',
    entity: 'review',
    entityId: review._id,
    summary: `${REVIEW_KINDS[review.kind]} drafted for ${person.name} (${review.periodStart} to ${review.periodEnd})`,
    ip,
  });
  return getReview(actor, review._id);
}

export async function updateReview(actor, id, input, { ip } = {}) {
  const { review, manage } = await loadReview(actor, id);
  if (!manage) throw createAppError(403, 'You do not have access to this.');
  const set = {};
  if (input.outcome !== undefined || input.outcomeNote !== undefined) {
    if (review.kind !== 'improvement_plan' || review.status === 'draft') {
      throw createAppError(409, 'An outcome is written on a shared improvement plan.');
    }
    if (input.outcome !== undefined) set.outcome = input.outcome;
    if (input.outcomeNote !== undefined) set.outcomeNote = input.outcomeNote;
  }
  const fields = reviewFields(input);
  if (Object.keys(fields).length) {
    if (review.status !== 'draft') {
      throw createAppError(409, 'A shared review cannot change. Write a new one.');
    }
    Object.assign(set, fields);
  }
  const next = { ...review, ...set };
  if (next.periodEnd < next.periodStart) {
    throw createAppError(400, 'periodEnd: the period ends before it starts');
  }
  await Review.updateOne({ _id: id }, { $set: set });
  await recordAudit(actor, {
    action: set.outcome !== undefined ? 'review.outcome' : 'review.edited',
    entity: 'review',
    entityId: id,
    summary: `${REVIEW_KINDS[review.kind]} of ${review.employeeName}: ${Object.keys(set).join(', ')}`,
    ip,
  });
  return getReview(actor, id);
}

/** Shows the review to the employee. The text is fixed from now on. */
export async function shareReview(actor, id, { ip } = {}) {
  const { review, manage } = await loadReview(actor, id);
  if (!manage) throw createAppError(403, 'You do not have access to this.');
  if (review.kind === 'review' && !review.rating) {
    throw createAppError(400, 'rating: choose the overall rating before sharing');
  }
  const shared = await Review.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { status: 'shared', sharedAt: new Date() },
  );
  if (!shared) throw createAppError(409, 'This review is already shared.');
  await recordAudit(actor, {
    action: 'review.shared',
    entity: 'review',
    entityId: id,
    summary: `${REVIEW_KINDS[review.kind]} shared with ${review.employeeName}`,
    ip,
  });
  notifyUsers([review.userId], {
    title: `${REVIEW_KINDS[review.kind]} for you`,
    body: `${review.periodStart} to ${review.periodEnd}. Open it to read.`,
    icon: '/logo.png',
    data: { url: `/performance/${id}` },
  }).catch(() => {});
  return getReview(actor, id);
}

/** The employee has read it, with an optional comment (once). */
export async function acknowledgeReview(actor, id, { comment }, { ip } = {}) {
  const { review } = await loadReview(actor, id);
  if (String(review.userId) !== String(actor._id)) throw notFound('Review');
  const done = await Review.findOneAndUpdate(
    { _id: id, status: 'shared' },
    { status: 'acknowledged', acknowledgedAt: new Date(), employeeComment: comment ?? '' },
  );
  if (!done) throw createAppError(409, 'This review is already marked as seen.');
  await recordAudit(actor, {
    action: 'review.acknowledged',
    entity: 'review',
    entityId: id,
    summary: `${REVIEW_KINDS[review.kind]} seen by ${review.employeeName}${comment ? ' with a comment' : ''}`,
    ip,
  });
  notifyUsers([review.reviewerId], {
    title: `${review.employeeName} read the ${REVIEW_KINDS[review.kind].toLowerCase()}`,
    body: comment ? comment.slice(0, 120) : 'No comment.',
    icon: '/logo.png',
    data: { url: `/performance/${id}` },
  }).catch(() => {});
  return getReview(actor, id);
}
