import { NextResponse } from 'next/server';
import { withApi } from '@/server/api.js';
import { changePasswordBody } from '@/server/validation/schemas.js';
import { changeOwnPassword } from '@/server/services/auth.service.js';
import { sessionCookie } from '@/server/auth/session.js';

// POST /api/auth/password — change own password (signs out every device).
export const POST = withApi({ body: changePasswordBody }, async ({ user, body }) => {
  await changeOwnPassword(user, body);
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', sessionCookie(null));
  return response;
});
