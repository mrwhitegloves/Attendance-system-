import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listDocumentTypes } from '@/server/services/documents.service.js';
import { DOCUMENT_CATEGORIES } from '@/server/models/document.model.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { SettingsTabs } from '@/features/settings/SettingsTabs.jsx';
import { DocumentTypesManager } from '@/features/settings/DocumentTypesManager.jsx';

export const metadata = { title: 'Document types' };

export default async function DocumentTypesPage() {
  await requirePageUser('settings.manage');
  const types = await listDocumentTypes({ includeInactive: true });
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Required types count in every employee's file. Types are switched off, never deleted."
      />
      <SettingsTabs active="document-types" />
      <DocumentTypesManager
        types={toPlain(types)}
        categories={Object.entries(DOCUMENT_CATEGORIES).map(([value, label]) => ({ value, label }))}
      />
    </>
  );
}
