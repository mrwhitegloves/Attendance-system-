import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listTrash, TRASH_KINDS } from '@/server/services/trash.service.js';
import { listTrashQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { SettingsTabs } from '@/features/settings/SettingsTabs.jsx';
import { RecentlyDeleted } from '@/features/settings/RecentlyDeleted.jsx';

export const metadata = { title: 'Recently deleted' };

export default async function RecentlyDeletedPage({ searchParams }) {
  const user = await requirePageUser('settings.manage');
  const parsed = listTrashQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listTrashQuery.parse({});
  const result = await listTrash(user, query);
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Everything deleted in the app waits here for 90 days. Restore puts it back where it was."
      />
      <SettingsTabs active="recently-deleted" />
      <RecentlyDeleted
        result={toPlain(result)}
        kinds={Object.entries(TRASH_KINDS).map(([value, kind]) => ({ value, label: kind.label }))}
      />
    </>
  );
}
