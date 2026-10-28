import { SalaryStructure } from '../models/salary.model.js';
import { User } from '../models/user.model.js';
import { roleKeysWith } from '../permissions/roles.js';
import { can, canSeeEmployee, employeeScopeFilter, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { indiaDay } from '../lib/dates.js';
import { salaryTotals } from '../lib/salary.js';
import { recordAudit } from './audit.service.js';
import { refreshCompleteness } from './completeness.service.js';
import { notifyUsers } from './push.service.js';

// Salary structures (CEO spec section 5A). Rules:
// - every change is a new version; an approved version is never edited or removed;
// - only one proposal waits for approval at a time per employee;
// - the person who proposed cannot approve (maker-checker);
// - the structure in force is the latest approved one whose effective date has come;
// - employees see only their own approved structures.

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

async function loadEmployee(actor, userId) {
  const user = await User.findById(userId, '_id name employeeId')
    .lean()
    .catch(() => null);
  if (!user || !(await canSeeEmployee(actor, 'salary.view', user.employeeId)))
    throw notFound('Employee');
  return user;
}

/** The approved structure in force on a day (null if none). */
export async function salaryInForce(userId, day = indiaDay()) {
  return SalaryStructure.findOne({ userId, status: 'approved', effectiveFrom: { $lte: day } })
    .sort({ effectiveFrom: -1, version: -1 })
    .lean();
}

/** Everything about one employee's salary that this person may see. */
export async function getSalary(actor, userId) {
  const user = await loadEmployee(actor, userId);
  const isOwnOnly = can(actor, 'salary.view') === 'own';
  const filter = { userId: user._id, ...(isOwnOnly ? { status: 'approved' } : {}) };
  const versions = await SalaryStructure.find(filter).sort({ version: -1 }).lean();
  const people = await User.find(
    {
      _id: {
        $in: versions.flatMap((version) => [version.preparedBy, version.decidedBy]).filter(Boolean),
      },
    },
    'name',
  ).lean();
  const nameOf = (id) => people.find((person) => String(person._id) === String(id))?.name ?? null;
  const today = indiaDay();
  const current = await salaryInForce(user._id, today);
  const withNames = versions.map((version) => ({
    ...version,
    preparedByName: nameOf(version.preparedBy),
    decidedByName: nameOf(version.decidedBy),
    inForce: current ? String(current._id) === String(version._id) : false,
    upcoming: version.status === 'approved' && version.effectiveFrom > today,
  }));
  const pending = withNames.find((version) => version.status === 'pending_approval') ?? null;
  return {
    user,
    current: withNames.find((version) => version.inForce) ?? null,
    pending,
    versions: withNames,
    permissions: {
      manage: Boolean(can(actor, 'salary.manage')),
      approve: Boolean(can(actor, 'salary.approve')),
      decidePending: Boolean(
        pending && can(actor, 'salary.approve') && String(pending.preparedBy) !== String(actor._id),
      ),
      withdrawPending: Boolean(pending && can(actor, 'salary.manage')),
    },
  };
}

/** A new structure or revision, waiting for approval. */
export async function proposeSalary(
  actor,
  userId,
  { effectiveFrom, reason, components },
  { ip } = {},
) {
  requirePermission(actor, 'salary.manage');
  const user = await loadEmployee(actor, userId);
  if (await SalaryStructure.exists({ userId: user._id, status: 'pending_approval' })) {
    throw createAppError(
      409,
      'A salary proposal for this employee is already waiting for approval. Decide or withdraw it first.',
    );
  }
  const totals = salaryTotals(components);
  if (totals.monthlyGross <= 0) throw createAppError(400, 'Enter at least the basic salary.');
  if (totals.monthlyNet < 0)
    throw createAppError(400, 'Deductions are larger than the gross salary.');
  const last = await SalaryStructure.findOne({ userId: user._id }, 'version')
    .sort({ version: -1 })
    .lean();
  const proposal = await SalaryStructure.create({
    userId: user._id,
    employeeId: user.employeeId,
    version: (last?.version ?? 0) + 1,
    effectiveFrom,
    reason,
    components,
    totals,
    preparedBy: actor._id,
  });
  await recordAudit(actor, {
    action: 'salary.proposed',
    entity: 'salary',
    entityId: user._id,
    summary: `Salary v${proposal.version} proposed for ${user.name} (${user.employeeId}): annual CTC ${rupees(totals.annualCtc)} from ${effectiveFrom}. ${reason}`,
    ip,
  });
  const approverRoles = roleKeysWith('salary.approve');
  const approvers = await User.find(
    { roleKey: { $in: approverRoles }, status: 'active', _id: { $ne: actor._id } },
    '_id',
  ).lean();
  notifyUsers(
    approvers.map((approver) => approver._id),
    {
      title: 'Salary change to approve',
      body: `${user.name}: annual CTC ${rupees(totals.annualCtc)} from ${effectiveFrom}`,
      icon: '/logo.png',
      data: { url: `/employees/${user._id}/salary` },
    },
  ).catch(() => {});
  return getSalary(actor, userId);
}

/** Approve or reject a proposal. Never by the person who proposed it. */
export async function decideSalary(actor, salaryId, { decision, note }, { ip } = {}) {
  requirePermission(actor, 'salary.approve');
  const proposal = await SalaryStructure.findById(salaryId)
    .lean()
    .catch(() => null);
  if (!proposal || !(await canSeeEmployee(actor, 'salary.view', proposal.employeeId)))
    throw notFound('Salary proposal');
  if (proposal.status !== 'pending_approval')
    throw createAppError(409, `This proposal is already ${proposal.status.replace('_', ' ')}.`);
  if (String(proposal.preparedBy) === String(actor._id)) {
    throw createAppError(403, 'You proposed this salary, so someone else must approve it.');
  }
  if (decision === 'rejected' && !note) throw createAppError(400, 'note: write why it is rejected');
  const status = decision === 'approved' ? 'approved' : 'rejected';
  const updated = await SalaryStructure.findOneAndUpdate(
    { _id: salaryId, status: 'pending_approval' },
    { status, decidedBy: actor._id, decidedAt: new Date(), decisionNote: note },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw createAppError(409, 'This proposal was just decided by someone else.');
  const user = await User.findById(proposal.userId, 'name employeeId').lean();
  await refreshCompleteness(proposal.userId);
  await recordAudit(actor, {
    action: `salary.${status}`,
    entity: 'salary',
    entityId: proposal.userId,
    summary: `Salary v${proposal.version} of ${user.name} ${status}${note ? `: ${note}` : ''}`,
    ip,
  });
  notifyUsers([proposal.preparedBy], {
    title: `Salary proposal ${status}`,
    body: `${user.name}, v${proposal.version}${note ? `: ${note}` : ''}`,
    icon: '/logo.png',
    data: { url: `/employees/${proposal.userId}/salary` },
  }).catch(() => {});
  return getSalary(actor, proposal.userId);
}

/** Takes back a proposal that is still waiting. */
export async function withdrawSalary(actor, salaryId, { ip } = {}) {
  requirePermission(actor, 'salary.manage');
  const proposal = await SalaryStructure.findById(salaryId)
    .lean()
    .catch(() => null);
  if (!proposal || !(await canSeeEmployee(actor, 'salary.view', proposal.employeeId)))
    throw notFound('Salary proposal');
  if (proposal.status !== 'pending_approval')
    throw createAppError(409, 'Only a waiting proposal can be withdrawn.');
  await SalaryStructure.updateOne(
    { _id: salaryId },
    { status: 'withdrawn', decidedBy: actor._id, decidedAt: new Date() },
  );
  await recordAudit(actor, {
    action: 'salary.withdrawn',
    entity: 'salary',
    entityId: proposal.userId,
    summary: `Salary v${proposal.version} withdrawn`,
    ip,
  });
  return getSalary(actor, proposal.userId);
}

/** The salary screen: proposals waiting, and everyone's salary in force (in scope). */
export async function salaryOverview(actor) {
  requirePermission(actor, 'salary.view');
  const scope = await employeeScopeFilter(actor, 'salary.view');
  const people = await User.find(
    { ...scope, status: 'active' },
    '_id name employeeId designation department',
  )
    .sort({ name: 1 })
    .lean();
  const today = indiaDay();
  const [pending, approved] = await Promise.all([
    SalaryStructure.find({ ...scope, status: 'pending_approval' })
      .sort({ preparedAt: 1 })
      .lean(),
    SalaryStructure.find({ ...scope, status: 'approved', effectiveFrom: { $lte: today } })
      .sort({ effectiveFrom: -1, version: -1 })
      .lean(),
  ]);
  const inForce = new Map();
  for (const structure of approved) {
    if (!inForce.has(String(structure.userId))) inForce.set(String(structure.userId), structure);
  }
  const personOf = new Map(people.map((person) => [String(person._id), person]));
  const rows = people.map((person) => ({
    user: person,
    current: inForce.get(String(person._id)) ?? null,
  }));
  return {
    pending: pending.map((proposal) => ({
      ...proposal,
      user: personOf.get(String(proposal.userId)) ?? null,
      mine: String(proposal.preparedBy) === String(actor._id),
    })),
    rows,
    totals: {
      people: rows.length,
      withSalary: rows.filter((row) => row.current).length,
      monthlyGross: rows.reduce((total, row) => total + (row.current?.totals.monthlyGross ?? 0), 0),
      monthlyCtc: rows.reduce((total, row) => total + (row.current?.totals.monthlyCtc ?? 0), 0),
    },
    canApprove: Boolean(can(actor, 'salary.approve')),
  };
}
