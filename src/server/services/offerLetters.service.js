import { Candidate } from '../models/candidate.model.js';
import { Letter } from '../models/letter.model.js';
import { User } from '../models/user.model.js';
import { requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { containsRegex } from '../lib/pagination.js';
import { isFullPhone, phoneKey } from '../lib/phone.js';
import { recordAudit } from './audit.service.js';
import { assertNoOfferYet, createOfferLetter } from './letters.service.js';

// The Offer letters screen (founder, 2026-10-29). Rules:
// - one offer letter per person: a candidate is found by the last 10 digits of their phone, so
//   the same phone never gets a second letter (a new version of the same letter is allowed);
// - a phone that belongs to an employee gets its letter from the employee's Letters tab;
// - when the candidate becomes an employee (Add employee, or the employee's Letters tab) the
//   letter is linked: all their letters move to the employee and the candidate is "joined";
// - deleting an offer letter removes all its versions; the candidate stays (Hiring keeps them).

const LIVE = { kind: 'offer', status: { $ne: 'superseded' } };

/** The employee with this phone (last 10 digits), or null. Few employees: compared here. */
async function employeeWithPhone(key) {
  const users = await User.find({ phone: { $nin: ['', null] } }, 'name employeeId phone').lean();
  return users.find((user) => phoneKey(user.phone) === key) ?? null;
}

/** Offer letters in use (newest version of each person), with the person they are for. */
export async function listOfferLetters(actor, { q, status, unlinked, page = 1 } = {}) {
  requirePermission(actor, 'letters.manage');
  const filter = { ...LIVE };
  if (status) filter.status = status;
  if (unlinked) Object.assign(filter, { userId: null, candidateId: { $ne: null } });
  if (q) {
    const pattern = containsRegex(q);
    const digits = phoneKey(q);
    const [candidates, users] = await Promise.all([
      Candidate.find(
        {
          $or: [
            { name: pattern },
            ...(digits.length >= 4 ? [{ phoneKey: new RegExp(digits) }] : []),
          ],
        },
        '_id',
      ).lean(),
      User.find(
        { $or: [{ name: pattern }, { employeeId: pattern }, { phone: pattern }] },
        '_id',
      ).lean(),
    ]);
    filter.$or = [
      { candidateId: { $in: candidates.map((row) => row._id) } },
      { userId: { $in: users.map((row) => row._id) } },
    ];
  }
  const pageSize = 25;
  const [letters, total] = await Promise.all([
    Letter.find(filter, '-body -content')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Letter.countDocuments(filter),
  ]);
  const [candidates, users] = await Promise.all([
    Candidate.find(
      { _id: { $in: letters.map((row) => row.candidateId).filter(Boolean) } },
      'name phone designation department branch brandKey status',
    ).lean(),
    User.find(
      { _id: { $in: letters.map((row) => row.userId).filter(Boolean) } },
      'name phone employeeId',
    ).lean(),
  ]);
  const candidateOf = new Map(candidates.map((row) => [String(row._id), row]));
  const userOf = new Map(users.map((row) => [String(row._id), row]));
  return {
    items: letters.map((letter) => {
      const user = letter.userId ? userOf.get(String(letter.userId)) : null;
      const candidate = letter.candidateId ? candidateOf.get(String(letter.candidateId)) : null;
      return {
        _id: letter._id,
        status: letter.status,
        version: letter.version,
        brandKey: letter.brandKey,
        updatedAt: letter.updatedAt,
        issuedAt: letter.issuedAt,
        person: {
          name: user?.name ?? candidate?.name ?? '—',
          phone: user?.phone || candidate?.phone || '',
          employeeId: user?.employeeId ?? '',
          userId: user?._id ?? null,
          candidateId: candidate?._id ?? null,
        },
        // For Add employee: the planned job, to fill the form.
        plan: candidate
          ? {
              designation: candidate.designation,
              department: candidate.department,
              branch: candidate.branch,
              brandKey: candidate.brandKey,
            }
          : null,
      };
    }),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * A new offer letter for a person who is not an employee yet: name and phone first. The
 * candidate with the same phone is reused; a phone with an offer letter in use is refused.
 */
export async function startOfferLetter(actor, { name, phone, brandKey }, { ip } = {}) {
  requirePermission(actor, 'letters.manage');
  requirePermission(actor, 'recruitment.manage');
  const key = phoneKey(phone);
  if (!isFullPhone(phone)) throw createAppError(400, 'phone: enter a 10-digit mobile number');
  const employee = await employeeWithPhone(key);
  if (employee) {
    throw createAppError(
      409,
      `${employee.name} (${employee.employeeId}) is an employee with this phone. Make the offer letter from their Letters tab.`,
    );
  }
  let candidate = await Candidate.findOne({ phoneKey: key }).sort({ createdAt: -1 }).lean();
  if (candidate?.status === 'joined') {
    throw createAppError(409, `${candidate.name} with this phone has already joined.`);
  }
  if (candidate) {
    await assertNoOfferYet({ candidateId: candidate._id });
    await Candidate.updateOne(
      { _id: candidate._id },
      { name, brandKey, status: 'open', dropReason: '', dropNote: '' },
    );
  } else {
    candidate = await Candidate.create({
      name,
      phone,
      phoneKey: key,
      brandKey,
      source: 'Offer letters screen',
      createdBy: actor._id,
    });
    await recordAudit(actor, {
      action: 'candidate.added',
      entity: 'candidate',
      entityId: candidate._id,
      summary: `Candidate ${name} (offer letters screen)`,
      ip,
    });
  }
  return createOfferLetter(actor, { candidateId: candidate._id }, { ip });
}

/** Deletes an offer letter with all its versions (the founder's rule; audited). */
export async function deleteOfferLetter(actor, id, { ip } = {}) {
  requirePermission(actor, 'letters.manage');
  const letter = await Letter.findById(id)
    .lean()
    .catch(() => null);
  if (!letter || letter.kind !== 'offer') throw notFound('Offer letter');
  const owner = letter.userId ? { userId: letter.userId } : { candidateId: letter.candidateId };
  const person = letter.userId
    ? await User.findById(letter.userId, 'name employeeId').lean()
    : await Candidate.findById(letter.candidateId, 'name').lean();
  const { deletedCount } = await Letter.deleteMany({ ...owner, kind: 'offer' });
  await recordAudit(actor, {
    action: 'letter.deleted',
    entity: 'letter',
    entityId: id,
    summary: `Offer letter of ${person?.name ?? 'a person'} deleted (${deletedCount} version${deletedCount === 1 ? '' : 's'})`,
    ip,
  });
  return { ok: true, deleted: deletedCount };
}

/** The candidate's offer letter that may still be linked to an employee (else an error). */
export async function linkableOffer(letterId) {
  const letter = await Letter.findOne({ _id: letterId, ...LIVE })
    .lean()
    .catch(() => null);
  if (!letter) throw createAppError(400, 'offerLetterId: choose an offer letter from the list');
  if (letter.userId || !letter.candidateId) {
    throw createAppError(409, 'This offer letter already belongs to an employee.');
  }
  return letter;
}

/**
 * Links a candidate's offer letter to an employee: all the candidate's letters move to the
 * employee and the candidate is marked joined. The employee may not have an offer letter yet.
 */
export async function linkOfferToEmployee(actor, letterId, userId, { ip } = {}) {
  requirePermission(actor, 'letters.manage');
  requirePermission(actor, 'users.manage');
  const letter = await linkableOffer(letterId);
  const user = await User.findById(userId, 'name employeeId')
    .lean()
    .catch(() => null);
  if (!user) throw notFound('Employee');
  await assertNoOfferYet({ userId: user._id });
  const claimed = await Candidate.findOneAndUpdate(
    { _id: letter.candidateId, userId: null },
    { status: 'joined', joinedAt: new Date(), userId: user._id },
  ).lean();
  if (!claimed) throw createAppError(409, 'This offer letter was just linked by someone else.');
  await Letter.updateMany(
    { candidateId: letter.candidateId },
    { userId: user._id, employeeId: user.employeeId },
  );
  await recordAudit(actor, {
    action: 'letter.linked',
    entity: 'letter',
    entityId: letter._id,
    summary: `Offer letter of ${claimed.name} linked to ${user.name} (${user.employeeId})`,
    ip,
  });
  return { ok: true, letterId: String(letter._id) };
}
