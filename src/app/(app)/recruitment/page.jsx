import { Plus } from 'lucide-react';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listCandidates } from '@/server/services/recruitment.service.js';
import { listCandidatesQuery } from '@/server/validation/schemas.js';
import { ButtonLink, PageHeader } from '@/components/shared/ui.jsx';
import { CandidateList } from '@/features/recruitment/CandidateList.jsx';
import { LifecycleTabs, lifecycleShow } from '@/features/recruitment/LifecycleTabs.jsx';

export const metadata = { title: 'Hiring' };

export default async function RecruitmentPage({ searchParams }) {
  const user = await requirePageUser('recruitment.view');
  const parsed = listCandidatesQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listCandidatesQuery.parse({});
  const result = await listCandidates(user, query);
  return (
    <>
      <PageHeader
        title="Hiring"
        subtitle="Candidates, their offer letters, and joining."
        actions={
          can(user, 'recruitment.manage') && (
            <ButtonLink href="/recruitment/new">
              <Plus size={16} /> Add candidate
            </ButtonLink>
          )
        }
      />
      <LifecycleTabs active="recruitment" show={lifecycleShow(can, user)} />
      <CandidateList result={toPlain(result)} />
    </>
  );
}
