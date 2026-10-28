import { User } from '../models/user.model.js';
import { Kyc } from '../models/kyc.model.js';
import { DocumentType, EmployeeDocument } from '../models/document.model.js';
import { SalaryStructure } from '../models/salary.model.js';
import { computeCompleteness, profileChecklist } from '../lib/completeness.js';

// Loads everything an employee's file checklist needs (profile, KYC, required documents) and
// keeps the stored completeness up to date. Every writer calls refreshCompleteness().

async function related(userId) {
  const [kyc, requiredTypes, records, salary] = await Promise.all([
    Kyc.findOne({ userId }).lean(),
    DocumentType.find({ required: true, active: true }, '_id name').sort({ order: 1 }).lean(),
    EmployeeDocument.find({ userId }, 'typeId status').lean(),
    SalaryStructure.exists({ userId, status: 'approved' }),
  ]);
  return {
    kyc,
    documents: { requiredTypes, records },
    extras: { salaryApproved: Boolean(salary) },
  };
}

/** Every item of the file and whether it is done. */
export async function fileChecklist(user) {
  const { kyc, documents, extras } = await related(user._id);
  return profileChecklist(user, kyc, documents, extras);
}

/** Works out and saves how complete the employee's file is. */
export async function refreshCompleteness(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return;
  const { kyc, documents, extras } = await related(userId);
  await User.updateOne(
    { _id: userId },
    { completeness: computeCompleteness(user, kyc, documents, extras) },
  );
}

/** For everyone (a migration runs this when the checklist changes). */
export async function recomputeAllCompleteness() {
  const users = await User.find({}, '_id').lean();
  for (const user of users) await refreshCompleteness(user._id);
}
