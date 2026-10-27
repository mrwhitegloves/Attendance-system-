import { LinkTabs } from '@/components/shared/Tabs.jsx';

// The sections of Settings, each with its own address.
const SECTIONS = [
  { id: 'lists', label: 'Lists', href: '/settings/lists' },
  { id: 'document-types', label: 'Document types', href: '/settings/document-types' },
];

export function SettingsTabs({ active }) {
  return <LinkTabs tabs={SECTIONS} active={active} />;
}
