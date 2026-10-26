import { User } from '@/server/models/user.model.js';
import { createSession, SESSION_COOKIE } from '@/server/auth/session.js';

let counter = 0;

/** Creates a user with sensible defaults. */
export async function makeUser(fields = {}) {
  counter += 1;
  return (
    await User.create({
      name: `Person ${counter}`,
      employeeId: `MWG-${String(900 + counter)}`,
      password: 'secret-pass',
      department: 'Operations',
      roleKey: 'employee',
      status: 'active',
      ...fields,
    })
  ).toObject();
}

/** Calls a route handler as a signed-in user (or signed out when user is null). */
export async function call(handler, { method = 'GET', url = '/', user = null, body, params } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (user) headers.cookie = `${SESSION_COOKIE}=${await createSession(user._id)}`;
  const request = new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve(params ?? {}) });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

/** A tiny valid JPEG data URL. */
export const PHOTO = `data:image/jpeg;base64,${Buffer.from('fake-jpeg-bytes').toString('base64')}`;

/** A Date for an India-time clock on a day: at('2026-10-26', '09:20'). */
export const at = (day, clock) => new Date(`${day}T${clock}:00+05:30`);
