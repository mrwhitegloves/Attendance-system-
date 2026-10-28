// How complete an employee's file is, worked out from the record itself (CEO spec: the
// dashboard calculates completeness; HR never declares a file complete by hand).
// KYC items and required documents count once they are submitted (verification is shown
// separately); an expired or rejected document does not count.

const KYC_DONE = ['submitted', 'under_review', 'verified'];

const filled = (value) => (typeof value === 'string' ? value.trim() !== '' : Boolean(value));

/** Every item of the employee's file with its section and whether it is done. */
export function profileChecklist(user, kyc = null, documents = null, extras = {}) {
  const items = [
    ['personal', 'Photo', filled(user.photoKey)],
    ['personal', 'Mobile number', filled(user.phone)],
    ['personal', 'Date of birth', filled(user.dateOfBirth)],
    ['personal', 'Gender', filled(user.gender)],
    ['personal', 'Current address', filled(user.currentAddress)],
    ['personal', 'Permanent address', filled(user.permanentAddress)],
    [
      'personal',
      'Emergency contact',
      filled(user.emergencyContact?.name) && filled(user.emergencyContact?.phone),
    ],
    ['employment', 'Designation', filled(user.designation)],
    ['employment', 'Department', filled(user.department)],
    ['employment', 'Branch', filled(user.branch)],
    ['employment', 'Employment type', filled(user.employmentType)],
    ['employment', 'Work mode', filled(user.workMode)],
    ['employment', 'Employment status', filled(user.employmentStatus)],
    ['employment', 'Joining date', filled(user.joiningDate)],
  ];
  // The CEO reports to nobody; everyone else needs a manager.
  if (user.roleKey !== 'ceo')
    items.push(['employment', 'Reporting manager', filled(user.managerId)]);
  for (const [item, label] of [
    ['pan', 'PAN'],
    ['aadhaar', 'Aadhaar'],
    ['bank', 'Bank account'],
  ]) {
    items.push(['kyc', label, KYC_DONE.includes(kyc?.[item]?.status)]);
  }
  // extras.salaryApproved: whether an approved salary structure exists (undefined: not checked).
  if (extras.salaryApproved !== undefined) {
    items.push(['employment', 'Salary structure (approved)', extras.salaryApproved]);
  }
  // documents: { requiredTypes: [{ _id, name }], records: [{ typeId, status }] }
  for (const type of documents?.requiredTypes ?? []) {
    const record = documents.records.find((doc) => String(doc.typeId) === String(type._id));
    items.push(['documents', type.name, KYC_DONE.includes(record?.status)]);
  }
  return items.map(([section, label, done]) => ({ section, label, done }));
}

/** { percent: 0–100, missing: [labels] } */
export function computeCompleteness(user, kyc = null, documents = null, extras = {}) {
  const items = profileChecklist(user, kyc, documents, extras);
  const done = items.filter((item) => item.done).length;
  return {
    percent: Math.round((done / items.length) * 100),
    missing: items.filter((item) => !item.done).map((item) => item.label),
  };
}
