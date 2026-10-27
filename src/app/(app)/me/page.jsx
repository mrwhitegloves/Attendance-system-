import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { getOwnFile } from '@/server/services/users.service.js';
import { profileChecklist } from '@/server/lib/completeness.js';
import { env } from '@/server/config/env.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { Avatar, CompletenessBar } from '@/components/shared/Avatar.jsx';
import { EmployeeFile } from '@/features/employees/EmployeeFile.jsx';
import { MyAccount } from '@/features/auth/MyAccount.jsx';

export const metadata = { title: 'My profile' };

export default async function MePage() {
  const signedIn = await requirePageUser();
  const { user, managerName } = await getOwnFile(signedIn);
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
          checklist={profileChecklist(user)}
          canEdit={false}
        />
        <MyAccount vapidPublicKey={env.VAPID_PUBLIC_KEY || null} />
      </div>
    </>
  );
}
