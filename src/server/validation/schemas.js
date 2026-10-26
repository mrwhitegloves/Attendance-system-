import { z } from 'zod';
import { STAFF_TYPES, USER_STATUSES } from '../models/user.model.js';
import { ROLE_KEYS } from '../permissions/roles.js';
import { ATTENDANCE_STATUSES } from '../models/attendance.model.js';
import { MIN_PASSWORD_LENGTH } from '../auth/password.js';

// Input rules of every endpoint. Strict objects: unknown fields are refused.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const month = z.string().regex(/^\d{4}-\d{2}$/, 'use YYYY-MM');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM (24 hours)');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'invalid id');
const page = z.coerce.number().int().min(1).max(10000).default(1);
const text = (max) => z.string().trim().max(max);

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

const userFields = {
  name: text(100).min(2, 'enter the full name'),
  phone: text(20).optional().default(''),
  email: z
    .union([z.literal(''), z.email('enter a valid email')])
    .optional()
    .default(''),
  department: text(60).optional().default(''),
  staffType: z.enum(STAFF_TYPES).default('Office Staff'),
  expectedInTime: clock.default('09:30'),
  expectedOutTime: clock.default('18:30'),
  roleKey: z.enum(ROLE_KEYS).default('employee'),
  managerId: z.union([objectId, z.literal(''), z.null()]).optional(),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200),
};

export const createUserBody = z.strictObject(userFields);

export const updateUserBody = z
  .strictObject({
    ...userFields,
    name: userFields.name.optional(),
    phone: text(20).optional(),
    email: z.union([z.literal(''), z.email('enter a valid email')]).optional(),
    department: text(60).optional(),
    staffType: z.enum(STAFF_TYPES).optional(),
    expectedInTime: clock.optional(),
    expectedOutTime: clock.optional(),
    roleKey: z.enum(ROLE_KEYS).optional(),
    password: userFields.password.optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'nothing to change');

export const listUsersQuery = z.object({
  q: text(80).optional(),
  status: z.enum([...USER_STATUSES, 'all']).default('active'),
  staffType: z.enum(STAFF_TYPES).optional(),
  roleKey: z.enum(ROLE_KEYS).optional(),
  sort: z.enum(['name', '-name', 'employeeId', '-employeeId', '-createdAt']).default('employeeId'),
  page,
});

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
  from: day.optional(),
  to: day.optional(),
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
});

export const listLeavesQuery = z.object({
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
  action: text(60).optional(),
  entityId: text(40).optional(),
  page,
});
