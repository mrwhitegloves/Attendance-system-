'use client';

import { usePathname } from 'next/navigation';
import { LinkTabs } from '@/components/shared/Tabs.jsx';

/** Profile, Attendance and Leave of one employee. Phase 1 adds KYC, documents, salary … */
export function EmployeeTabs({ id, canSeeLeave }) {
  const pathname = usePathname();
  const base = `/employees/${id}`;
  const tabs = [
    { id: 'profile', label: 'Profile', href: base },
    { id: 'attendance', label: 'Attendance', href: `${base}/attendance` },
    canSeeLeave && { id: 'leave', label: 'Leave', href: `${base}/leave` },
  ].filter(Boolean);
  const active = pathname.endsWith('/attendance')
    ? 'attendance'
    : pathname.endsWith('/leave')
      ? 'leave'
      : 'profile';
  if (pathname.endsWith('/edit')) return null;
  return <LinkTabs tabs={tabs} active={active} />;
}
