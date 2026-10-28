import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getKyc } from '@/server/services/kyc.service.js';
import { KycPanel } from '@/features/kyc/KycPanel.jsx';

export const metadata = { title: 'KYC and bank' };

export default async function EmployeeKycPage({ params }) {
  const user = await requirePageUser('kyc.view');
  const { id } = await params;
  const kyc = await getKyc(user, id);
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        Numbers are masked. Full PAN and account numbers are sealed and shown only on request, and
        every view is recorded.
      </p>
      <KycPanel kyc={toPlain(kyc)} />
    </>
  );
}
