import { User } from '../models/user.model.js';
import { Kyc } from '../models/kyc.model.js';
import { DocumentType, EmployeeDocument } from '../models/document.model.js';
import { Letter } from '../models/letter.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { SalaryStructure } from '../models/salary.model.js';
import { can, employeeScopeFilter } from '../permissions/can.js';
import { indiaDay } from '../lib/dates.js';
import { salaryOverview } from './salary.service.js';
import { queueExpiryCheck } from './documents.service.js';
import { countRequestsToDecide } from './requests.service.js';
import { recruitmentCounts } from './recruitment.service.js';
import { countOpenOnboardings } from './onboarding.service.js';
import { exitCounts } from './exits.service.js';

// The CEO dashboard (CEO spec section 1, "MWG People & Finance Control"): headcount, verified %,
// payroll exposure, open items and a priority queue. Everything is worked out live from the
// records; each part shows only when the person may see that data for everyone.

const REVIEW_WAITING = ['submitted', 'under_review'];

/** Null when the person should not see the company-wide view. */
export async function getControlCenter(actor) {
  if (can(actor, 'users.view') !== 'all') return null;
  queueExpiryCheck();
  const active = await User.find(
    { status: 'active' },
    '_id name employeeId employmentStatus completeness photoKey',
  ).lean();
  const activeIds = active.map((person) => person._id);
  const queue = [];

  // ---- People and file completeness ----
  const byStatus = (status) =>
    active.filter((person) => (person.employmentStatus || '') === status).length;
  const incomplete = active.filter((person) => (person.completeness?.percent ?? 0) < 100);
  const people = {
    total: active.length,
    probation: byStatus('probation'),
    confirmed: byStatus('confirmed'),
    notice: byStatus('notice_period'),
    notSet: byStatus(''),
    averageCompleteness: active.length
      ? Math.round(
          active.reduce((sum, person) => sum + (person.completeness?.percent ?? 0), 0) /
            active.length,
        )
      : 100,
    leastComplete: incomplete
      .sort((a, b) => (a.completeness?.percent ?? 0) - (b.completeness?.percent ?? 0))
      .slice(0, 5)
      .map((person) => ({
        _id: person._id,
        name: person.name,
        employeeId: person.employeeId,
        percent: person.completeness?.percent ?? 0,
        missing: person.completeness?.missing?.slice(0, 3) ?? [],
      })),
  };
  if (incomplete.length) {
    queue.push({
      key: 'files',
      label: 'Incomplete employee files',
      count: incomplete.length,
      href: '/employees?file=incomplete&sort=completeness',
      tone: 'warning',
    });
  }

  // ---- Verified %: KYC items and required documents that are verified ----
  let verified = null;
  if (can(actor, 'kyc.view') === 'all' && can(actor, 'documents.view') === 'all') {
    const [kycRecords, requiredTypes] = await Promise.all([
      Kyc.find({ userId: { $in: activeIds } }, 'pan.status aadhaar.status bank.status').lean(),
      DocumentType.find({ required: true, active: true }, '_id').lean(),
    ]);
    const docs = await EmployeeDocument.find(
      { userId: { $in: activeIds }, typeId: { $in: requiredTypes.map((type) => type._id) } },
      'status',
    ).lean();
    const kycVerified = kycRecords.reduce(
      (sum, record) =>
        sum +
        ['pan', 'aadhaar', 'bank'].filter((item) => record[item]?.status === 'verified').length,
      0,
    );
    const docsVerified = docs.filter((doc) => doc.status === 'verified').length;
    const needed = active.length * (3 + requiredTypes.length);
    verified = {
      percent: needed ? Math.round(((kycVerified + docsVerified) / needed) * 100) : 100,
      verifiedItems: kycVerified + docsVerified,
      neededItems: needed,
    };
    const kycWaiting = kycRecords.reduce(
      (sum, record) =>
        sum +
        ['pan', 'aadhaar', 'bank'].filter((item) => REVIEW_WAITING.includes(record[item]?.status))
          .length,
      0,
    );
    if (kycWaiting)
      queue.push({
        key: 'kyc',
        label: 'KYC and bank details to verify',
        count: kycWaiting,
        href: '/employees?file=incomplete',
        tone: 'info',
      });
  }

  // ---- Documents to check, and documents expiring within 30 days ----
  if (can(actor, 'documents.view') === 'all') {
    const soon = indiaDay(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const [toCheck, expiring, expired] = await Promise.all([
      EmployeeDocument.countDocuments({ status: { $in: REVIEW_WAITING } }),
      EmployeeDocument.countDocuments({
        expiresOn: { $ne: '', $lte: soon },
        status: { $nin: ['expired'] },
      }),
      EmployeeDocument.countDocuments({ status: 'expired' }),
    ]);
    if (toCheck)
      queue.push({
        key: 'documents',
        label: 'Documents to verify',
        count: toCheck,
        href: '/documents?status=submitted',
        tone: 'info',
      });
    if (expired)
      queue.push({
        key: 'expired',
        label: 'Expired documents',
        count: expired,
        href: '/documents?status=expired',
        tone: 'danger',
      });
    if (expiring)
      queue.push({
        key: 'expiring',
        label: 'Documents expiring in 30 days',
        count: expiring,
        href: '/documents?expiring=soon',
        tone: 'warning',
      });
  }

  // ---- Salary: payroll exposure and approvals ----
  let payroll = null;
  if (can(actor, 'salary.view') === 'all') {
    const overview = await salaryOverview(actor);
    payroll = {
      monthlyCtc: overview.totals.monthlyCtc,
      monthlyGross: overview.totals.monthlyGross,
      withSalary: overview.totals.withSalary,
      people: overview.totals.people,
    };
    const waiting = await SalaryStructure.countDocuments({ status: 'pending_approval' });
    if (waiting)
      queue.push({
        key: 'salary',
        label: 'Salary changes to approve',
        count: waiting,
        href: '/salary',
        tone: 'brand',
      });
    const noSalary = overview.totals.people - overview.totals.withSalary;
    if (noSalary)
      queue.push({
        key: 'no-salary',
        label: 'Employees without an approved salary',
        count: noSalary,
        href: '/salary',
        tone: 'warning',
      });
  }

  // ---- Letters waiting for the employee's reply ----
  if (can(actor, 'letters.view') === 'all') {
    const waitingLetters = await Letter.countDocuments({ status: 'issued' });
    if (waitingLetters)
      queue.push({
        key: 'letters',
        label: 'Letters not yet accepted',
        count: waitingLetters,
        href: '/employees',
        tone: 'info',
      });
  }

  // ---- Leave waiting for a decision ----
  if (can(actor, 'leave.decide')) {
    const scope = await employeeScopeFilter(actor, 'leave.decide');
    const pendingLeave = await LeaveRequest.countDocuments({
      ...scope,
      status: 'pending',
      employeeId: { ...(scope.employeeId ?? {}), $ne: actor.employeeId },
    });
    if (pendingLeave)
      queue.push({
        key: 'leave',
        label: 'Leave requests to decide',
        count: pendingLeave,
        href: '/leave?status=pending',
        tone: 'brand',
      });
  }

  // ---- Requests (expense, advance, document, grievance) waiting for a decision ----
  const requestsWaiting = await countRequestsToDecide(actor);
  if (requestsWaiting)
    queue.push({
      key: 'requests',
      label: 'Requests to decide',
      count: requestsWaiting,
      href: '/requests?box=decide',
      tone: 'brand',
    });

  // ---- Hiring: offers waiting for a reply, accepted offers waiting to join ----
  if (can(actor, 'recruitment.view')) {
    const hiring = await recruitmentCounts();
    if (hiring.toJoin)
      queue.push({
        key: 'to-join',
        label: 'Accepted offers waiting to join',
        count: hiring.toJoin,
        href: '/recruitment',
        tone: 'brand',
      });
    if (hiring.offersWaiting)
      queue.push({
        key: 'offers',
        label: 'Offers waiting for a reply',
        count: hiring.offersWaiting,
        href: '/recruitment',
        tone: 'info',
      });
  }

  // ---- Joining checklists still open ----
  if (can(actor, 'users.manage')) {
    const onboarding = await countOpenOnboardings(actor);
    if (onboarding)
      queue.push({
        key: 'onboarding',
        label: 'Onboarding not finished',
        count: onboarding,
        href: '/onboarding',
        tone: 'warning',
      });
  }

  // ---- Exits: notice periods, and those past the last working day ----
  if (can(actor, 'exits.view')) {
    const exits = await exitCounts(actor);
    if (exits?.overdue)
      queue.push({
        key: 'exits-overdue',
        label: 'Exits past the last working day',
        count: exits.overdue,
        href: '/exits',
        tone: 'danger',
      });
    if (exits && exits.open - exits.overdue > 0)
      queue.push({
        key: 'exits',
        label: 'Employees in notice period',
        count: exits.open - exits.overdue,
        href: '/exits',
        tone: 'info',
      });
  }

  const order = [
    'exits-overdue',
    'salary',
    'requests',
    'to-join',
    'onboarding',
    'expired',
    'kyc',
    'documents',
    'leave',
    'letters',
    'offers',
    'exits',
    'expiring',
    'no-salary',
    'files',
  ];
  queue.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return {
    people,
    verified,
    payroll,
    openItems: queue.reduce((sum, item) => sum + item.count, 0),
    queue,
  };
}
