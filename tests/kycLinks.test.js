import { describe, expect, it, vi } from 'vitest';

// S3 is replaced by a fake: tests never upload anything.
vi.mock('@/server/infra/storage.js', () => ({
  isStorageConfigured: () => true,
  putFile: async (key) => key,
  signedUrl: async (key) => (key ? `https://signed.example/${key}` : null),
  getFileBytes: async () => null,
}));

const { GET: listRoute, POST: makeRoute } = await import('@/app/api/kyc-links/route.js');
const { DELETE: closeRoute } = await import('@/app/api/kyc-links/[id]/route.js');
const { GET: formRoute, POST: submitRoute } = await import('@/app/api/public/kyc/[token]/route.js');
const { POST: fileRoute } = await import('@/app/api/public/kyc/[token]/files/route.js');
const { User } = await import('@/server/models/user.model.js');
const { Kyc } = await import('@/server/models/kyc.model.js');
const { EmployeeDocument } = await import('@/server/models/document.model.js');
const { seedDocumentTypes } = await import('@/server/services/documents.service.js');
const { call, makeUser, PHOTO } = await import('./helpers.js');

const PDF = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 test').toString('base64')}`;
const tokenOf = (link) => link.path.split('/').pop();

const FORM = {
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
};

async function uploadAll(token, extra = []) {
  for (const [field, file] of [
    ['photo', PHOTO],
    ['panProof', PDF],
    ['aadhaarProof', PDF],
    ['bankProof', PDF],
    ...extra,
  ]) {
    const result = await call(fileRoute, {
      method: 'POST',
      params: { token },
      body: { field, file, fileName: `${field}.pdf` },
    });
    expect(result.status).toBe(200);
  }
}

describe('employee KYC links', () => {
  it('the public form fills the employee file, KYC and documents', async () => {
    await seedDocumentTypes();
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const employee = await makeUser({ name: 'Riya Singh' });
    const made = await call(makeRoute, {
      method: 'POST',
      user: hr,
      body: { userId: employee._id },
    });
    expect(made.status).toBe(200);
    const token = tokenOf(made.body.link);

    const form = await call(formRoute, { params: { token } });
    expect(form.status).toBe(200);
    expect(form.body.name).toBe('Riya Singh');
    const resume = form.body.documents.find((doc) => doc.name === 'Resume');

    // Not all files yet: refused, nothing written.
    const early = await call(submitRoute, { method: 'POST', params: { token }, body: FORM });
    expect(early.status).toBe(400);

    await uploadAll(token, [[resume.field, PDF]]);
    const sent = await call(submitRoute, { method: 'POST', params: { token }, body: FORM });
    expect(sent.status).toBe(200);

    const user = await User.findById(employee._id).lean();
    expect(user).toMatchObject({
      phone: '9000011111',
      dateOfBirth: '1998-05-04',
      gender: 'female',
      permanentAddress: 'Main Road, Ranchi',
      emergencyContact: { name: 'Mohan', relation: 'Father', phone: '9000022222' },
    });
    expect(user.photoKey).toMatch(/^kyc-form\//);
    const kyc = await Kyc.findOne({ userId: employee._id }).lean();
    expect(kyc.pan).toMatchObject({ last4: '234F', status: 'submitted', enteredBy: null });
    expect(kyc.pan.sealed).not.toContain('ABCDE1234F');
    expect(kyc.aadhaar.last4).toBe('4321');
    expect(kyc.bank).toMatchObject({ ifsc: 'SBIN0001234', accountLast4: '9012' });
    expect(kyc.bank.proofs).toHaveLength(1);
    expect(await EmployeeDocument.countDocuments({ userId: employee._id })).toBe(1);

    // Sent once only; the page then says thank you.
    const twice = await call(submitRoute, { method: 'POST', params: { token }, body: FORM });
    expect(twice.status).toBe(409);
    expect((await call(formRoute, { params: { token } })).body.state).toBe('submitted');
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
    await call(closeRoute, { method: 'DELETE', user: hr, params: { id: second.body.link._id } });
    expect((await open(second.body.link)).status).toBe(410);
    expect((await call(formRoute, { params: { token: 'not-a-real-token' } })).status).toBe(404);
    const list = await call(listRoute, { user: hr });
    expect(list.body.items.map((item) => item.state)).toEqual(['closed', 'closed']);
    expect((await call(listRoute, { user: employee })).status).toBe(403);
  });
});
