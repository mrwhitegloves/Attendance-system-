'use client';

import { usePathname } from 'next/navigation';
import { LinkTabs } from '@/components/shared/Tabs.jsx';

// The sections of one employee, each its own address. `show` comes from the person's permissions.
const SECTIONS = [
  { id: 'profile', label: 'Profile', path: '' },
  { id: 'kyc', label: 'KYC & bank', path: '/kyc', permission: 'kyc' },
  { id: 'documents', label: 'Documents', path: '/documents', permission: 'documents' },
  { id: 'attendance', label: 'Attendance', path: '/attendance' },
  { id: 'leave', label: 'Leave', path: '/leave', permission: 'leave' },
];

export function EmployeeTabs({ id, show }) {
  const pathname = usePathname();
  const base = `/employees/${id}`;
  if (pathname.endsWith('/edit')) return null;
  const tabs = SECTIONS.filter((section) => !section.permission || show[section.permission]).map(
    (section) => ({ id: section.id, label: section.label, href: `${base}${section.path}` }),
  );
  const active =
    SECTIONS.find((section) => section.path && pathname.startsWith(`${base}${section.path}`))?.id ??
    'profile';
  return <LinkTabs tabs={tabs} active={active} />;
}
