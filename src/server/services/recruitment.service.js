import { Candidate } from '../models/candidate.model.js';
import { Letter } from '../models/letter.model.js';
import { User } from '../models/user.model.js';
import { requirePermission } from '../permissions/can.js';
import { roleExists } from '../permissions/roles.js';
import { createAppError, notFound } from '../lib/errors.js';
import { containsRegex, runListQuery } from '../lib/pagination.js';
import { DROP_REASONS } from '../../config/recruitmentOptions.js';
import { recordAudit, diffFields } from './audit.service.js';
import { checkLookupValues } from './lookups.service.js';
import { createUser } from './users.service.js';
import { startOnboarding } from './onboarding.service.js';
import { momentCondition } from '../lib/dateFilter.js';
import { phoneKey } from '../lib/phone.js';

// Candidates and their offers (CEO spec section 4). Rules:
// - a candidate is not an employee: no employee ID, no sign-in, nothing in attendance or payroll;
// - offer letters are drafted, issued and replied to like every letter (letters.service);
// - a candidate joins only after an offer letter was accepted; joining makes the employee
//   (new employee ID), moves the candidate's letters to them and starts their onboarding;
// - a candidate who will not join is kept with the reason, never deleted.

const EDITABLE = [
  'name',
  'email',
  'phone',
  'address',
  'designation',
  'department',
  'branch',
  'staffType',
  'employmentType',
  'workMode',
  'managerId',
  'roleKey',
  'brandKey',
  'expectedJoiningDate',
  'source',
  'note',
];

async function checkPlan(input, before = {}) {
  await checkLookupValues(input, before);
  if (input.roleKey && !roleExists(input.roleKey)) throw createAppError(400, 'Choose a role.');
  if (input.managerId && !(await User.exists({ _id: input.managerId, status: 'active' }))) {
    throw createAppError(400, 'Choose an active reporting manager.');
  }
}

export async function listCandidates(actor, query) {
  requirePermission(actor, 'recruitment.view');
  const filter = {};
  if (query.status !== 'all') filter.status = query.status;
  const added = momentCondition(query);
  if (added) filter.createdAt = added;
  if (query.q) {
    const pattern = containsRegex(query.q);
    filter.$or = [
      { name: pattern },
      { email: pattern },
      { phone: pattern },
      { designation: pattern },
    ];
  }
  const result = await runListQuery(Candidate, {
    filter,
    sort: { createdAt: -1 },
    page: query.page,
    pageSize: 25,
  });
  // The newest offer letter of each candidate, for its status in the list.
  const offers = await Letter.aggregate([
    { $match: { candidateId: { $in: result.items.map((item) => item._id) }, kind: 'offer' } },
    { $sort: { version: -1 } },
    {
      $group: {
        _id: '$candidateId',
        status: { $first: '$status' },
        version: { $first: '$version' },
      },
    },
  ]);
  const offerOf = new Map(offers.map((offer) => [String(offer._id), offer]));
  return {
    ...result,
    items: result.items.map((item) => ({ ...item, offer: offerOf.get(String(item._id)) ?? null })),
  };
}

/** Counts for the dashboard: offers waiting for a reply, accepted offers waiting to join. */
export async function recruitmentCounts() {
  const open = await Candidate.find({ status: 'open' }, '_id').lean();
  const ids = open.map((candidate) => candidate._id);
  const [waiting, accepted] = await Promise.all([
    Letter.distinct('candidateId', { candidateId: { $in: ids }, kind: 'offer', status: 'issued' }),
    Letter.distinct('candidateId', {
      candidateId: { $in: ids },
      kind: 'offer',
      status: 'accepted',
    }),
  ]);
  return { offersWaiting: waiting.length, toJoin: accepted.length };
}

async function loadCandidate(actor, id) {
  requirePermission(actor, 'recruitment.view');
  const candidate = await Candidate.findById(id)
    .lean()
    .catch(() => null);
  if (!candidate) throw notFound('Candidate');
  return candidate;
}

export async function getCandidate(actor, id) {
  const candidate = await loadCandidate(actor, id);
  const [letters, manager] = await Promise.all([
    Letter.find({ candidateId: candidate._id }, '-body').sort({ createdAt: -1 }).lean(),
    candidate.managerId ? User.findById(candidate.managerId, 'name employeeId').lean() : null,
  ]);
  return {
    candidate,
    manager,
    letters,
    hasAcceptedOffer: letters.some(
      (letter) => letter.kind === 'offer' && letter.status === 'accepted',
    ),
  };
}

export async function addCandidate(actor, input, { ip } = {}) {
  requirePermission(actor, 'recruitment.manage');
  await checkPlan(input);
  const candidate = await Candidate.create({
    ...input,
    phoneKey: phoneKey(input.phone),
    managerId: input.managerId || null,
    createdBy: actor._id,
  });
  await recordAudit(actor, {
    action: 'candidate.added',
    entity: 'candidate',
    entityId: candidate._id,
    summary: `Candidate ${candidate.name}${candidate.designation ? ` for ${candidate.designation}` : ''}`,
    ip,
  });
  return candidate.toObject();
}

export async function updateCandidate(actor, id, input, { ip } = {}) {
  requirePermission(actor, 'recruitment.manage');
  const before = await loadCandidate(actor, id);
  if (before.status !== 'open') throw createAppError(409, 'Only an open candidate can be changed.');
  await checkPlan(input, before);
  const update = { ...input };
  if ('managerId' in update) update.managerId = update.managerId || null;
  if ('phone' in update) update.phoneKey = phoneKey(update.phone);
  await Candidate.updateOne({ _id: id }, { $set: update });
  const changes = diffFields(before, input, EDITABLE);
  if (Object.keys(changes).length) {
    await recordAudit(actor, {
      action: 'candidate.updated',
      entity: 'candidate',
      entityId: id,
      summary: `Edited candidate ${before.name}`,
      changes,
      ip,
    });
  }
  return Candidate.findById(id).lean();
}

/** The candidate will not join (declined, withdrawn, did not come). Kept, never deleted. */
export async function dropCandidate(actor, id, { reason, note }, { ip } = {}) {
  requirePermission(actor, 'recruitment.manage');
  const candidate = await loadCandidate(actor, id);
  const updated = await Candidate.findOneAndUpdate(
    { _id: id, status: 'open' },
    { status: 'dropped', dropReason: reason, dropNote: note ?? '' },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw createAppError(409, 'This candidate is not open.');
  await recordAudit(actor, {
    action: 'candidate.dropped',
    entity: 'candidate',
    entityId: id,
    summary: `${candidate.name}: ${DROP_REASONS[reason]}`,
    ip,
  });
  return updated;
}

/**
 * The candidate joins: makes the employee from the candidate (new employee ID, password set by
 * HR), moves their letters to the employee and marks the candidate joined.
 * @returns {Promise<object>} the new employee
 */
export async function joinCandidate(actor, id, { joiningDate, password, email }, { ip } = {}) {
  requirePermission(actor, 'recruitment.manage');
  requirePermission(actor, 'users.manage');
  const candidate = await loadCandidate(actor, id);
  if (candidate.status !== 'open') throw createAppError(409, 'This candidate is not open.');
  const accepted = await Letter.exists({
    candidateId: candidate._id,
    kind: 'offer',
    status: 'accepted',
  });
  if (!accepted) throw createAppError(409, 'Record the acceptance of an offer letter first.');
  // Claim the candidate first, so two clicks never make two employees.
  const claimed = await Candidate.findOneAndUpdate(
    { _id: id, status: 'open' },
    { status: 'joined', joinedAt: new Date() },
  );
  if (!claimed) throw createAppError(409, 'This candidate was just changed by someone else.');

  let employee;
  try {
    employee = await createUser(
      actor,
      {
        name: candidate.name,
        password,
        phone: candidate.phone,
        ...(email ? { email } : {}),
        personalEmail: candidate.email,
        currentAddress: candidate.address,
        designation: candidate.designation,
        department: candidate.department,
        branch: candidate.branch,
        staffType: candidate.staffType || 'Office Staff',
        employmentType: candidate.employmentType,
        workMode: candidate.workMode,
        managerId: candidate.managerId ? String(candidate.managerId) : undefined,
        roleKey: candidate.roleKey || 'employee',
        brandKey: candidate.brandKey || 'mwg',
        joiningDate,
        employmentStatus: 'probation',
      },
      { ip },
    );
  } catch (error) {
    await Candidate.updateOne({ _id: id }, { status: 'open', joinedAt: null });
    throw error;
  }
  await Candidate.updateOne({ _id: id }, { userId: employee._id });
  await Letter.updateMany(
    { candidateId: candidate._id },
    { userId: employee._id, employeeId: employee.employeeId },
  );
  await startOnboarding(actor, employee._id, { ip });
  await recordAudit(actor, {
    action: 'candidate.joined',
    entity: 'candidate',
    entityId: id,
    summary: `${candidate.name} joined as ${employee.employeeId}`,
    ip,
  });
  return employee;
}
