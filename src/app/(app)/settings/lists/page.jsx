import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listLookups, LOOKUP_LABELS } from '@/server/services/lookups.service.js';
import { LOOKUP_TYPES } from '@/server/models/lookup.model.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { LinkTabs } from '@/components/shared/Tabs.jsx';
import { ListsManager } from '@/features/settings/ListsManager.jsx';
import { SettingsTabs } from '@/features/settings/SettingsTabs.jsx';

export const metadata = { title: 'Lists' };

export default async function ListsPage({ searchParams }) {
  await requirePageUser('settings.manage');
  const { type: asked } = await searchParams;
  const type = LOOKUP_TYPES.includes(asked) ? asked : 'department';
  const items = await listLookups(type, { includeInactive: true, withCounts: true });
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="The choices HR picks from on an employee's file, and the onboarding and exit tasks. Renaming updates every employee; items are switched off, never deleted."
      />
      <SettingsTabs active="lists" />
      <LinkTabs
        active={type}
        tabs={LOOKUP_TYPES.map((id) => ({
          id,
          label: `${LOOKUP_LABELS[id]}s`,
          href: id === 'department' ? '/settings/lists' : `/settings/lists?type=${id}`,
        }))}
      />
      <ListsManager key={type} type={type} label={LOOKUP_LABELS[type]} items={toPlain(items)} />
    </>
  );
}
