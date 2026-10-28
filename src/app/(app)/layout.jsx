import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { permissionsOf } from '@/server/services/users.service.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { env } from '@/server/config/env.js';
import { AppShell } from '@/components/layout/AppShell.jsx';

// Every signed-in screen sits inside this layout. The session is checked here on the server.
export default async function SignedInLayout({ children }) {
  const user = await requirePageUser();
  return (
    <AppShell
      user={toPlain(user)}
      permissions={permissionsOf(user)}
      roleLabel={roleLabel(user.roleKey)}
      vapidPublicKey={env.VAPID_PUBLIC_KEY || null}
    >
      {children}
    </AppShell>
  );
}
