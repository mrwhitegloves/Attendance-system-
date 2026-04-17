/**
 * Admin API Auth Helper
 *
 * Admin-only routes require the caller to send:
 *   Authorization: Bearer <ADMIN_API_SECRET>
 *
 * The secret lives in .env.local and is sent automatically
 * by the AdminDashboard via the `adminFetch` helper.
 *
 * Usage inside a route handler:
 *   if (!isAdminRequest(request)) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 */

import { NextResponse } from 'next/server';

export function isAdminRequest(request: Request): boolean {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) return false; // If secret not set, deny all admin access

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return token === secret;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
}
