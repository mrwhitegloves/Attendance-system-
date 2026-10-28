import { NextResponse } from 'next/server';
import { withApi } from '@/server/api.js';
import { loginBody } from '@/server/validation/schemas.js';
import { signIn } from '@/server/services/auth.service.js';
import { sessionCookie } from '@/server/auth/session.js';

// POST /api/auth/login — sign in with employee ID, email or username, and password.
export const POST = withApi({ auth: false, body: loginBody }, async ({ request, body, ip }) => {
  const { token, user } = await signIn(body, {
    userAgent: request.headers.get('user-agent') || '',
    ip,
  });
  const response = NextResponse.json({ user });
  response.headers.set('Set-Cookie', sessionCookie(token));
  return response;
});
