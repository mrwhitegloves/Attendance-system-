// The kinds of employee request (CEO spec section 10) and the words the screens show. Shared by
// the server (model, validation, rules) and the screens. Leave and salary revisions keep their
// own screens; the inbox links to them.

export const REQUEST_KINDS = {
  expense: {
    label: 'Expense claim',
    hint: 'Money you spent for work (travel, fuel, food with a client). Attach the bill.',
    money: true,
    dateLabel: 'Spent on',
    categoryLabel: 'Type of expense',
    categories: {
      travel: 'Travel',
      fuel: 'Fuel',
      food: 'Food',
      phone: 'Phone and internet',
      client: 'Client meeting',
      supplies: 'Supplies',
      other: 'Other',
    },
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
    done: { approved: 'Approved', rejected: 'Rejected' },
  },
  advance: {
    label: 'Salary advance',
    hint: 'Part of your salary paid early. It is recorded as an advance, never cut silently.',
    money: true,
    detailsRequired: true,
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
    done: { approved: 'Approved', rejected: 'Rejected' },
  },
  document: {
    label: 'Document request',
    hint: 'A letter or certificate you need from HR.',
    dateLabel: 'Needed by',
    categoryLabel: 'Document',
    categories: {
      salary_certificate: 'Salary certificate',
      experience_letter: 'Experience letter',
      employment_letter: 'Employment letter',
      address_proof: 'Address proof letter',
      payslip_copy: 'Copy of salary slips',
      other: 'Other',
    },
    approveLabel: 'Mark done',
    rejectLabel: 'Reject',
    done: { approved: 'Done', rejected: 'Rejected' },
  },
  grievance: {
    label: 'Grievance',
    hint: 'A problem at work. Only HR and the CEO see it, never your manager.',
    // Only people who see every request (HR, CEO) see or decide a grievance.
    private: true,
    detailsRequired: true,
    categoryLabel: 'About',
    categories: {
      workplace: 'Workplace',
      salary: 'Salary or payment',
      manager: 'Manager',
      colleague: 'Colleague',
      safety: 'Safety',
      other: 'Other',
    },
    approveLabel: 'Resolve',
    rejectLabel: 'Close',
    done: { approved: 'Resolved', rejected: 'Closed' },
  },
};

export const REQUEST_KIND_KEYS = Object.keys(REQUEST_KINDS);
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

export const requestKindOptions = REQUEST_KIND_KEYS.map((value) => ({
  value,
  label: REQUEST_KINDS[value].label,
}));

export const categoryOptions = (kind) =>
  Object.entries(REQUEST_KINDS[kind]?.categories ?? {}).map(([value, label]) => ({
    value,
    label,
  }));

export const categoryLabel = (kind, value) => REQUEST_KINDS[kind]?.categories?.[value] ?? '';

/** The word for a request's status, in the language of its kind ("Resolved", "Done"). */
export function requestStatusLabel(kind, status) {
  if (status === 'pending') return 'Waiting';
  if (status === 'cancelled') return 'Withdrawn';
  return REQUEST_KINDS[kind]?.done?.[status] ?? status;
}

export const REQUEST_STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};
