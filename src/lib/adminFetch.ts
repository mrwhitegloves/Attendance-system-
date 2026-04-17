/**
 * adminFetch — a thin wrapper around fetch() that automatically
 * adds the Authorization header required by admin-protected API routes.
 *
 * The ADMIN_API_SECRET is exposed to the browser via
 * NEXT_PUBLIC_ADMIN_API_SECRET in .env.local.
 *
 * Usage (identical to fetch):
 *   const res = await adminFetch('/api/users', { method: 'POST', body: JSON.stringify(data) });
 */
export function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const secret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET || '';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
      ...(options.headers || {}),
    },
  });
}
