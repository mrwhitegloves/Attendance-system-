import { NextResponse } from 'next/server';
import { withApi } from '@/server/api.js';
import { destroySession, sessionCookie, tokenFromRequest } from '@/server/auth/session.js';

// POST /api/auth/logout — ends this browser's session.
export const POST = withApi({ auth: false }, async ({ request }) => {
  await destroySession(tokenFromRequest(request));
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', sessionCookie(null));
  return response;
});
