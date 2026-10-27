import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { getOwnFile, fileChecklist } from '@/server/services/users.service.js';
import { env } from '@/server/config/env.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { Avatar, CompletenessBar } from '@/components/shared/Avatar.jsx';
import { EmployeeFile } from '@/features/employees/EmployeeFile.jsx';
import { MyAccount } from '@/features/auth/MyAccount.jsx';
import { KycPanel } from '@/features/kyc/KycPanel.jsx';
import { getKyc } from '@/server/services/kyc.service.js';
import { getEmployeeDocuments } from '@/server/services/documents.service.js';
import { DocumentsPanel } from '@/features/documents/DocumentsPanel.jsx';
import { can } from '@/server/permissions/can.js';

export const metadata = { title: 'My profile' };

export default async function MePage() {
  const signedIn = await requirePageUser();
  const { user, managerName } = await getOwnFile(signedIn);
  const kyc = can(signedIn, 'kyc.view') ? await getKyc(signedIn, signedIn._id) : null;
  const documents = can(signedIn, 'documents.view')
    ? await getEmployeeDocuments(signedIn, signedIn._id)
    : null;
  return (
    <>
      <PageHeader title="My profile" subtitle="To change your details, please contact HR." />
      <div className="mb-4 flex items-center gap-4">
        <Avatar name={user.name} src={user.photoUrl} size="xl" />
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-muted">
            {[user.employeeId, user.designation].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-1">
            <CompletenessBar percent={user.completeness?.percent ?? 0} />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <EmployeeFile
          employee={toPlain(user)}
          managerName={managerName}
          roleName={roleLabel(user.roleKey)}
          checklist={await fileChecklist(user)}
          canEdit={false}
        />
        {kyc && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">KYC and bank</h2>
            <KycPanel kyc={toPlain(kyc)} />
          </section>
        )}
        {documents && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">My documents</h2>
            <DocumentsPanel data={toPlain(documents)} />
          </section>
        )}
        <MyAccount vapidPublicKey={env.VAPID_PUBLIC_KEY || null} />
      </div>
    </>
  );
}
