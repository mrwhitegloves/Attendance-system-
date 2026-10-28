import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listRoles } from '@/server/services/roles.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { SettingsTabs } from '@/features/settings/SettingsTabs.jsx';
import { RolesMatrix } from '@/features/settings/RolesMatrix.jsx';

export const metadata = { title: 'Roles and permissions' };

export default async function RolesPage() {
  const user = await requirePageUser('roles.manage');
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="What each role may see and do. Changes apply within a minute to everyone with that role. The CEO role always has everything."
      />
      <SettingsTabs active="roles" />
      <RolesMatrix data={toPlain(await listRoles(user))} />
    </>
  );
}
