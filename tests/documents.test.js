import { describe, expect, it, vi } from 'vitest';

// S3 is replaced by a fake: tests never upload anything.
vi.mock('@/server/infra/storage.js', () => ({
  isStorageConfigured: () => true,
  putFile: async (key) => key,
  signedUrl: async (key) => (key ? `https://signed.example/${key}` : null),
}));

const docs = await import('@/server/services/documents.service.js');
const { DocumentType, EmployeeDocument } = await import('@/server/models/document.model.js');
const { User } = await import('@/server/models/user.model.js');
const { runMigrations } = await import('@/server/migrations/index.js');
const { GET: listRoute } = await import('@/app/api/documents/route.js');
const { call, makeUser } = await import('./helpers.js');

const PDF = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 test').toString('base64')}`;

async function typeNamed(name) {
  return DocumentType.findOne({ name }).lean();
}

describe('document catalogue', () => {
  it('the migration fills the catalogue once, and required types join the checklist', async () => {
    const staff = await makeUser();
    await runMigrations();
    await runMigrations();
    // 25 from the first catalogue + "Previous salary slip" (migration 019, KYC form).
    expect(await DocumentType.countDocuments()).toBe(26);
    const user = await User.findById(staff._id).lean();
    expect(user.completeness.missing).toContain('Resume');
    expect(user.completeness.missing).toContain('NDA (signed)');
  });

  it('making a type required updates everyone’s file', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    const type = await docs.addDocumentType(hr, {
      name: 'Police verification',
      category: 'identity',
    });
    expect((await User.findById(staff._id).lean()).completeness.missing).not.toContain(
      'Police verification',
    );
    await docs.updateDocumentType(hr, type._id, { required: true });
    expect((await User.findById(staff._id).lean()).completeness.missing).toContain(
      'Police verification',
    );
  });
});

describe('employee documents', () => {
  it('keeps every version; a new version needs checking again', async () => {
    await docs.seedDocumentTypes();
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const ceo = await makeUser({ roleKey: 'ceo' });
    const staff = await makeUser();
    const resume = await typeNamed('Resume');
    await docs.uploadDocument(hr, staff._id, {
      typeId: String(resume._id),
      file: PDF,
      fileName: 'resume v1.pdf',
    });
    const record = await EmployeeDocument.findOne({ userId: staff._id }).lean();
    await docs.reviewDocument(ceo, record._id, { decision: 'verified' });
    await docs.uploadDocument(hr, staff._id, {
      typeId: String(resume._id),
      file: PDF,
      fileName: 'resume v2.pdf',
    });
    const after = await EmployeeDocument.findById(record._id).lean();
    expect(after.versions.map((version) => version.fileName)).toEqual([
      'resume-v1.pdf',
      'resume-v2.pdf',
    ]);
    expect(after.status).toBe('submitted');
  });

  it('the uploader cannot verify; a signed type needs the signed copy', async () => {
    await docs.seedDocumentTypes();
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const ceo = await makeUser({ roleKey: 'ceo' });
    const staff = await makeUser();
    const nda = await typeNamed('NDA (signed)');
    await docs.uploadDocument(hr, staff._id, {
      typeId: String(nda._id),
      file: PDF,
      fileName: 'nda.pdf',
    });
    const record = await EmployeeDocument.findOne({ userId: staff._id }).lean();
    expect(record.signature).toBe('pending');
    await expect(
      docs.reviewDocument(hr, record._id, { decision: 'verified' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      docs.reviewDocument(ceo, record._id, { decision: 'verified' }),
    ).rejects.toMatchObject({ status: 400 });
    await docs.uploadDocument(hr, staff._id, {
      typeId: String(nda._id),
      file: PDF,
      fileName: 'nda signed.pdf',
      signed: true,
    });
    await docs.reviewDocument(ceo, record._id, { decision: 'verified' });
    expect((await EmployeeDocument.findById(record._id).lean()).status).toBe('verified');
  });

  it('a type with expiry needs a date, and turns expired after it', async () => {
    await docs.seedDocumentTypes();
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    const certificate = await typeNamed('Professional certificate');
    await expect(
      docs.uploadDocument(hr, staff._id, { typeId: String(certificate._id), file: PDF }),
    ).rejects.toMatchObject({ status: 400 });
    await docs.uploadDocument(hr, staff._id, {
      typeId: String(certificate._id),
      file: PDF,
      expiresOn: '2026-12-31',
    });
    await docs.markExpiredDocuments(new Date('2027-01-02T10:00:00+05:30'));
    expect((await EmployeeDocument.findOne({ userId: staff._id }).lean()).status).toBe('expired');
  });

  it('employees see only their own documents; managers none', async () => {
    await docs.seedDocumentTypes();
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const manager = await makeUser({ roleKey: 'manager' });
    const staff = await makeUser({ managerId: manager._id });
    const other = await makeUser();
    const resume = await typeNamed('Resume');
    for (const person of [staff, other]) {
      await docs.uploadDocument(hr, person._id, { typeId: String(resume._id), file: PDF });
    }
    const own = await call(listRoute, { user: staff });
    expect(own.body.items.map((item) => item.user.employeeId)).toEqual([staff.employeeId]);
    expect((await call(listRoute, { user: manager })).status).toBe(403);
    const all = await call(listRoute, {
      user: hr,
      url: '/api/documents?q=' + encodeURIComponent(other.name),
    });
    expect(all.body.items).toHaveLength(1);
  });
});
