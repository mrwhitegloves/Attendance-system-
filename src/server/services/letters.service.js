import { LETTER_KINDS, Letter, LetterTemplate } from '../models/letter.model.js';
import { DocumentType } from '../models/document.model.js';
import { User } from '../models/user.model.js';
import { can, canSeeEmployee, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import { indiaDay } from '../lib/dates.js';
import {
  DEFAULT_TEMPLATES,
  PLACEHOLDERS,
  fillTemplate,
  placeholderValues,
} from '../lib/letterText.js';
import { recordAudit } from './audit.service.js';
import { getCompany } from './settings.service.js';
import { uploadDocument } from './documents.service.js';
import { notifyUsers } from './push.service.js';

// Letters (CEO spec section 4, offer letter lifecycle). Rules:
// - a letter starts as a draft from a template; only a draft can change;
// - issuing fills every placeholder (refused while any is empty) and freezes the text;
// - a new version of the same kind supersedes the older letters (they are kept);
// - the employee accepts or declines in the app, or HR records it (a signed copy counts as acceptance);
// - a signed copy is stored once, as the matching employee document.

const SIGNED_COPY_TYPE = {
  offer: 'Offer letter (signed)',
  appointment: 'Appointment letter (signed)',
  salary_revision: 'Salary revision letter',
  relieving: 'Relieving letter',
  experience: 'Experience letter',
};

// ---- Templates (Settings → Letter templates) ----

/** Templates in the order of an employee's life: offer, appointment, … */
export async function listTemplates({ includeInactive = false } = {}) {
  const order = Object.keys(LETTER_KINDS);
  const templates = await LetterTemplate.find(includeInactive ? {} : { active: true }).lean();
  return templates.sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name),
  );
}

export async function addTemplate(actor, input, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const template = await LetterTemplate.create(input);
  await recordAudit(actor, {
    action: 'letter_template.added',
    entity: 'letter_template',
    entityId: template._id,
    summary: template.name,
    ip,
  });
  return template.toObject();
}

export async function updateTemplate(actor, id, input, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const template = await LetterTemplate.findByIdAndUpdate(id, input, { returnDocument: 'after' })
    .lean()
    .catch(() => null);
  if (!template) throw notFound('Template');
  await recordAudit(actor, {
    action: 'letter_template.updated',
    entity: 'letter_template',
    entityId: id,
    summary: template.name,
    ip,
  });
  return template;
}

export async function seedLetterTemplates() {
  if (await LetterTemplate.exists({})) return;
  await LetterTemplate.insertMany(DEFAULT_TEMPLATES);
}

// ---- Letters ----

async function loadEmployee(actor, userId, permission) {
  const user = await User.findById(userId)
    .lean()
    .catch(() => null);
  if (!user || !(await canSeeEmployee(actor, permission, user.employeeId)))
    throw notFound('Employee');
  return user;
}

async function loadLetter(actor, id) {
  const letter = await Letter.findById(id)
    .lean()
    .catch(() => null);
  if (!letter || !(await canSeeEmployee(actor, 'letters.view', letter.employeeId)))
    throw notFound('Letter');
  // A draft is HR's work in progress: only people who prepare letters see it.
  if (letter.status === 'draft' && !can(actor, 'letters.manage')) throw notFound('Letter');
  return letter;
}

/** The letter text as it is now: frozen once issued, a preview with today's date while a draft. */
async function render(letter, employee) {
  if (letter.status !== 'draft') return { text: letter.body, missing: [] };
  const company = await getCompany();
  return fillTemplate(
    letter.body,
    placeholderValues({ employee, letter, company, issueDay: indiaDay() }),
  );
}

export async function listLettersFor(actor, userId) {
  const user = await loadEmployee(actor, userId, 'letters.view');
  const filter = { userId: user._id };
  if (!can(actor, 'letters.manage')) filter.status = { $ne: 'draft' };
  const letters = await Letter.find(filter, '-body').sort({ createdAt: -1 }).lean();
  return {
    user: { _id: user._id, name: user.name, employeeId: user.employeeId },
    letters,
    canManage: Boolean(can(actor, 'letters.manage')),
  };
}

export async function getLetter(actor, id) {
  const letter = await loadLetter(actor, id);
  const employee = await User.findById(letter.userId).lean();
  const rendered = await render(letter, employee);
  const isOwner = String(letter.userId) === String(actor._id);
  const manage = Boolean(can(actor, 'letters.manage'));
  return {
    letter,
    rendered,
    company: await getCompany(),
    employee: {
      _id: employee._id,
      name: employee.name,
      employeeId: employee.employeeId,
      designation: employee.designation,
    },
    permissions: {
      manage,
      edit: manage && letter.status === 'draft',
      issue: manage && letter.status === 'draft',
      respond: letter.status === 'issued' && (isOwner || manage),
      reissue: manage && ['issued', 'accepted', 'declined'].includes(letter.status),
      signedCopy:
        manage &&
        ['issued', 'accepted'].includes(letter.status) &&
        Boolean(SIGNED_COPY_TYPE[letter.kind]),
    },
  };
}

export async function createLetter(actor, userId, { templateId, fields }, { ip } = {}) {
  requirePermission(actor, 'letters.manage');
  const user = await loadEmployee(actor, userId, 'letters.view');
  const template = await LetterTemplate.findOne({ _id: templateId, active: true })
    .lean()
    .catch(() => null);
  if (!template) throw createAppError(400, 'Choose a letter template.');
  const last = await Letter.findOne({ userId: user._id, kind: template.kind }, 'version')
    .sort({ version: -1 })
    .lean();
  const letter = await Letter.create({
    userId: user._id,
    employeeId: user.employeeId,
    templateId: template._id,
    kind: template.kind,
    version: (last?.version ?? 0) + 1,
    subject: template.subject,
    body: template.body,
    fields,
    createdBy: actor._id,
  });
  await recordAudit(actor, {
    action: 'letter.drafted',
    entity: 'letter',
    entityId: letter._id,
    summary: `${LETTER_KINDS[template.kind]} v${letter.version} drafted for ${user.name} (${user.employeeId})`,
    ip,
  });
  return letter.toObject();
}

export async function updateDraft(actor, id, input, { ip } = {}) {
  requirePermission(actor, 'letters.manage');
  const letter = await loadLetter(actor, id);
  if (letter.status !== 'draft')
    throw createAppError(409, 'Only a draft can be changed. Make a new version instead.');
  const set = {};
  if (input.subject !== undefined) set.subject = input.subject;
  if (input.body !== undefined) set.body = input.body;
  for (const [key, value] of Object.entries(input.fields ?? {})) set[`fields.${key}`] = value;
  await Letter.updateOne({ _id: id }, { $set: set });
  await recordAudit(actor, {
    action: 'letter.edited',
    entity: 'letter',
    entityId: id,
    summary: `${LETTER_KINDS[letter.kind]} v${letter.version} draft edited`,
    ip,
  });
  return getLetter(actor, id);
}

/** Freezes the text and sends it. Refused while a placeholder has no value. */
export async function issueLetter(actor, id, { ip } = {}) {
  requirePermission(actor, 'letters.manage');
  const letter = await loadLetter(actor, id);
  if (letter.status !== 'draft') throw createAppError(409, 'This letter is already issued.');
  const employee = await User.findById(letter.userId).lean();
  const { text, missing } = await render(letter, employee);
  if (missing.length) {
    throw createAppError(
      400,
      `Fill these first: ${missing.map((key) => PLACEHOLDERS[key] ?? key).join(', ')}.`,
      'missing_values',
    );
  }
  const issued = await Letter.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { status: 'issued', body: text, issuedBy: actor._id, issuedAt: new Date() },
    { returnDocument: 'after' },
  ).lean();
  if (!issued) throw createAppError(409, 'This letter was just issued by someone else.');
  await Letter.updateMany(
    {
      userId: letter.userId,
      kind: letter.kind,
      _id: { $ne: letter._id },
      status: { $in: ['issued', 'accepted', 'declined'] },
    },
    { status: 'superseded', supersededBy: letter._id },
  );
  await recordAudit(actor, {
    action: 'letter.issued',
    entity: 'letter',
    entityId: id,
    summary: `${LETTER_KINDS[letter.kind]} v${letter.version} issued to ${employee.name} (${employee.employeeId})`,
    ip,
  });
  notifyUsers([employee._id], {
    title: `${LETTER_KINDS[letter.kind]} for you`,
    body: 'Open it to read and accept.',
    icon: '/logo.png',
    data: { url: `/letters/${id}` },
  }).catch(() => {});
  return getLetter(actor, id);
}

/** Accepted or declined: by the employee in the app, or recorded by HR. */
export async function respondToLetter(actor, id, { decision, note }, { ip } = {}) {
  const letter = await loadLetter(actor, id);
  const isOwner = String(letter.userId) === String(actor._id);
  if (!isOwner) requirePermission(actor, 'letters.manage');
  if (letter.status !== 'issued') throw createAppError(409, `This letter is ${letter.status}.`);
  await Letter.updateOne(
    { _id: id, status: 'issued' },
    {
      status: decision,
      respondedAt: new Date(),
      respondedVia: isOwner ? 'employee' : 'hr',
      responseNote: note,
    },
  );
  await recordAudit(actor, {
    action: `letter.${decision}`,
    entity: 'letter',
    entityId: id,
    summary: `${LETTER_KINDS[letter.kind]} v${letter.version} ${decision}${isOwner ? ' by the employee' : ' (recorded by HR)'}${note ? `: ${note}` : ''}`,
    ip,
  });
  return getLetter(actor, id);
}

/** A signed copy goes into the employee's documents (stored once) and counts as acceptance. */
export async function addSignedCopy(actor, id, { file, fileName }, { ip } = {}) {
  requirePermission(actor, 'letters.manage');
  const letter = await loadLetter(actor, id);
  if (!['issued', 'accepted'].includes(letter.status))
    throw createAppError(409, `This letter is ${letter.status}.`);
  const typeName = SIGNED_COPY_TYPE[letter.kind];
  const type = typeName
    ? await DocumentType.findOne({ name: typeName, active: true }).lean()
    : null;
  if (!type)
    throw createAppError(
      400,
      `Add the document type "${typeName ?? LETTER_KINDS[letter.kind]}" in Settings first.`,
    );
  await uploadDocument(
    actor,
    letter.userId,
    {
      typeId: String(type._id),
      file,
      fileName,
      signed: true,
      note: `Signed ${LETTER_KINDS[letter.kind].toLowerCase()} v${letter.version}`,
      expiresOn: '',
    },
    { ip },
  );
  if (letter.status === 'issued') {
    await Letter.updateOne(
      { _id: id },
      {
        status: 'accepted',
        respondedAt: new Date(),
        respondedVia: 'hr',
        responseNote: 'Signed copy received',
      },
    );
    await recordAudit(actor, {
      action: 'letter.accepted',
      entity: 'letter',
      entityId: id,
      summary: `${LETTER_KINDS[letter.kind]} v${letter.version} accepted (signed copy received)`,
      ip,
    });
  }
  return getLetter(actor, id);
}

/** A new draft of the same kind, with the same values, from the current template text. */
export async function reissueLetter(actor, id, { ip } = {}) {
  requirePermission(actor, 'letters.manage');
  const letter = await loadLetter(actor, id);
  const template = letter.templateId
    ? await LetterTemplate.findById(letter.templateId).lean()
    : null;
  if (!template?.active)
    throw createAppError(400, 'The template of this letter is switched off. Start a new letter.');
  return createLetter(
    actor,
    letter.userId,
    { templateId: String(template._id), fields: letter.fields },
    { ip },
  );
}
