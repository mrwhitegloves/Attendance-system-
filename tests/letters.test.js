import { describe, expect, it, vi } from 'vitest';

// S3 is replaced by a fake: tests never upload anything.
vi.mock('@/server/infra/storage.js', () => ({
  isStorageConfigured: () => true,
  putFile: async (key) => key,
  signedUrl: async (key) => (key ? `https://signed.example/${key}` : null),
}));

const letters = await import('@/server/services/letters.service.js');
const { seedDocumentTypes } = await import('@/server/services/documents.service.js');
const { updateCompany } = await import('@/server/services/settings.service.js');
const { Letter, LetterTemplate } = await import('@/server/models/letter.model.js');
const { EmployeeDocument } = await import('@/server/models/document.model.js');
const { fillTemplate, rupees } = await import('@/server/lib/letterText.js');
const { POST: actionRoute } = await import('@/app/api/letters/[id]/[action]/route.js');
const { POST: createRoute } = await import('@/app/api/users/[id]/letters/route.js');
const { call, makeUser } = await import('./helpers.js');

const PDF = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 test').toString('base64')}`;

async function setup() {
  await letters.seedLetterTemplates();
  await seedDocumentTypes();
  const hr = await makeUser({ roleKey: 'hr_admin' });
  await updateCompany(hr, {
    name: 'Mr. White Gloves',
    address: 'Noida',
    signatoryName: 'Asha Rao',
    signatoryTitle: 'CEO',
  });
  const staff = await makeUser({
    name: 'Ravi Kumar',
    designation: 'Technician',
    department: 'Operations',
    branch: 'Noida',
    joiningDate: '2026-11-01',
  });
  const offer = await LetterTemplate.findOne({ kind: 'offer' }).lean();
  return { hr, staff, offer };
}

describe('letter text', () => {
  it('fills placeholders and lists the empty ones', () => {
    const result = fillTemplate('Dear {{name}}, CTC {{ctcAnnual}} from {{unknownThing}}.', {
      name: 'Ravi',
      ctcAnnual: '',
    });
    expect(result.text).toBe('Dear Ravi, CTC [Annual CTC (₹)] from [unknownThing].');
    expect(result.missing).toEqual(['ctcAnnual', 'unknownThing']);
    expect(rupees(54000000)).toBe('₹5,40,000');
  });
});

describe('offer letter lifecycle', () => {
  it('refuses to issue while a value is missing, then freezes the text', async () => {
    const { hr, staff, offer } = await setup();
    const draft = await letters.createLetter(hr, staff._id, {
      templateId: String(offer._id),
      fields: {},
    });
    // The employee does not see a draft.
    await expect(letters.getLetter(staff, draft._id)).rejects.toMatchObject({ status: 404 });
    expect((await letters.listLettersFor(staff, staff._id)).letters).toHaveLength(0);
    await expect(letters.issueLetter(hr, draft._id)).rejects.toMatchObject({
      code: 'missing_values',
    });
    await letters.updateDraft(hr, draft._id, {
      fields: { ctcAnnualPaise: 54000000, probationMonths: 6, acceptBy: '2026-10-31' },
    });
    const issued = await letters.issueLetter(hr, draft._id);
    expect(issued.letter.status).toBe('issued');
    expect(issued.letter.body).toContain('₹5,40,000');
    expect(issued.letter.body).toContain('Ravi Kumar');
    expect(issued.letter.body).not.toContain('{{');
    // Changing the template later never changes an issued letter.
    await LetterTemplate.updateOne({ _id: offer._id }, { body: 'Changed text {{name}}' });
    expect((await letters.getLetter(hr, draft._id)).rendered.text).toContain('₹5,40,000');
    await expect(letters.updateDraft(hr, draft._id, { subject: 'x' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('the employee accepts their own letter; nobody else’s', async () => {
    const { hr, staff, offer } = await setup();
    const other = await makeUser();
    const draft = await letters.createLetter(hr, staff._id, {
      templateId: String(offer._id),
      fields: { ctcAnnualPaise: 30000000, probationMonths: 3, acceptBy: '2026-10-31' },
    });
    await letters.issueLetter(hr, draft._id);
    const denied = await call(actionRoute, {
      method: 'POST',
      user: other,
      params: { id: String(draft._id), action: 'respond' },
      body: { decision: 'accepted' },
    });
    expect(denied.status).toBe(404);
    const accepted = await call(actionRoute, {
      method: 'POST',
      user: staff,
      params: { id: String(draft._id), action: 'respond' },
      body: { decision: 'accepted' },
    });
    expect(accepted.body.letter).toMatchObject({ status: 'accepted', respondedVia: 'employee' });
  });

  it('a new version supersedes the old one, which is kept', async () => {
    const { hr, staff, offer } = await setup();
    const fields = { ctcAnnualPaise: 30000000, probationMonths: 3, acceptBy: '2026-10-31' };
    const first = await letters.createLetter(hr, staff._id, {
      templateId: String(offer._id),
      fields,
    });
    await letters.issueLetter(hr, first._id);
    const second = await letters.reissueLetter(hr, first._id);
    expect(second.version).toBe(2);
    await letters.issueLetter(hr, second._id);
    expect((await Letter.findById(first._id).lean()).status).toBe('superseded');
    expect(await Letter.countDocuments({ userId: staff._id })).toBe(2);
  });

  it('a signed copy is stored once as the employee document and counts as acceptance', async () => {
    const { hr, staff, offer } = await setup();
    const draft = await letters.createLetter(hr, staff._id, {
      templateId: String(offer._id),
      fields: { ctcAnnualPaise: 30000000, probationMonths: 3, acceptBy: '2026-10-31' },
    });
    await letters.issueLetter(hr, draft._id);
    const result = await letters.addSignedCopy(hr, draft._id, {
      file: PDF,
      fileName: 'signed offer.pdf',
    });
    expect(result.letter.status).toBe('accepted');
    const doc = await EmployeeDocument.findOne({ userId: staff._id }).lean();
    expect(doc).toMatchObject({ signature: 'signed', status: 'submitted' });
  });

  it('only HR and the CEO prepare letters', async () => {
    const { staff, offer } = await setup();
    const finance = await makeUser({ roleKey: 'finance' });
    const result = await call(createRoute, {
      method: 'POST',
      user: finance,
      params: { id: String(staff._id) },
      body: { templateId: String(offer._id) },
    });
    expect(result.status).toBe(403);
  });
});
