import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getCandidate } from '@/server/services/recruitment.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { CandidateForm } from '@/features/recruitment/CandidateForm.jsx';
import { employeeFormOptions } from '@/features/employees/formOptions.js';

export const metadata = { title: 'Edit candidate' };

export default async function EditCandidatePage({ params }) {
  const user = await requirePageUser('recruitment.manage');
  const { id } = await params;
  const data = await getCandidate(user, id).catch((error) => {
    if (error.status === 404) notFound();
    throw error;
  });
  if (data.candidate.status !== 'open') notFound();
  return (
    <>
      <PageHeader title={`Edit ${data.candidate.name}`} />
      <CandidateForm candidate={toPlain(data.candidate)} {...await employeeFormOptions(user)} />
    </>
  );
}
