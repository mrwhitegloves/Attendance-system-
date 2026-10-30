import { describe, expect, it, vi } from 'vitest';

// S3 is replaced by a fake: tests never upload anything.
vi.mock('@/server/infra/storage.js', () => ({
  isStorageConfigured: () => true,
  putFile: async (key) => key,
  signedUrl: async (key) => (key ? `https://signed.example/${key}` : null),
  getFileBytes: async () => null,
}));

const { GET: listRoute, POST: makeRoute } = await import('@/app/api/kyc-links/route.js');
const { POST: closeRoute, GET: reviewRoute } = await import('@/app/api/kyc-links/[id]/route.js');
const { POST: approveRoute } = await import('@/app/api/kyc-links/[id]/approve/route.js');
const { POST: rejectRoute } = await import('@/app/api/kyc-links/[id]/reject/route.js');
const { GET: formRoute, POST: submitRoute } = await import('@/app/api/public/kyc/[token]/route.js');
const { POST: fileRoute } = await import('@/app/api/public/kyc/[token]/files/route.js');
const { PUT: draftRoute } = await import('@/app/api/public/kyc/[token]/draft/route.js');
const { User } = await import('@/server/models/user.model.js');
const { Kyc } = await import('@/server/models/kyc.model.js');
const { KycLink } = await import('@/server/models/kycLink.model.js');
const { DocumentType, EmployeeDocument } = await import('@/server/models/document.model.js');
const { runMigrations } = await import('@/server/migrations/index.js');
const { call, makeUser, PHOTO } = await import('./helpers.js');

const PDF = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 test').toString('base64')}`;
const tokenOf = (link) => link.path.split('/').pop();

const FRESHER = {
  phone: '9000011111',
  dateOfBirth: '1998-05-04',
  gender: 'female',
  bloodGroup: 'B+',
  personalEmail: 'riya@example.com',
  currentAddress: 'Flat 2, Sector 18, Noida',
  permanentAddress: 'Main Road, Ranchi',
  emergencyContact: { name: 'Mohan', relation: 'Father', phone: '9000022222' },
  pan: { number: 'abcde1234f', nameOnPan: 'Riya Singh' },
  aadhaarLast4: '4321',
  bank: {
    accountHolderName: 'Riya Singh',
    bankName: 'SBI',
    ifsc: 'sbin0001234',
    accountNumber: '123456789012',
  },
  experienceType: 'fresher',
};

const EXPERIENCED = {
  ...FRESHER,
  experienceType: 'experienced',
  previousCompany: {
    name: 'Acme Services',
    hrName: 'Neha',
    hrPhone: '9000044444',
    hrEmail: 'hr@acme.example',
    reportingManager: 'Raj',
  },
  lastDrawnSalary: '25000',
};

const BASE_FILES = [
  ['photo', PHOTO],
  ['panProof', PDF],
  ['aadhaarProof', PDF],
  ['bankProof', PDF],
  ['signedOfferLetter', PDF],
];
const PREVIOUS_FILES = ['salarySlip1', 'salarySlip2', 'salarySlip3', 'experienceDoc'].map(
  (field) => [field, PDF],
);

async function upload(token, files) {
  for (const [field, file] of files) {
    const result = await call(fileRoute, {
      method: 'POST',
      params: { token },
      body: { field, file, fileName: `${field}.pdf` },
    });
    expect(result.status).toBe(200);
  }
}

async function setup() {
  await runMigrations(); // document types, incl. "Previous salary slip"
  const hr = await makeUser({ roleKey: 'hr_admin' });
  const employee = await makeUser({ name: 'Riya Singh' });
  const made = await call(makeRoute, { method: 'POST', user: hr, body: { userId: employee._id } });
  return { hr, employee, link: made.body.link, token: tokenOf(made.body.link) };
}

const submit = (token, body) => call(submitRoute, { method: 'POST', params: { token }, body });

describe('employee KYC links', () => {
  it('a sent form waits for HR; approving writes the file, KYC and documents', async () => {
    const { hr, employee, link, token } = await setup();
    const form = await call(formRoute, { params: { token } });
    expect(form.body).toMatchObject({ state: 'open', name: 'Riya Singh' });
    const resume = form.body.documents.find((doc) => doc.name === 'Resume');

    // Files missing: refused.
    expect((await submit(token, FRESHER)).status).toBe(400);

    await upload(token, [...BASE_FILES, [resume.field, PDF]]);
    expect((await submit(token, FRESHER)).status).toBe(200);
    expect((await call(formRoute, { params: { token } })).body.state).toBe('submitted');
    // Nothing in the file before the review.
    expect((await User.findById(employee._id).lean()).dateOfBirth).toBe('');
    expect(await Kyc.countDocuments()).toBe(0);
    expect((await submit(token, FRESHER)).status).toBe(409);

    const review = await call(reviewRoute, { user: hr, params: { id: link._id } });
    expect(review.body.input.pan.number).toBe('ABCDE1234F'); // HR Admin may see full numbers
    expect(review.body.files.map((file) => file.field)).toContain('signedOfferLetter');

    const approved = await call(approveRoute, {
      method: 'POST',
      user: hr,
      params: { id: link._id },
    });
    expect(approved.status).toBe(200);
    const user = await User.findById(employee._id).lean();
    expect(user).toMatchObject({
      phone: '9000011111',
      dateOfBirth: '1998-05-04',
      permanentAddress: 'Main Road, Ranchi',
      previousEmployment: { experienceType: 'fresher', companyName: '' },
    });
    expect(user.photoKey).toMatch(/^kyc-form\//);
    const kyc = await Kyc.findOne({ userId: employee._id }).lean();
    expect(kyc.pan).toMatchObject({ last4: '234F', status: 'verified' });
    expect(String(kyc.pan.reviewedBy)).toBe(String(hr._id));
    expect(kyc.bank).toMatchObject({ ifsc: 'SBIN0001234', status: 'verified' });
    const offerType = await DocumentType.findOne({ name: 'Offer letter (signed)' }).lean();
    const offer = await EmployeeDocument.findOne({
      userId: employee._id,
      typeId: offerType._id,
    }).lean();
    expect(offer).toMatchObject({ status: 'verified', signature: 'signed' });
    expect(await EmployeeDocument.countDocuments({ userId: employee._id })).toBe(2);
    // The sealed form is gone; a copy without full numbers is kept.
    const stored = await KycLink.findById(link._id).lean();
    expect(stored).toMatchObject({ status: 'approved', submissionSealed: null });
    expect(JSON.stringify(stored.submitted)).not.toContain('123456789012');
    expect((await call(formRoute, { params: { token } })).body.state).toBe('approved');
  });

  it('an experienced person must give the previous company; it is saved with the slips', async () => {
    const { hr, employee, link, token } = await setup();
    await upload(token, BASE_FILES);
    const noCompany = await submit(token, { ...FRESHER, experienceType: 'experienced' });
    expect(noCompany.status).toBe(400);
    const noSlips = await submit(token, EXPERIENCED);
    expect(noSlips.status).toBe(400);
    expect(noSlips.body.error).toMatch(/salary slip/);

    await upload(token, PREVIOUS_FILES);
    expect((await submit(token, EXPERIENCED)).status).toBe(200);
    await call(approveRoute, { method: 'POST', user: hr, params: { id: link._id } });
    const user = await User.findById(employee._id).lean();
    expect(user.previousEmployment).toMatchObject({
      experienceType: 'experienced',
      companyName: 'Acme Services',
      hrEmail: 'hr@acme.example',
      lastDrawnMonthlyPaise: 2_500_000,
    });
    const slipType = await DocumentType.findOne({ name: 'Previous salary slip' }).lean();
    const slips = await EmployeeDocument.findOne({
      userId: employee._id,
      typeId: slipType._id,
    }).lean();
    expect(slips.versions).toHaveLength(3);
  });

  it('sending back opens the link again with the answers filled in', async () => {
    const { hr, link, token } = await setup();
    await upload(token, BASE_FILES);
    await submit(token, FRESHER);
    const tooShort = await call(rejectRoute, {
      method: 'POST',
      user: hr,
      params: { id: link._id },
      body: { reason: '' },
    });
    expect(tooShort.status).toBe(400);
    const sentBack = await call(rejectRoute, {
      method: 'POST',
      user: hr,
      params: { id: link._id },
      body: { reason: 'The PAN photo is blurred.' },
    });
    expect(sentBack.status).toBe(200);
    const form = await call(formRoute, { params: { token } });
    expect(form.body).toMatchObject({ state: 'open', rejectReason: 'The PAN photo is blurred.' });
    expect(form.body.draft.pan.number).toBe('ABCDE1234F');
    expect(form.body.uploads.panProof).toBe('panProof.pdf');
    expect((await submit(token, FRESHER)).status).toBe(200);
  });

  it('the draft is saved while typing; a late, older save never wins', async () => {
    const { token } = await setup();
    const save = (rev, draft) =>
      call(draftRoute, { method: 'PUT', params: { token }, body: { rev, draft } });
    expect((await save(200, { phone: '9000011111', sameAddress: true })).body.saved).toBe(true);
    expect((await save(100, { phone: 'old' })).body.saved).toBe(false);
    const form = await call(formRoute, { params: { token } });
    expect(form.body.draft).toEqual({ phone: '9000011111', sameAddress: true });
    expect(form.body.draftRev).toBe(200);
    // Stored sealed, never as plain text.
    const stored = await KycLink.findOne({}).lean();
    expect(stored.draftSealed).not.toContain('9000011111');
  });

  it('only people who check KYC may review', async () => {
    const { employee, link, token } = await setup();
    await upload(token, BASE_FILES);
    await submit(token, FRESHER);
    expect((await call(reviewRoute, { user: employee, params: { id: link._id } })).status).toBe(
      403,
    );
    expect(
      (await call(approveRoute, { method: 'POST', user: employee, params: { id: link._id } }))
        .status,
    ).toBe(403);
  });

  it('a new person becomes an employee who is not active yet', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const made = await call(makeRoute, {
      method: 'POST',
      user: hr,
      body: { name: 'New Joiner', phone: '9000033333' },
    });
    expect(made.status).toBe(200);
    const user = await User.findById(made.body.link.userId).lean();
    expect(user).toMatchObject({ name: 'New Joiner', status: 'inactive' });
    const again = await call(makeRoute, {
      method: 'POST',
      user: hr,
      body: { name: 'New Joiner', phone: '+91 90000 33333' },
    });
    expect(again.status).toBe(409);
  });

  it('a closed or replaced link stops working; only HR makes links', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const employee = await makeUser();
    const make = () =>
      call(makeRoute, { method: 'POST', user: hr, body: { userId: employee._id } });
    const first = await make();
    const second = await make();
    const open = (link) => call(formRoute, { params: { token: tokenOf(link) } });
    expect((await open(first.body.link)).status).toBe(410);
    await call(closeRoute, { method: 'POST', user: hr, params: { id: second.body.link._id } });
    expect((await open(second.body.link)).status).toBe(410);
    expect((await call(formRoute, { params: { token: 'not-a-real-token' } })).status).toBe(404);
    const list = await call(listRoute, { user: hr });
    expect(list.body.items.map((item) => item.state)).toEqual(['closed', 'closed']);
    expect((await call(listRoute, { user: employee })).status).toBe(403);
  });
});
