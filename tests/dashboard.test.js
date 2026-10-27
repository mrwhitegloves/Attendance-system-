import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/infra/storage.js', () => ({
  isStorageConfigured: () => true,
  putFile: async (key) => key,
  signedUrl: async (key) => (key ? `https://signed.example/${key}` : null),
}));

const { getControlCenter } = await import('@/server/services/dashboard.service.js');
const { updateKycItem, reviewKycItem } = await import('@/server/services/kyc.service.js');
const { proposeSalary } = await import('@/server/services/salary.service.js');
const { seedDocumentTypes } = await import('@/server/services/documents.service.js');
const { refreshCompleteness } = await import('@/server/services/completeness.service.js');
const { makeUser } = await import('./helpers.js');

describe('CEO dashboard', () => {
  it('is only for people who see everyone', async () => {
    const manager = await makeUser({ roleKey: 'manager' });
    const employee = await makeUser();
    expect(await getControlCenter(manager)).toBeNull();
    expect(await getControlCenter(employee)).toBeNull();
  });

  it('counts people, verified %, payroll exposure and open items from the records', async () => {
    await seedDocumentTypes();
    const ceo = await makeUser({ roleKey: 'ceo' });
    const hr = await makeUser({ roleKey: 'hr_admin' });
    const staff = await makeUser({ employmentStatus: 'probation' });
    for (const person of [ceo, hr, staff]) await refreshCompleteness(person._id);

    await updateKycItem(hr, staff._id, 'aadhaar', { last4: '1234' });
    let view = await getControlCenter(ceo);
    expect(view.people).toMatchObject({ total: 3, probation: 1 });
    expect(view.queue.find((item) => item.key === 'kyc')).toMatchObject({ count: 1 });
    expect(view.verified.percent).toBe(0);

    // Verify needs a proof: record one through the service-level fake storage.
    const { addKycProof } = await import('@/server/services/kyc.service.js');
    await addKycProof(hr, staff._id, 'aadhaar', {
      file: `data:application/pdf;base64,${Buffer.from('%PDF').toString('base64')}`,
      fileName: 'a.pdf',
    });
    await reviewKycItem(ceo, staff._id, 'aadhaar', { decision: 'verified', reason: '' });
    await proposeSalary(hr, staff._id, {
      effectiveFrom: '2026-01-01',
      reason: 'Joining',
      components: { basic: 2000000 },
    });
    view = await getControlCenter(ceo);
    expect(view.verified.verifiedItems).toBe(1);
    expect(view.queue.find((item) => item.key === 'kyc')).toBeUndefined();
    expect(view.queue[0]).toMatchObject({ key: 'salary', count: 1 });
    expect(view.openItems).toBe(view.queue.reduce((sum, item) => sum + item.count, 0));
  });
});
