import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { Kyc } from '../models/kyc.model.js';
import { KycLink } from '../models/kycLink.model.js';
import { EmployeeDocument } from '../models/document.model.js';
import { Letter } from '../models/letter.model.js';
import { Onboarding } from '../models/onboarding.model.js';
import { Exit } from '../models/exit.model.js';
import { Payslip } from '../models/payslip.model.js';
import { EmployeeRequest } from '../models/request.model.js';
import { Review } from '../models/review.model.js';
import { SalaryStructure } from '../models/salary.model.js';
import { CompOff, LeaveBalanceEntry } from '../models/leaveRules.model.js';
import { Asset } from '../models/asset.model.js';
import { PushSubscription, Session } from '../models/system.models.js';
import { requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { moveToTrash } from './trash.service.js';

// Deleting an employee (founder, 2026-10-29): the employee and everything that is theirs go to
// Recently deleted together, so a restore brings back the whole file. Sign-ins and push
// subscriptions are simply ended. Assets belong to the company: they must be returned first,
// and a manager's team must get another manager first. The audit log is kept as it is.

const OWN_RECORDS = [
  ['attendance records', Attendance],
  ['leave requests', LeaveRequest],
  ['KYC', Kyc],
  ['KYC links', KycLink],
  ['documents', EmployeeDocument],
  ['letters', Letter],
  ['onboarding', Onboarding],
  ['exits', Exit],
  ['salary slips', Payslip],
  ['requests', EmployeeRequest],
  ['reviews', Review],
  ['salary structures', SalaryStructure],
  ['comp-offs', CompOff],
  ['leave balance entries', LeaveBalanceEntry],
];

export async function deleteEmployee(actor, id, { ip } = {}) {
  requirePermission(actor, 'users.manage');
  const user = await User.findById(id, 'name employeeId roleKey')
    .lean()
    .catch(() => null);
  if (!user) throw notFound('Employee');
  if (String(user._id) === String(actor._id)) {
    throw createAppError(400, 'You cannot delete your own account.');
  }
  if (user.roleKey === 'ceo' && actor.roleKey !== 'ceo') {
    throw createAppError(403, 'Only the CEO can delete a CEO account.');
  }
  if (await Asset.exists({ userId: user._id })) {
    throw createAppError(409, `${user.name} still has company assets. Record their return first.`);
  }
  if (await User.exists({ managerId: user._id })) {
    throw createAppError(
      409,
      `${user.name} is the reporting manager of other employees. Give them another manager first.`,
    );
  }
  const mine = { $or: [{ userId: user._id }, { employeeId: user.employeeId }] };
  const { counts } = await moveToTrash(
    actor,
    {
      kind: 'employee',
      label: `${user.name} (${user.employeeId})`,
      entityId: user._id,
      parts: [
        { model: User, filter: { _id: user._id } },
        ...OWN_RECORDS.map(([, model]) => ({ model, filter: mine })),
        { model: Session, filter: { userId: user._id }, drop: true },
        { model: PushSubscription, filter: { userId: user._id }, drop: true },
      ],
    },
    { ip },
  );
  return { ok: true, moved: counts };
}

/** What deleting would take with it, for the confirmation ("214 attendance records …"). */
export async function deletePreview(actor, id) {
  requirePermission(actor, 'users.manage');
  const user = await User.findById(id, 'employeeId')
    .lean()
    .catch(() => null);
  if (!user) throw notFound('Employee');
  const mine = { $or: [{ userId: user._id }, { employeeId: user.employeeId }] };
  const counts = await Promise.all(
    OWN_RECORDS.map(async ([label, model]) => [label, await model.countDocuments(mine)]),
  );
  return { counts: counts.filter(([, count]) => count > 0) };
}
