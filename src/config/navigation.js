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
    href: '/requests',
    label: 'Requests',
    icon: 'Inbox',
    show: (p) => p.requests || p.requestCreate,
    mobile: true,
  },
  {
    href: '/employees',
    label: 'Employees',
    icon: 'Users',
    show: (p) => p.users && p.users !== 'own',
    mobile: true,
  },
  {
    href: '/documents',
    label: 'Documents',
    icon: 'FolderOpen',
    show: (p) => p.documents && p.documents !== 'own',
  },
  {
    href: '/salary',
    label: 'Salary',
    icon: 'IndianRupee',
    show: (p) => p.salary && p.salary !== 'own',
  },
  {
    href: '/payslips',
    label: 'Payslips',
    icon: 'ReceiptText',
    show: (p) => p.payslips && p.payslips !== 'own',
  },
  {
    href: '/recruitment',
    label: 'Hiring',
    icon: 'UserPlus',
    show: (p) => p.recruitment,
    // Onboarding and exits are tabs on the same screen.
  },
  { href: '/performance', label: 'Performance', icon: 'TrendingUp', show: (p) => p.performance },
  { href: '/assets', label: 'Assets', icon: 'Laptop', show: (p) => p.assets },
  { href: '/payouts', label: 'Salary payments', icon: 'Wallet', show: (p) => p.payouts },
  { href: '/audit-log', label: 'Audit log', icon: 'ScrollText', show: (p) => p.audit },
  { href: '/settings', label: 'Settings', icon: 'Settings', show: (p) => p.settings },
  { href: '/me', label: 'My profile', icon: 'UserRound', show: () => true },
];
