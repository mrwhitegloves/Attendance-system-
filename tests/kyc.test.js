import { describe, expect, it, vi } from 'vitest';

// S3 is replaced by a fake: tests never upload anything.
vi.mock('@/server/infra/storage.js', () => ({
  isStorageConfigured: () => true,
  putFile: async (key) => key,
  signedUrl: async (key) => (key ? `https://signed.example/${key}` : null),
}));

const { getKyc, updateKycItem, addKycProof, reviewKycItem, revealKycNumber } =
  await import('@/server/services/kyc.service.js');
const { Kyc } = await import('@/server/models/kyc.model.js');
const { User } = await import('@/server/models/user.model.js');
const { AuditLog } = await import('@/server/models/system.models.js');
const { PATCH: detailsRoute } = await import('@/app/api/users/[id]/kyc/[item]/route.js');
const { GET: kycRoute } = await import('@/app/api/users/[id]/kyc/route.js');
const { call, makeUser } = await import('./helpers.js');

const PDF = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 test').toString('base64')}`;

describe('KYC numbers', () => {
  it('stores PAN sealed and shows only the last 4', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    const view = await updateKycItem(hr, staff._id, 'pan', {
      number: 'ABCDE1234F',
      nameOnPan: 'Staff Name',
    });
    const pan = view.items.find((item) => item.item === 'pan');
    expect(pan).toMatchObject({ status: 'submitted', masked: '******234F' });
    const stored = await Kyc.findOne({ userId: staff._id }).lean();
    expect(stored.pan.sealed).not.toContain('ABCDE1234F');
    expect(JSON.stringify(view)).not.toContain('ABCDE1234F');
  });

  it('never stores a full Aadhaar number', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    const result = await call(detailsRoute, {
      method: 'PATCH',
      user: hr,
      params: { id: String(staff._id), item: 'aadhaar' },
      body: { last4: '123412341234' },
    });
    expect(result.status).toBe(400);
    await updateKycItem(hr, staff._id, 'aadhaar', { last4: '5678' });
    await expect(revealKycNumber(hr, staff._id, 'aadhaar')).rejects.toMatchObject({ status: 400 });
  });

  it('reveals a full number only with permission, and audits it without the number', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const finance = await makeUser({ roleKey: 'finance' });
    const manager = await makeUser({ roleKey: 'manager' });
    const staff = await makeUser({ managerId: manager._id });
    await updateKycItem(hr, staff._id, 'bank', {
      accountHolderName: 'Staff Name',
      bankName: 'SBI',
      ifsc: 'SBIN0001234',
      accountNumber: '123456789012',
    });
    expect((await revealKycNumber(finance, staff._id, 'bank')).number).toBe('123456789012');
    await expect(revealKycNumber(manager, staff._id, 'bank')).rejects.toMatchObject({
      status: 403,
    });
    const audit = await AuditLog.find({ action: 'kyc.revealed' }).lean();
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(await AuditLog.find({}).lean())).not.toContain('123456789012');
  });
});

describe('verification', () => {
  it('the maker cannot verify; someone else can, only with a proof', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const finance = await makeUser({ roleKey: 'finance' });
    const staff = await makeUser();
    await updateKycItem(hr, staff._id, 'pan', { number: 'ABCDE1234F', nameOnPan: 'Staff Name' });
    await expect(
      reviewKycItem(hr, staff._id, 'pan', { decision: 'verified' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      reviewKycItem(finance, staff._id, 'pan', { decision: 'verified' }),
    ).rejects.toMatchObject({ status: 400 });
    await addKycProof(hr, staff._id, 'pan', { file: PDF, fileName: 'pan card.pdf' });
    const view = await reviewKycItem(finance, staff._id, 'pan', { decision: 'verified' });
    const pan = view.items.find((item) => item.item === 'pan');
    expect(pan.status).toBe('verified');
    expect(pan.proofs[0]).toMatchObject({ fileName: 'pan-card.pdf' });
    expect(pan.proofs[0].url).toMatch(/^https:\/\/signed\.example\/kyc\//);
  });

  it('a rejection needs a reason; new details make it submitted again', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const ceo = await makeUser({ roleKey: 'ceo' });
    const staff = await makeUser();
    await updateKycItem(hr, staff._id, 'aadhaar', { last4: '5678' });
    await expect(
      reviewKycItem(ceo, staff._id, 'aadhaar', { decision: 'rejected', reason: '' }),
    ).rejects.toMatchObject({ status: 400 });
    await reviewKycItem(ceo, staff._id, 'aadhaar', {
      decision: 'rejected',
      reason: 'Blurred photo',
    });
    const again = await updateKycItem(hr, staff._id, 'aadhaar', { last4: '5679' });
    expect(again.items.find((item) => item.item === 'aadhaar')).toMatchObject({
      status: 'submitted',
      rejectReason: '',
    });
  });

  it('counts submitted KYC items in the file completeness', async () => {
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser();
    await updateKycItem(hr, staff._id, 'aadhaar', { last4: '5678' });
    const user = await User.findById(staff._id).lean();
    expect(user.completeness.missing).toContain('PAN');
    expect(user.completeness.missing).not.toContain('Aadhaar');
  });
});

describe('who sees KYC', () => {
  it('an employee sees only their own, a manager none', async () => {
    const manager = await makeUser({ roleKey: 'manager' });
    const staff = await makeUser({ managerId: manager._id });
    const other = await makeUser();
    expect((await call(kycRoute, { user: staff, params: { id: String(staff._id) } })).status).toBe(
      200,
    );
    expect((await call(kycRoute, { user: staff, params: { id: String(other._id) } })).status).toBe(
      404,
    );
    expect(
      (await call(kycRoute, { user: manager, params: { id: String(staff._id) } })).status,
    ).toBe(403);
    const own = await getKyc(staff, staff._id);
    expect(own.permissions).toEqual({ manage: false, verify: false, reveal: false });
  });
});
