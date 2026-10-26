import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { Session } from '../models/system.models.js';
import { User, PUBLIC_USER_FIELDS } from '../models/user.model.js';

// Sign-in sessions: a random value in an httpOnly cookie, its hash in the `sessions` collection.

export const SESSION_COOKIE = 'hrms_session';

const hash = (token) => createHash('sha256').update(token).digest('hex');

/** Starts a session and returns the cookie value. */
export async function createSession(userId, userAgent = '') {
  const token = randomBytes(32).toString('base64url');
  await Session.create({
    tokenHash: hash(token),
    userId,
    userAgent: userAgent.slice(0, 300),
    expiresAt: new Date(Date.now() + env.SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

/** The signed-in, active user of a cookie value, or null. Never includes the password. */
export async function getSessionUser(token) {
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await User.findOne(
    { _id: session.userId, status: 'active' },
    PUBLIC_USER_FIELDS,
  ).lean();
  if (!user) return null;
  // Remember activity at most every 10 minutes.
  if (Date.now() - session.lastSeenAt.getTime() > 10 * 60 * 1000) {
    await Session.updateOne({ _id: session._id }, { lastSeenAt: new Date() });
  }
  return user;
}

export async function destroySession(token) {
  if (token) await Session.deleteOne({ tokenHash: hash(token) });
}

/** Signs a person out everywhere (used when an account is switched off or the password changes). */
export async function destroyUserSessions(userId) {
  await Session.deleteMany({ userId });
}

/** Reads the session cookie from a request's Cookie header. */
export function tokenFromRequest(request) {
  const header = request.headers.get('cookie') || '';
  const match = header.split(/;\s*/).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
}

/** The Set-Cookie value for a new session, or for removing it (token = null). */
export function sessionCookie(token) {
  const parts = [
    `${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ''}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${token ? env.SESSION_DAYS * 24 * 60 * 60 : 0}`,
  ];
  if (env.isProduction) parts.push('Secure');
  return parts.join('; ');
}
