import { LinkTabs } from '@/components/shared/Tabs.jsx';

/** The sections of the Attendance screen, each with its own address. */
export function AttendanceTabs({ active, scope, canPunch }) {
  const tabs = [
    scope !== 'own' && { id: 'day', label: 'Day sheet', href: '/attendance' },
    {
      id: 'records',
      label: scope === 'own' ? 'My punches' : 'All punches',
      href: '/attendance/records',
    },
    canPunch && { id: 'calendar', label: 'My month', href: '/attendance/calendar' },
  ].filter(Boolean);
  return <LinkTabs tabs={tabs} active={active} />;
}
