import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getEmployeeDocuments, queueExpiryCheck } from '@/server/services/documents.service.js';
import { DocumentsPanel } from '@/features/documents/DocumentsPanel.jsx';

export const metadata = { title: 'Employee documents' };

export default async function EmployeeDocumentsPage({ params }) {
  const user = await requirePageUser('documents.view');
  const { id } = await params;
  queueExpiryCheck();
  const data = await getEmployeeDocuments(user, id);
  return <DocumentsPanel data={toPlain(data)} />;
}
