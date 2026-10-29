import { z } from 'zod';
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  STAFF_TYPES,
  USER_STATUSES,
  WORK_MODES,
} from '../models/user.model.js';
import { LOOKUP_TYPES } from '../models/lookup.model.js';
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES } from '../models/document.model.js';
import { LETTER_KINDS } from '../models/letter.model.js';
import { HOLIDAY_KINDS } from '../models/leaveRules.model.js';
import { SALARY_COMPONENTS } from '../models/salary.model.js';
import { ATTENDANCE_SUMMARY, DEDUCTIONS, EARNINGS } from '../../config/payslipFields.js';
import { ATTENDANCE_STATUSES } from '../models/attendance.model.js';
import { MIN_PASSWORD_LENGTH } from '../auth/password.js';
import { DATE_RANGE_KEYS } from '../../lib/dateRanges.js';
import { PAYOUT_STATUSES, PAY_MODES } from '../../config/payoutOptions.js';
import { REQUEST_KIND_KEYS, REQUEST_STATUSES } from '../../config/requestKinds.js';
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  IDLE_STATUSES,
  RETURN_STATUSES,
} from '../../config/assetOptions.js';
import { CANDIDATE_STATUSES, DROP_REASONS } from '../../config/recruitmentOptions.js';
import { BRAND_KEYS } from '../../config/brands.js';
import { EXIT_STATUSES, EXIT_TYPES } from '../../config/exitOptions.js';
import { PLAN_OUTCOMES, REVIEW_KINDS, REVIEW_STATUSES } from '../../config/performanceOptions.js';

// Input rules of every endpoint. Strict objects: unknown fields are refused.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const month = z.string().regex(/^\d{4}-\d{2}$/, 'use YYYY-MM');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM (24 hours)');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'invalid id');
const page = z.coerce.number().int().min(1).max(10000).default(1);
const text = (max) => z.string().trim().max(max);
// The date filter of every list (lib/dateRanges.js): a named range, or custom from/to days.
const dateRange = {
  range: z.enum(DATE_RANGE_KEYS).optional().catch(undefined),
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
};

export const loginBody = z.strictObject({
  identifier: text(120).min(1, 'enter your employee ID, email or username'),
  password: z.string().min(1, 'enter your password').max(200),
});

export const changePasswordBody = z.strictObject({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200),
});

const optionalDay = z.union([day, z.literal('')]);
const email = z.union([z.literal(''), z.email('enter a valid email')]);

// Fields of the employee file that HR may set. All optional; unknown fields are refused.
const profileFields = {
  employeeCode: text(30),
  phone: text(20),
  email,
  dateOfBirth: optionalDay,
  gender: z.enum([...GENDERS, '']),
  bloodGroup: text(5),
  personalEmail: email,
  currentAddress: text(300),
  permanentAddress: text(300),
  emergencyContact: z.strictObject({
    name: text(100),
    relation: text(40),
    phone: text(20),
  }),
  department: text(60),
  designation: text(60),
  branch: text(60),
  staffType: z.enum(STAFF_TYPES),
  employmentType: z.enum([...EMPLOYMENT_TYPES, '']),
  workMode: z.enum([...WORK_MODES, '']),
  employmentStatus: z.enum([...EMPLOYMENT_STATUSES, '']),
  joiningDate: optionalDay,
  probationEndDate: optionalDay,
  expectedInTime: clock,
  expectedOutTime: clock,
  brandKey: z.enum(BRAND_KEYS),
  // Weekly days off: 0 = Sunday … 6 = Saturday (at most two).
  weeklyOffs: z.array(z.number().int().min(0).max(6)).max(2),
  // Checked against the roles in use by the employee service.
  roleKey: text(40).min(1),
  managerId: z.union([objectId, z.literal(''), z.null()]),
};
const optionalProfile = Object.fromEntries(
  Object.entries(profileFields).map(([key, rule]) => [key, rule.optional()]),
);
const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200);
const name = text(100).min(2, 'enter the full name');

export const createUserBody = z.strictObject({
  ...optionalProfile,
  name,
  password,
  // A candidate's offer letter to link to the new employee (Offer letters screen).
  offerLetterId: objectId.optional(),
  staffType: profileFields.staffType.default('Office Staff'),
  expectedInTime: clock.default('09:30'),
  expectedOutTime: clock.default('18:30'),
  roleKey: profileFields.roleKey.default('employee'),
});

export const updateUserBody = z
  .strictObject({
    ...optionalProfile,
    name: name.optional(),
    password: password.optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');

export const photoBody = z.strictObject({
  photo: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'choose a photo')
    .max(2_800_000, 'the photo is too large'),
});

export const listUsersQuery = z.object({
  q: text(80).optional(),
  status: z.enum([...USER_STATUSES, 'all']).default('active'),
  staffType: z.enum(STAFF_TYPES).optional(),
  roleKey: text(40).optional(),
  department: text(60).optional(),
  file: z.enum(['incomplete', 'complete']).optional(),
  sort: z
    .enum(['name', '-name', 'employeeId', '-employeeId', '-createdAt', 'completeness'])
    .default('employeeId'),
  page,
});

export const lookupTypeQuery = z.object({ type: z.enum(LOOKUP_TYPES) });
export const addLookupBody = z.strictObject({
  type: z.enum(LOOKUP_TYPES),
  name: text(60).min(1, 'enter a name'),
});
export const updateLookupBody = z
  .strictObject({
    name: text(60).min(1, 'enter a name').optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');

export const punchBody = z.strictObject({
  // A JPEG/PNG/WebP photo as a data URL, at most about 2 MB.
  selfie: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'take a photo first')
    .max(2_800_000, 'the photo is too large, please retake it'),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  location: text(300).optional().default(''),
  // Confirms a late punch after the monthly late limit was shown.
  confirmLate: z.boolean().optional().default(false),
});

export const listAttendanceQuery = z.object({
  ...dateRange,
  employeeId: text(20).optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  page,
});

export const dayQuery = z.object({ date: day.optional() });
export const monthQuery = z.object({ month: month.optional() });

export const leaveBody = z
  .strictObject({
    startDate: day,
    endDate: day,
    reason: text(500).min(3, 'write a short reason'),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: 'the end date is before the start date',
    path: ['endDate'],
  });

export const decideLeaveBody = z.strictObject({
  decision: z.enum(['approved', 'rejected']),
  note: text(500).optional().default(''),
  // Required when approving: paid leave costs no salary, unpaid leave costs a full day.
  paid: z.boolean().optional(),
  // With paid leave: take the days from the paid leave balance, for this month.
  useBalance: z.boolean().optional().default(false),
  balanceMonth: month.optional(),
});

export const listLeavesQuery = z.object({
  ...dateRange,
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'all']).default('all'),
  employeeId: text(20).optional(),
  page,
});

export const pushSubscriptionBody = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export const unsubscribeBody = z.object({ endpoint: z.string().max(1000) });

export const broadcastBody = z.strictObject({
  title: text(80).min(1, 'enter a title'),
  body: text(300).min(1, 'enter a message'),
});

export const auditQuery = z.object({
  ...dateRange,
  action: text(60).optional(),
  entityId: text(40).optional(),
  page,
});

// ---- KYC and bank ----
export const kycItemParam = z.enum(['pan', 'aadhaar', 'bank']);
export const kycDetailsBody = {
  pan: z.strictObject({
    number: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'a PAN looks like ABCDE1234F'),
    nameOnPan: text(100).min(2, 'enter the name printed on the PAN'),
  }),
  aadhaar: z.strictObject({
    last4: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'enter only the last 4 digits'),
  }),
  bank: z.strictObject({
    accountHolderName: text(100).min(2, 'enter the account holder name'),
    bankName: text(100).min(2, 'enter the bank name'),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'an IFSC looks like SBIN0001234'),
    accountNumber: z
      .union([
        z
          .string()
          .trim()
          .regex(/^\d{9,18}$/, '9 to 18 digits'),
        z.literal(''),
      ])
      .optional(),
  }),
};
export const fileBody = z.strictObject({
  file: z.string().max(4_300_000, 'the file is larger than 3 MB'),
  fileName: text(120).optional().default(''),
});
export const kycReviewBody = z.strictObject({
  decision: z.enum(['verified', 'rejected']),
  reason: text(300).optional().default(''),
});

// ---- Documents ----
const category = z.enum(Object.keys(DOCUMENT_CATEGORIES));
export const addDocumentTypeBody = z.strictObject({
  name: text(80).min(2, 'enter a name'),
  category,
  required: z.boolean().optional().default(false),
  hasExpiry: z.boolean().optional().default(false),
  needsSignature: z.boolean().optional().default(false),
});
export const updateDocumentTypeBody = z
  .strictObject({
    name: text(80).min(2, 'enter a name').optional(),
    category: category.optional(),
    required: z.boolean().optional(),
    hasExpiry: z.boolean().optional(),
    needsSignature: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');
export const uploadDocumentBody = z.strictObject({
  typeId: objectId,
  file: z.string().max(4_300_000, 'the file is larger than 3 MB'),
  fileName: text(120).optional().default(''),
  expiresOn: optionalDay.optional().default(''),
  signed: z.boolean().optional().default(false),
  note: text(200).optional().default(''),
});
export const reviewDocumentBody = kycReviewBody;
export const listDocumentsQuery = z.object({
  q: text(80).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  category: category.optional(),
  typeId: objectId.optional(),
  expiring: z.enum(['soon']).optional(),
  page,
});

// ---- Letters and company ----
const letterFields = z.strictObject({
  // Typed in rupees, stored in paise.
  ctcAnnual: z.coerce
    .number()
    .min(0)
    .max(100_000_000)
    .transform((rupees) => Math.round(rupees * 100))
    .optional(),
  probationMonths: z.coerce.number().int().min(0).max(24).optional(),
  acceptBy: optionalDay.optional(),
  joiningDate: optionalDay.optional(),
});
const toStoredFields = (fields = {}) => {
  const { ctcAnnual, ...rest } = fields;
  return ctcAnnual === undefined ? rest : { ...rest, ctcAnnualPaise: ctcAnnual };
};
export const createLetterBody = z
  .strictObject({ templateId: objectId, fields: letterFields.optional().default({}) })
  .transform((value) => ({ ...value, fields: toStoredFields(value.fields) }));
export const updateLetterBody = z
  .strictObject({
    subject: text(200).optional(),
    body: z.string().max(20000).optional(),
    fields: letterFields.optional(),
  })
  .transform((value) =>
    value.fields ? { ...value, fields: toStoredFields(value.fields) } : value,
  );
export const respondLetterBody = z.strictObject({
  decision: z.enum(['accepted', 'declined']),
  note: text(300).optional().default(''),
});
export const templateBody = z.strictObject({
  name: text(80).min(2, 'enter a name'),
  kind: z.enum(Object.keys(LETTER_KINDS)),
  subject: text(200).optional().default(''),
  body: z.string().min(10, 'write the letter').max(20000),
});
export const updateTemplateBody = z
  .strictObject({
    name: text(80).min(2).optional(),
    kind: z.enum(Object.keys(LETTER_KINDS)).optional(),
    subject: text(200).optional(),
    body: z.string().min(10).max(20000).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');
const brandWords = z.strictObject({
  name: text(80).optional(),
  website: text(120).optional(),
  email: email.optional(),
  tagline: text(80).optional(),
});

export const companyBody = z.strictObject({
  name: text(120).optional(),
  shortName: text(120).optional(),
  cin: text(30).optional(),
  brands: z.partialRecord(z.enum(BRAND_KEYS), brandWords).optional(),
  brandName: text(80).optional(),
  tagline: text(80).optional(),
  gstNumber: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[0-9A-Z]{15}$/, 'a GST number has 15 letters and digits'),
    ])
    .optional(),
  address: text(400).optional(),
  signatoryName: text(100).optional(),
  signatoryTitle: text(100).optional(),
  phone: text(30).optional(),
  email: email.optional(),
  website: text(120).optional(),
});

// ---- Salary ----
// Monthly amounts typed in rupees, stored in paise.
const monthlyRupees = z.coerce
  .number()
  .min(0, 'cannot be negative')
  .max(10_000_000)
  .transform((rupees) => Math.round(rupees * 100));
export const proposeSalaryBody = z.strictObject({
  effectiveFrom: day,
  reason: text(300).min(3, 'write the reason (joining, annual increment, promotion …)'),
  components: z.strictObject(
    Object.fromEntries(
      Object.keys(SALARY_COMPONENTS).map((key) => [key, monthlyRupees.optional().default(0)]),
    ),
  ),
});
export const decideSalaryBody = z.strictObject({
  decision: z.enum(['approved', 'rejected']),
  note: text(300).optional().default(''),
});

// ---- Roles ----
export const updateRoleBody = z
  .strictObject({
    label: text(60).min(2).optional(),
    permissions: z.record(z.string(), z.union([z.boolean(), z.string(), z.null()])).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');
export const addRoleBody = z.strictObject({
  label: text(60).min(2, 'enter a name'),
  copyFrom: text(40).optional(),
});

// ---- Salary slips ----
const lineAmounts = (lines) =>
  z.strictObject(Object.fromEntries(lines.map((line) => [line.key, monthlyRupees.optional()])));
const dayCount = z.coerce.number().min(0).max(62).multipleOf(0.5, 'use whole or half days');
export const createPayslipBody = z.strictObject({ month });
export const updatePayslipBody = z
  .strictObject({
    employee: z
      .strictObject({
        name: text(100).min(2).optional(),
        code: text(30).optional(),
        designation: text(60).optional(),
        department: text(60).optional(),
        joiningDate: optionalDay.optional(),
        bankName: text(100).optional(),
        pan: z
          .union([
            z.literal(''),
            z
              .string()
              .trim()
              .toUpperCase()
              .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'a PAN looks like ABCDE1234F'),
          ])
          .optional(),
        accountNumber: z
          .union([
            z.literal(''),
            z
              .string()
              .trim()
              .regex(/^\d{9,18}$/, '9 to 18 digits'),
          ])
          .optional(),
      })
      .optional(),
    attendance: z
      .strictObject(
        Object.fromEntries(ATTENDANCE_SUMMARY.map((line) => [line.key, dayCount.optional()])),
      )
      .optional(),
    earnings: lineAmounts(EARNINGS).optional(),
    deductions: lineAmounts(DEDUCTIONS).optional(),
    notes: text(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');
export const reopenPayslipBody = z.strictObject({
  reason: text(300).min(3, 'write why it is re-opened'),
});
export const listPayslipsQuery = z.object({
  ...dateRange,
  month: month.optional(),
  status: z.enum(['draft', 'final']).optional(),
  userId: objectId.optional(),
  q: text(80).optional(),
  page,
});

// ---- Holidays, comp-offs, paid leave balance ----
export const holidaysQuery = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});
export const holidayBody = z.strictObject({
  date: day,
  name: text(80).min(2, 'enter the name of the holiday'),
  kind: z.enum(Object.keys(HOLIDAY_KINDS)).default('festival'),
});
export const compOffBody = z.strictObject({
  workedOn: day,
  offOn: day,
  note: text(200).optional().default(''),
});
export const leaveBalanceBody = z.strictObject({
  days: z.coerce.number().min(-60).max(60).multipleOf(0.5, 'use whole or half days'),
  month,
  reason: text(200).min(3, 'write the reason'),
});

// ---- Requests inbox ----

export const requestBody = z.strictObject({
  kind: z.enum(REQUEST_KIND_KEYS),
  // Not sent for a missed punch (the server writes it).
  subject: text(120).min(3, 'write a short subject').optional(),
  details: text(2000).optional(),
  punchInTime: clock.optional(),
  punchOutTime: clock.optional(),
  category: text(40).optional(),
  // Rupees; stored as paise.
  amount: z.coerce.number().positive('enter the amount').max(1000000).multipleOf(0.01).optional(),
  date: day.optional(),
  file: z.string().max(4_300_000, 'the file is larger than 3 MB').optional(),
  fileName: text(120).optional(),
});

export const decideRequestBody = z.strictObject({
  decision: z.enum(['approved', 'rejected']),
  note: text(500).optional(),
  approvedAmount: z.coerce.number().min(0).max(1000000).multipleOf(0.01).optional(),
  punchInTime: clock.optional(),
  punchOutTime: clock.optional(),
});

export const listRequestsQuery = z.object({
  ...dateRange,
  box: z.enum(['mine', 'decide', 'all']).default('mine'),
  kind: z.enum(REQUEST_KIND_KEYS).optional().catch(undefined),
  status: z.enum([...REQUEST_STATUSES, 'all']).default('all'),
  q: text(80).optional(),
  page,
});

// ---- Company assets ----

const assetDetails = {
  name: text(120).min(2, 'enter the asset name'),
  category: z.enum(Object.keys(ASSET_CATEGORIES)),
  serialNumber: text(80).optional(),
  // Rupees; stored as paise.
  value: z.coerce.number().min(0).max(100000000).multipleOf(0.01).nullable().optional(),
  purchasedOn: z.union([day, z.literal('')]).optional(),
  note: text(500).optional(),
};

export const assetBody = z.strictObject(assetDetails);

export const assetUpdateBody = z.strictObject({
  ...Object.fromEntries(Object.entries(assetDetails).map(([key, rule]) => [key, rule.optional()])),
  status: z.enum(IDLE_STATUSES).optional(),
  statusNote: text(300).optional(),
});

export const assignAssetBody = z.strictObject({
  userId: objectId,
  condition: text(200).optional(),
  note: text(300).optional(),
});

export const returnAssetBody = z.strictObject({
  status: z.enum(RETURN_STATUSES),
  condition: text(200).optional(),
  note: text(300).optional(),
});

export const listAssetsQuery = z.object({
  q: text(80).optional(),
  category: z.enum(Object.keys(ASSET_CATEGORIES)).optional().catch(undefined),
  status: z.enum(Object.keys(ASSET_STATUSES)).optional().catch(undefined),
  employeeId: text(20).optional(),
  page,
});

// ---- Candidates (offer letters for new people) ----

const candidateFields = {
  name,
  email: profileFields.email,
  phone: profileFields.phone,
  address: text(300),
  designation: profileFields.designation,
  department: profileFields.department,
  branch: profileFields.branch,
  staffType: profileFields.staffType,
  employmentType: profileFields.employmentType,
  workMode: profileFields.workMode,
  managerId: profileFields.managerId,
  roleKey: profileFields.roleKey,
  brandKey: profileFields.brandKey,
  expectedJoiningDate: optionalDay,
  source: text(80),
  note: text(1000),
};

export const candidateBody = z.strictObject({
  ...Object.fromEntries(
    Object.entries(candidateFields).map(([key, rule]) => [
      key,
      key === 'name' ? rule : rule.optional(),
    ]),
  ),
});

export const candidateUpdateBody = z
  .strictObject(
    Object.fromEntries(
      Object.entries(candidateFields).map(([key, rule]) => [key, rule.optional()]),
    ),
  )
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');

export const dropCandidateBody = z.strictObject({
  reason: z.enum(Object.keys(DROP_REASONS)),
  note: text(1000).optional(),
});

export const joinCandidateBody = z.strictObject({
  joiningDate: day,
  password,
  // Work email to sign in with (optional; the employee ID always works).
  email: z.union([profileFields.email, z.literal('')]).optional(),
});

export const listCandidatesQuery = z.object({
  ...dateRange,
  status: z.enum([...CANDIDATE_STATUSES, 'all']).default('open'),
  q: text(80).optional(),
  page,
});

// ---- Onboarding ----

export const onboardingTaskBody = z.strictObject({
  done: z.boolean(),
  note: text(300).optional(),
});

export const listOnboardingsQuery = z.object({
  status: z.enum(['in_progress', 'completed', 'all']).default('in_progress'),
  page,
});

// ---- Exits ----

export const exitBody = z.strictObject({
  type: z.enum(Object.keys(EXIT_TYPES)),
  noticeDate: day,
  lastWorkingDay: day,
  reason: text(1000).optional(),
});

export const exitUpdateBody = z
  .strictObject({ lastWorkingDay: day.optional(), reason: text(1000).optional() })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');

export const exitCloseBody = z.strictObject({ note: text(1000).optional() });

export const listExitsQuery = z.object({
  ...dateRange,
  status: z.enum([...EXIT_STATUSES, 'all']).default('notice'),
  page,
});

// ---- Performance ----

const rating = z.coerce.number().int().min(1).max(5);
const reviewFields = {
  kind: z.enum(Object.keys(REVIEW_KINDS)),
  periodStart: day,
  periodEnd: day,
  goals: z
    .array(
      z.strictObject({
        title: text(200).min(2, 'write the goal'),
        target: text(200).optional().default(''),
        achieved: text(200).optional().default(''),
        rating: rating.nullable().optional().default(null),
      }),
    )
    .max(20),
  rating: rating.nullable(),
  strengths: text(2000),
  improvements: text(2000),
  training: text(1000),
};

export const reviewBody = z.strictObject({
  ...Object.fromEntries(Object.entries(reviewFields).map(([key, rule]) => [key, rule.optional()])),
  kind: reviewFields.kind.default('review'),
  periodStart: day,
  periodEnd: day,
});

export const reviewUpdateBody = z
  .strictObject({
    ...Object.fromEntries(
      Object.entries(reviewFields).map(([key, rule]) => [key, rule.optional()]),
    ),
    outcome: z.enum([...Object.keys(PLAN_OUTCOMES), '']).optional(),
    outcomeNote: text(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');

export const acknowledgeReviewBody = z.strictObject({ comment: text(2000).optional() });

export const listReviewsQuery = z.object({
  ...dateRange,
  employeeId: text(20).optional(),
  kind: z.enum(Object.keys(REVIEW_KINDS)).optional().catch(undefined),
  status: z.enum(REVIEW_STATUSES).optional().catch(undefined),
  page,
});

// ---- Offer letter in the founder's format (structured content) ----

const richText = (max) => z.string().trim().max(max);
const offerSection = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('table'),
    title: text(80).min(1, 'write the section title'),
    rows: z.array(z.strictObject({ label: text(80), value: richText(500) })).max(20),
  }),
  z.strictObject({
    type: z.literal('bullets'),
    title: text(80).min(1, 'write the section title'),
    items: z.array(richText(600)).max(30),
  }),
  z.strictObject({
    type: z.literal('paragraphs'),
    title: text(80).min(1, 'write the section title'),
    paragraphs: z.array(richText(3000)).max(10),
  }),
  z.strictObject({
    type: z.literal('terms'),
    title: text(80).min(1, 'write the section title'),
    items: z.array(z.strictObject({ title: text(120), text: richText(3000) })).max(20),
  }),
]);

export const offerContentBody = z.strictObject({
  toName: text(120),
  toAddress: text(300),
  date: day,
  subject: text(200),
  salutation: text(120),
  intro: richText(3000),
  sections: z.array(offerSection).max(12),
  closing: z.array(richText(3000)).max(6),
  signOff: z.strictObject({
    greeting: text(80),
    forLine: text(150),
    name: text(100),
    title: text(150),
    showStamp: z.boolean(),
  }),
  acceptance: z.strictObject({ show: z.boolean(), text: richText(3000), name: text(120) }),
});

export const offerLetterBody = z.strictObject({
  content: offerContentBody,
  brandKey: z.enum(BRAND_KEYS).optional(),
});

// ---- Salary payouts ----

export const listPayoutsQuery = z.object({
  ...dateRange,
  status: z.enum(PAYOUT_STATUSES).optional().catch(undefined),
  month: month.optional().catch(undefined),
  q: text(80).optional(),
  page,
});

export const approvePayoutsBody = z.strictObject({
  ids: z.array(objectId).min(1, 'choose at least one salary').max(500),
});

export const recordPaymentBody = z.strictObject({
  paidOn: day,
  mode: z.enum(Object.keys(PAY_MODES)),
  reference: text(80).optional(),
  note: text(300).optional(),
});

export const bankFileQuery = z.object({ month });

// ---- Salary import from an Excel sheet ----

export const salaryImportBody = z.strictObject({
  file: z.string().max(4_300_000, 'the file is larger than 3 MB'),
  effectiveFrom: day,
  reason: text(300).min(3, 'write the reason (for example: salaries at the start)'),
});

// ---- Full and final settlement ----

export const prepareSettlementBody = z.strictObject({
  noticeDays: z.coerce.number().int().min(0).max(180).optional(),
});

export const saveSettlementBody = z.strictObject({
  noticeDays: z.coerce.number().int().min(0).max(180).optional(),
  lines: z
    .array(
      z.strictObject({
        kind: z.enum(['add', 'deduct']),
        label: text(120).min(2, 'write what the line is for'),
        amount: z.coerce.number().min(0).max(10_000_000).multipleOf(0.01),
        note: text(300).optional(),
      }),
    )
    .max(30),
});

// ---- Reports ----

export const reportQuery = z.object({
  ...dateRange,
  month: month.optional().catch(undefined),
});

// ---- Offer letters screen ----

export const listOfferLettersQuery = z.object({
  q: text(80).optional(),
  status: z.enum(['draft', 'issued', 'accepted', 'declined']).optional().catch(undefined),
  unlinked: z
    .enum(['1', 'true'])
    .optional()
    .transform((value) => Boolean(value)),
  page,
});

export const startOfferLetterBody = z.strictObject({
  name: text(100).min(2, 'enter the full name'),
  phone: text(20).min(10, 'enter a 10-digit mobile number'),
  brandKey: z.enum(BRAND_KEYS).default('mwg'),
});

export const linkOfferLetterBody = z.strictObject({ offerLetterId: objectId });

// ---- Employee KYC links ----

export const listKycLinksQuery = z.object({ q: text(80).optional(), page });

export const createKycLinkBody = z.union([
  z.strictObject({ userId: objectId }),
  z.strictObject({
    name: text(100).min(2, 'enter the full name'),
    phone: text(20).min(10, 'enter a 10-digit mobile number'),
  }),
]);

export const kycFileBody = z.strictObject({
  field: text(40).min(1),
  file: z.string().max(4_300_000, 'the file is larger than 3 MB'),
  fileName: text(200).optional(),
});

const mobile = text(20).regex(/^[+\d][\d\s-]{9,}$/, 'enter a 10-digit mobile number');

export const kycSubmitBody = z.strictObject({
  phone: mobile,
  dateOfBirth: day,
  gender: z.enum(GENDERS, 'choose'),
  bloodGroup: text(5).default(''),
  personalEmail: email.default(''),
  currentAddress: text(300).min(5, 'enter the address'),
  permanentAddress: text(300).min(5, 'enter the address'),
  emergencyContact: z.strictObject({
    name: text(100).min(2, 'enter the name'),
    relation: text(40).min(2, 'enter the relation'),
    phone: mobile,
  }),
  pan: kycDetailsBody.pan,
  aadhaarLast4: kycDetailsBody.aadhaar.shape.last4,
  bank: kycDetailsBody.bank.extend({
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{9,18}$/, '9 to 18 digits'),
  }),
});

// ---- Recently deleted ----

export const listTrashQuery = z.object({
  kind: z
    .enum(['employee', 'offer_letter', 'kyc_link', 'holiday', 'comp_off'])
    .optional()
    .catch(undefined),
  page,
});
