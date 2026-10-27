// Fills {{placeholders}} in a letter template. Pure functions, no database.

export const PLACEHOLDERS = {
  name: 'Employee full name',
  employeeId: 'Employee ID (MWG-001)',
  designation: 'Designation',
  department: 'Department',
  branch: 'Branch',
  joiningDate: 'Joining date',
  ctcAnnual: 'Annual CTC (₹)',
  probationMonths: 'Probation (months)',
  acceptBy: 'Accept by (date)',
  date: 'Date of the letter',
  companyName: 'Company name',
  companyAddress: 'Company address',
  signatoryName: 'Signatory name',
  signatoryTitle: 'Signatory designation',
};

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** "2026-11-01" → "1 November 2026". */
export const longDate = (day) => (day ? DATE.format(new Date(`${day}T00:00:00Z`)) : '');

/** 54000000 paise → "₹5,40,000". */
export const rupees = (paise) =>
  paise === null || paise === undefined ? '' : `₹${RUPEES.format(paise / 100)}`;

/** The value of every placeholder for one letter. Empty string when unknown. */
export function placeholderValues({ employee, letter, company, issueDay }) {
  return {
    name: employee.name ?? '',
    employeeId: employee.employeeId ?? '',
    designation: employee.designation ?? '',
    department: employee.department ?? '',
    branch: employee.branch ?? '',
    joiningDate: longDate(letter.fields?.joiningDate || employee.joiningDate),
    ctcAnnual: rupees(letter.fields?.ctcAnnualPaise),
    probationMonths: letter.fields?.probationMonths ? String(letter.fields.probationMonths) : '',
    acceptBy: longDate(letter.fields?.acceptBy),
    date: longDate(issueDay),
    companyName: company.name ?? '',
    companyAddress: company.address ?? '',
    signatoryName: company.signatoryName ?? '',
    signatoryTitle: company.signatoryTitle ?? '',
  };
}

/** Replaces {{key}}; returns the text and the placeholders that had no value or are unknown. */
export function fillTemplate(text, values) {
  const missing = new Set();
  const filled = String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key) => {
    const value = values[key];
    if (value === undefined || value === '') {
      missing.add(key);
      return `[${PLACEHOLDERS[key] ?? key}]`;
    }
    return value;
  });
  return { text: filled, missing: [...missing] };
}

/** The two starting templates (plain English; HR edits them in Settings). */
export const DEFAULT_TEMPLATES = [
  {
    name: 'Offer letter',
    kind: 'offer',
    subject: 'Offer of employment',
    body: `Date: {{date}}

Dear {{name}},

We are pleased to offer you the position of {{designation}} in the {{department}} team of {{companyName}}, based at our {{branch}} office.

Your annual cost to company (CTC) will be {{ctcAnnual}}. The detailed salary structure will be shared with your appointment letter.

Your expected date of joining is {{joiningDate}}. You will be on probation for {{probationMonths}} months from the date of joining.

This offer is subject to the verification of your documents and references. Please confirm your acceptance by {{acceptBy}}.

We look forward to welcoming you to {{companyName}}.

Yours sincerely,

{{signatoryName}}
{{signatoryTitle}}
{{companyName}}`,
  },
  {
    name: 'Appointment letter',
    kind: 'appointment',
    subject: 'Letter of appointment',
    body: `Date: {{date}}

Dear {{name}},

Further to your acceptance of our offer, we are pleased to appoint you as {{designation}} in the {{department}} team of {{companyName}} with effect from {{joiningDate}}. Your employee ID is {{employeeId}}.

Your annual cost to company (CTC) is {{ctcAnnual}}, paid monthly as per the salary structure attached to this letter.

You will be on probation for {{probationMonths}} months. On successful completion, your employment will be confirmed in writing.

You will follow the company's code of conduct, leave policy and IT and asset policy, copies of which are shared with you. You will keep all company information confidential during and after your employment.

Please sign a copy of this letter as your acceptance of these terms.

Yours sincerely,

{{signatoryName}}
{{signatoryTitle}}
{{companyName}}`,
  },
];
