import { NextResponse } from 'next/server';

// Sends signed-out visitors to /login. This is only a convenience: every page and API route
// checks the session itself on the server.

const SESSION_COOKIE = 'hrms_session';

export function proxy(request) {
  const { pathname, search } = request.nextUrl;
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the sign-in page, the API, Next's files and public files.
  matcher: ['/((?!login|api|_next/static|_next/image|.*\\..*).*)'],
};
