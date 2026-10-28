import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listOnboardings } from '@/server/services/onboarding.service.js';
import { listOnboardingsQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { LifecycleTabs, lifecycleShow } from '@/features/recruitment/LifecycleTabs.jsx';
import { OnboardingList } from '@/features/onboarding/OnboardingList.jsx';

export const metadata = { title: 'Onboarding' };

export default async function OnboardingPage({ searchParams }) {
  const user = await requirePageUser('users.view');
  if (can(user, 'users.view') === 'own') notFound();
  const parsed = listOnboardingsQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listOnboardingsQuery.parse({});
  const result = await listOnboardings(user, query);
  return (
    <>
      <PageHeader title="Onboarding" subtitle="Joining checklists of new employees." />
      <LifecycleTabs active="onboarding" show={lifecycleShow(can, user)} />
      <OnboardingList result={toPlain(result)} />
    </>
  );
}
