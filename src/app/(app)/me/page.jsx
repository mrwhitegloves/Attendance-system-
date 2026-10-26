import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { env } from '@/server/config/env.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { MyProfile } from '@/features/auth/MyProfile.jsx';

export const metadata = { title: 'My profile' };

export default async function MePage() {
  const user = await requirePageUser();
  return (
    <>
      <PageHeader title="My profile" subtitle="To change your details, please contact HR." />
      <MyProfile
        user={toPlain(user)}
        roleLabel={roleLabel(user.roleKey)}
        vapidPublicKey={env.VAPID_PUBLIC_KEY || null}
      />
    </>
  );
}
