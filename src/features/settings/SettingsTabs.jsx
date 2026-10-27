import { LinkTabs } from '@/components/shared/Tabs.jsx';
import { getCurrentUser } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';

// The sections of Settings, each with its own address. "Roles" only for people who manage roles.
const SECTIONS = [
  { id: 'lists', label: 'Lists', href: '/settings/lists' },
  { id: 'document-types', label: 'Document types', href: '/settings/document-types' },
  { id: 'letter-templates', label: 'Letter templates', href: '/settings/letter-templates' },
  { id: 'company', label: 'Company', href: '/settings/company' },
  {
    id: 'roles',
    label: 'Roles and permissions',
    href: '/settings/roles',
    permission: 'roles.manage',
  },
];

export async function SettingsTabs({ active }) {
  const user = await getCurrentUser();
  const tabs = SECTIONS.filter((section) => !section.permission || can(user, section.permission));
  return <LinkTabs tabs={tabs} active={active} />;
}
