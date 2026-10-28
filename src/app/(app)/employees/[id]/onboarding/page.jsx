import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getOnboarding } from '@/server/services/onboarding.service.js';
import { OnboardingPanel } from '@/features/onboarding/OnboardingPanel.jsx';

export const metadata = { title: 'Employee onboarding' };

export default async function EmployeeOnboardingPage({ params }) {
  const user = await requirePageUser('users.view');
  const { id } = await params;
  const onboarding = await getOnboarding(user, id);
  return (
    <OnboardingPanel
      userId={id}
      onboarding={toPlain(onboarding)}
      canManage={Boolean(can(user, 'users.manage'))}
    />
  );
}
