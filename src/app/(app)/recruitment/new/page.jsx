import { requirePageUser } from '@/server/auth/current.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { CandidateForm } from '@/features/recruitment/CandidateForm.jsx';
import { employeeFormOptions } from '@/features/employees/formOptions.js';

export const metadata = { title: 'Add candidate' };

export default async function NewCandidatePage() {
  const user = await requirePageUser('recruitment.manage');
  return (
    <>
      <PageHeader
        title="Add candidate"
        subtitle="Someone you want to hire. They get an employee ID only when they join."
      />
      <CandidateForm {...await employeeFormOptions(user)} />
    </>
  );
}
