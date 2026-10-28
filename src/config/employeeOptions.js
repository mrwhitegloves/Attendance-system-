// Fixed choices of the employee file, with the words the screens show. Shared by the server
// (model and validation) and the screens, so a choice exists in exactly one place.

const options = (labels) => ({
  values: Object.keys(labels),
  label: (value) => labels[value] ?? (value || '—'),
  list: Object.entries(labels).map(([value, label]) => ({ value, label })),
});

export const GENDER = options({ male: 'Male', female: 'Female', other: 'Other' });

export const EMPLOYMENT_TYPE = options({
  full_time: 'Full-time',
  part_time: 'Part-time',
  intern: 'Intern',
  consultant: 'Consultant',
  contract: 'Contract',
});

export const WORK_MODE = options({
  office: 'Work from office',
  field: 'Field',
  remote: 'Work from home',
  hybrid: 'Hybrid',
});

export const EMPLOYMENT_STATUS = options({
  probation: 'On probation',
  confirmed: 'Confirmed',
  notice_period: 'Notice period',
  exited: 'Exited',
});

export const STAFF_TYPES = ['Office Staff', 'Field Staff', 'Management', 'Intern'];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Account status decides sign-in (founder, 2026-10-27): only "active" may sign in and punch.
// Any other status signs the person out everywhere at once. Separate from employment status.
export const ACCOUNT_STATUS = options({
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
});

export const ACCOUNT_STATUS_TONE = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'warning',
  deactivated: 'danger',
};

// Weekly days off (founder, 2026-10-28): any day, one or two per employee, 0 = Sunday … 6 =
// Saturday. Old records have none: Sunday.
export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const weeklyOffsOf = (person) => (person?.weeklyOffs?.length ? person.weeklyOffs : [0]);
export const isWeeklyOff = (person, day) =>
  weeklyOffsOf(person).includes(new Date(`${day}T00:00:00Z`).getUTCDay());
export const weeklyOffWords = (person) =>
  weeklyOffsOf(person)
    .map((day) => WEEKDAY_NAMES[day])
    .join(' and ');
