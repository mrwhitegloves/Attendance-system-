// Roles and what each may do. Every check goes through can() in ./can.js; no screen or service
// checks a role by name. A value is a scope ('all', 'team', 'own') or true for actions without one.
// Phase 1 moves this list into a `roles` collection edited in Settings → Roles and permissions.

export const PERMISSIONS = {
  'attendance.punch': 'Mark own attendance',
  'attendance.view': 'See attendance',
  'leave.request': 'Request leave',
  'leave.view': 'See leave requests',
  'leave.decide': 'Approve or reject leave',
  'users.view': 'See employees',
  'users.manage': 'Add and edit employees',
  'users.password': 'See an employee password',
  'notifications.punches': 'Get a notification for every punch',
  'notifications.broadcast': 'Send a notification to all employees',
  'audit.view': 'See the audit log',
  'settings.manage': 'Change settings and lists',
  'kyc.view': 'See KYC and bank status (numbers masked)',
  'kyc.manage': 'Enter KYC and bank details and upload proofs',
  'kyc.verify': 'Verify or reject KYC and bank details',
  'kyc.reveal': 'See full PAN and bank account numbers',
  'documents.view': 'See employee documents',
  'documents.manage': 'Upload employee documents',
  'documents.verify': 'Verify or reject employee documents',
  'letters.view': 'See letters',
  'letters.manage': 'Prepare and issue letters',
};

const everything = (scope) =>
  Object.fromEntries(
    Object.keys(PERMISSIONS).map((key) => [key, key.endsWith('.view') ? scope : true]),
  );

export const ROLES = {
  ceo: { label: 'CEO', permissions: everything('all') },
  hr_admin: {
    label: 'HR Admin',
    permissions: { ...everything('all'), 'audit.view': false },
  },
  finance: {
    label: 'Finance',
    permissions: {
      'attendance.punch': true,
      'attendance.view': 'all',
      'leave.request': true,
      'leave.view': 'all',
      'users.view': 'all',
      'kyc.view': 'all',
      'kyc.verify': true,
      'kyc.reveal': true,
      'documents.view': 'all',
      'letters.view': 'all',
    },
  },
  manager: {
    label: 'Manager',
    permissions: {
      'attendance.punch': true,
      'attendance.view': 'team',
      'leave.request': true,
      'leave.view': 'team',
      'leave.decide': 'team',
      'users.view': 'team',
    },
  },
  employee: {
    label: 'Employee',
    permissions: {
      'attendance.punch': true,
      'attendance.view': 'own',
      'leave.request': true,
      'leave.view': 'own',
      'kyc.view': 'own',
      'documents.view': 'own',
      'letters.view': 'own',
    },
  },
  auditor: {
    label: 'Auditor / CA',
    permissions: {
      'attendance.view': 'all',
      'leave.view': 'all',
      'users.view': 'all',
      'audit.view': 'all',
      'kyc.view': 'all',
      'documents.view': 'all',
      'letters.view': 'all',
    },
  },
};

export const ROLE_KEYS = Object.keys(ROLES);
export const roleLabel = (key) => ROLES[key]?.label ?? key;
