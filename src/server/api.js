import { NextResponse } from 'next/server';
import { connectDb } from './db.js';
import { getSessionUser, tokenFromRequest } from './auth/session.js';
import { requirePermission } from './permissions/can.js';
import { createAppError } from './lib/errors.js';

// Every API route is built with withApi(): database, sign-in, permission, validation and
// error answers in one place. Route files stay thin: read input, call a service, answer.

/**
 * @param {{ auth?: boolean, permission?: string, body?: import('zod').ZodType, query?: import('zod').ZodType }} options
 * @param {(ctx: { request: Request, user: object|null, body: any, query: any, params: any, ip: string }) => Promise<any>} handler
 */
export function withApi(options, handler) {
  const { auth = true, permission, body: bodySchema, query: querySchema } = options;
  return async (request, context) => {
    try {
      await connectDb();
      const user = auth ? await getSessionUser(tokenFromRequest(request)) : null;
      if (auth && !user) throw createAppError(401, 'Please sign in again.');
      if (permission) requirePermission(user, permission);

      const url = new URL(request.url);
      const query = querySchema
        ? parse(querySchema, Object.fromEntries(url.searchParams))
        : Object.fromEntries(url.searchParams);
      const body = bodySchema ? parse(bodySchema, await readJson(request)) : undefined;
      const params = context?.params ? await context.params : {};
      const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();

      const result = await handler({ request, user, body, query, params, ip });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path?.join('.');
  throw createAppError(
    400,
    field ? `${field}: ${issue.message}` : issue?.message || 'Invalid input.',
  );
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw createAppError(400, 'The request body must be JSON.');
  }
}

export function errorResponse(error) {
  if (error?.isAppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'value';
    return NextResponse.json(
      { error: `This ${field} is already used.`, code: 'duplicate' },
      { status: 409 },
    );
  }
  console.error('[api] unexpected error', error);
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.', code: 'error' },
    { status: 500 },
  );
}
