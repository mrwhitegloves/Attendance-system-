import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getCandidate } from '@/server/services/recruitment.service.js';
import { listTemplates } from '@/server/services/letters.service.js';
import { roleLabel } from '@/server/permissions/roles.js';
import { CandidateDetail } from '@/features/recruitment/CandidateDetail.jsx';

export const metadata = { title: 'Candidate' };

export default async function CandidatePage({ params }) {
  const user = await requirePageUser('recruitment.view');
  const { id } = await params;
  const data = await getCandidate(user, id).catch((error) => {
    if (error.status === 404) notFound();
    throw error;
  });
  const templates = await listTemplates();
  // Offer templates first: that is what a candidate needs.
  const ordered = [
    ...templates.filter((template) => template.kind === 'offer'),
    ...templates.filter((template) => template.kind !== 'offer'),
  ];
  const canManage = Boolean(can(user, 'recruitment.manage'));
  return (
    <CandidateDetail
      data={toPlain(data)}
      templates={toPlain(ordered)}
      roleName={roleLabel(data.candidate.roleKey)}
      canManage={canManage}
      canLetters={canManage && Boolean(can(user, 'letters.manage'))}
      canJoin={canManage && Boolean(can(user, 'users.manage'))}
    />
  );
}
