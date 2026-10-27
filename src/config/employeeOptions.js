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
  office: 'Office',
  field: 'Field',
  remote: 'Remote',
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
