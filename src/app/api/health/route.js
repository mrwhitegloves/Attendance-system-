import mongoose from 'mongoose';
import { connectDb } from '@/server/db.js';

// GET /api/health — for the Docker health check and Caddy: 200 when the database answers,
// 503 when it does not. Says nothing else (no versions, no settings).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDb();
    await mongoose.connection.db.admin().ping();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
