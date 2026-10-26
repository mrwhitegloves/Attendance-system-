// The menu. Each item shows only when the person has its permission (from /api/auth/me).
// Later phases add the other HRMS modules here (12 groups at most, CEO spec section 2).

export const NAVIGATION = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    show: () => true,
    mobile: true,
  },
  { href: '/attendance/punch', label: 'Punch', icon: 'Camera', show: (p) => p.punch, mobile: true },
  {
    href: '/attendance',
    label: 'Attendance',
    icon: 'CalendarCheck',
    show: (p) => p.attendance,
    mobile: true,
  },
  { href: '/leave', label: 'Leave', icon: 'Plane', show: (p) => p.leaves, mobile: true },
  {
    href: '/employees',
    label: 'Employees',
    icon: 'Users',
    show: (p) => p.users && p.users !== 'own',
    mobile: true,
  },
  { href: '/audit-log', label: 'Audit log', icon: 'ScrollText', show: (p) => p.audit },
  { href: '/me', label: 'My profile', icon: 'UserRound', show: () => true },
];
