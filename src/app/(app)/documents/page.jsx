import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import {
  listAllDocuments,
  listDocumentTypes,
  queueExpiryCheck,
} from '@/server/services/documents.service.js';
import { listDocumentsQuery } from '@/server/validation/schemas.js';
import { DOCUMENT_CATEGORIES } from '@/server/models/document.model.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { DocumentRepository } from '@/features/documents/DocumentRepository.jsx';

export const metadata = { title: 'Documents' };

export default async function DocumentsPage({ searchParams }) {
  const user = await requirePageUser('documents.view');
  if (can(user, 'documents.view') === 'own') notFound();
  queueExpiryCheck();
  const parsed = listDocumentsQuery.safeParse(await searchParams);
  const [result, types] = await Promise.all([
    listAllDocuments(user, parsed.success ? parsed.data : listDocumentsQuery.parse({})),
    listDocumentTypes(),
  ]);
  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Every employee document in one place. Upload and check them on the employee's Documents tab."
      />
      <DocumentRepository
        result={toPlain(result)}
        types={toPlain(types).map((type) => ({ value: type._id, label: type.name }))}
        categories={Object.entries(DOCUMENT_CATEGORIES).map(([value, label]) => ({ value, label }))}
      />
    </>
  );
}
