import { User, PUBLIC_USER_FIELDS } from '../models/user.model.js';
import { passwordsMatch } from '../auth/password.js';
import { createSession, destroyUserSessions } from '../auth/session.js';
import { createAppError } from '../lib/errors.js';
import { recordAudit } from './audit.service.js';
import { notifyPunchWatchers } from './push.service.js';
import { can } from '../permissions/can.js';

// Signing in and out, and the person's own password.

/** Checks the sign-in and starts a session. Returns { token, user } (user without password). */
export async function signIn({ identifier, password }, { userAgent, ip } = {}) {
  const value = identifier.trim();
  const user = await User.findOne({
    $or: [{ employeeId: value.toUpperCase() }, { email: value.toLowerCase() }, { username: value }],
  }).lean();
  // One message for every failure, so nobody can find out which IDs exist.
  if (!user || !passwordsMatch(password, user.password)) {
    throw createAppError(401, 'Wrong employee ID or password.', 'wrong_credentials');
  }
  if (user.status !== 'active') {
    throw createAppError(403, 'This account is switched off. Please contact HR.', 'inactive');
  }
  const token = await createSession(user._id, userAgent);
  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
  await recordAudit(user, { action: 'auth.sign_in', entity: 'user', entityId: user._id, ip });

  if (!can(user, 'notifications.punches')) {
    notifyPunchWatchers({
      title: 'Employee signed in',
      body: `${user.name} (${user.employeeId}) signed in.`,
      icon: '/logo.png',
      data: { url: `/employees/${user._id}` },
    }).catch(() => {});
  }
  const safe = await User.findById(user._id, PUBLIC_USER_FIELDS).lean();
  return { token, user: safe };
}

export async function changeOwnPassword(user, { currentPassword, newPassword }) {
  const stored = await User.findById(user._id, 'password').lean();
  if (!passwordsMatch(currentPassword, stored?.password)) {
    throw createAppError(400, 'The current password is wrong.');
  }
  await User.updateOne({ _id: user._id }, { password: newPassword });
  await destroyUserSessions(user._id);
  await recordAudit(user, {
    action: 'user.password_changed',
    entity: 'user',
    entityId: user._id,
    summary: 'Changed own password',
  });
}
