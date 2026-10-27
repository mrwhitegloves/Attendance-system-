import { Role } from '../models/role.model.js';

// Roles and what each may do. Every check goes through can() in ./can.js; no screen or service
// checks a role by name. A value is a scope ('all', 'team', 'own') for ".view" permissions, or
// true for actions. Roles live in the `roles` collection (Settings → Roles, CEO only); the
// defaults below fill it once and are used until it is loaded. The CEO role always has every
// permission, so nobody can lock the company out.

export const PERMISSIONS = {
  'attendance.punch': 'Mark own attendance',
  'attendance.view': 'See attendance',
  'leave.request': 'Request leave',
  'leave.view': 'See leave requests',
  'leave.decide': 'Approve or reject leave',
  'users.view': 'See employees',
  'users.manage': 'Add and edit employees',
  'users.password': 'See an employee password',
  'kyc.view': 'See KYC and bank status (numbers masked)',
  'kyc.manage': 'Enter KYC and bank details and upload proofs',
  'kyc.verify': 'Verify or reject KYC and bank details',
  'kyc.reveal': 'See full PAN and bank account numbers',
  'documents.view': 'See employee documents',
  'documents.manage': 'Upload employee documents',
  'documents.verify': 'Verify or reject employee documents',
  'letters.view': 'See letters',
  'letters.manage': 'Prepare and issue letters',
  'salary.view': 'See salary structures',
  'salary.manage': 'Propose salary structures and revisions',
  'salary.approve': 'Approve salary structures (never your own proposal)',
  'payslips.view': 'See salary slips',
  'payslips.manage': 'Prepare and change draft salary slips',
  'payslips.finalise': 'Make salary slips final (never one you last changed)',
  'requests.create': 'Send requests (expense, advance, document, grievance)',
  'requests.view': 'See requests (a team never includes grievances)',
  'requests.decide': 'Decide requests (never your own; grievances need everyone)',
  'notifications.punches': 'Get a notification for every punch',
  'notifications.broadcast': 'Send a notification to all employees',
  'settings.manage': 'Change settings, lists, document types and templates',
  'roles.manage': 'Change roles and permissions',
  'audit.view': 'See the audit log',
};

export const SCOPES = ['own', 'team', 'all'];
// Permissions that apply to some people only (own / team / all): every ".view", and deciding
// leave or requests (a manager decides for their team).
const SCOPED_ACTIONS = new Set(['leave.decide', 'requests.decide']);
export const isScoped = (permission) =>
  permission.endsWith('.view') || SCOPED_ACTIONS.has(permission);

const everything = (scope) =>
  Object.fromEntries(Object.keys(PERMISSIONS).map((key) => [key, isScoped(key) ? scope : true]));

export const DEFAULT_ROLES = {
  ceo: { label: 'CEO', locked: true, permissions: everything('all') },
  hr_admin: {
    label: 'HR Admin',
    // HR prepares salary changes; Finance or the CEO approves them (CEO spec, maker-checker).
    // Only the CEO changes roles, so HR cannot give itself more rights.
    permissions: {
      ...everything('all'),
      'audit.view': false,
      'salary.approve': false,
      'payslips.finalise': false,
      'roles.manage': false,
    },
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
      'salary.view': 'all',
      'salary.manage': true,
      'salary.approve': true,
      'payslips.view': 'all',
      'payslips.manage': true,
      'payslips.finalise': true,
      'requests.create': true,
      'requests.view': 'all',
      'requests.decide': 'all',
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
      'requests.create': true,
      'requests.view': 'team',
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
      'salary.view': 'own',
      'payslips.view': 'own',
      'requests.create': true,
      'requests.view': 'own',
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
      'salary.view': 'all',
      'payslips.view': 'all',
      'requests.view': 'all',
    },
  },
};

// ---- The loaded roles (cached for a minute; changes clear the cache) ----

let cache = null;
let loadedAt = 0;
const MAX_AGE_MS = 60 * 1000;

/** The roles in use right now (the defaults until the database has been read). */
export function rolesNow() {
  return cache ?? DEFAULT_ROLES;
}

/** Reads the roles from the database at most once a minute. The CEO always gets everything. */
export async function loadRoles({ force = false } = {}) {
  if (!force && cache && Date.now() - loadedAt < MAX_AGE_MS) return cache;
  const rows = await Role.find({}).lean();
  if (!rows.length) {
    cache = null;
  } else {
    cache = Object.fromEntries(
      rows.map((row) => [
        row.key,
        {
          label: row.label,
          locked: row.locked,
          permissions: row.locked ? everything('all') : (row.permissions ?? {}),
        },
      ]),
    );
  }
  loadedAt = Date.now();
  return rolesNow();
}

export function resetRolesCache() {
  cache = null;
  loadedAt = 0;
}

export const roleLabel = (key) => rolesNow()[key]?.label ?? key;
export const roleExists = (key) => Boolean(rolesNow()[key]);
export const roleOptions = () =>
  Object.entries(rolesNow()).map(([value, role]) => ({ value, label: role.label }));
/** Role keys that have a permission (any scope). */
export const roleKeysWith = (permission) =>
  Object.entries(rolesNow())
    .filter(([, role]) => role.permissions[permission])
    .map(([key]) => key);
