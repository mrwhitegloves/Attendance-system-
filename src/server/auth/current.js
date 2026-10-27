import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { connectDb } from '../db.js';
import { getSessionUser, SESSION_COOKIE } from './session.js';
import { can } from '../permissions/can.js';
import { loadRoles } from '../permissions/roles.js';

// For server pages and layouts: the signed-in person of this request (read once per request).

export const getCurrentUser = cache(async () => {
  // Cookies first: this marks the page as per-request, and without a cookie no database is needed.
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await connectDb();
  await loadRoles();
  return getSessionUser(token);
});

/** The signed-in person, or a redirect to /login. With a permission, a 404 when it is missing. */
export async function requirePageUser(permission) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (permission && !can(user, permission)) notFound();
  return user;
}

/** Turns Mongo documents (ObjectId, Date) into plain JSON for client components. */
export const toPlain = (value) => JSON.parse(JSON.stringify(value));
