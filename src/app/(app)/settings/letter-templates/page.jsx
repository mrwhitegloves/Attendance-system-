import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listTemplates } from '@/server/services/letters.service.js';
import { PLACEHOLDERS } from '@/server/lib/letterText.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { SettingsTabs } from '@/features/settings/SettingsTabs.jsx';
import { TemplatesManager } from '@/features/settings/TemplatesManager.jsx';

export const metadata = { title: 'Letter templates' };

export default async function LetterTemplatesPage() {
  await requirePageUser('settings.manage');
  const templates = await listTemplates({ includeInactive: true });
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Changing a template never changes letters that were already issued."
      />
      <SettingsTabs active="letter-templates" />
      <TemplatesManager templates={toPlain(templates)} placeholders={PLACEHOLDERS} />
    </>
  );
}
