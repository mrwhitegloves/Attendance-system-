import { LinkTabs } from '@/components/shared/Tabs.jsx';

/** Hiring → onboarding → exit: the screens of an employee's life with the company. */
export function LifecycleTabs({ active, show }) {
  const tabs = [
    show.recruitment && { id: 'recruitment', label: 'Candidates', href: '/recruitment' },
    show.onboarding && { id: 'onboarding', label: 'Onboarding', href: '/onboarding' },
    show.exits && { id: 'exits', label: 'Exits', href: '/exits' },
  ].filter(Boolean);
  if (tabs.length < 2) return null;
  return <LinkTabs tabs={tabs} active={active} />;
}

/** Which of the tabs a person may open, from their permissions (server side). */
export const lifecycleShow = (can, user) => ({
  recruitment: Boolean(can(user, 'recruitment.view')),
  onboarding: can(user, 'users.view') && can(user, 'users.view') !== 'own',
  exits: Boolean(can(user, 'exits.view')),
});
