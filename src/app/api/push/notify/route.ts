import { NextResponse } from 'next/server';
import { sendPushToAdmins } from '@/lib/sendPushNotification';

/**
 * POST /api/push/notify
 * HTTP wrapper around sendPushToAdmins() — useful for testing via curl/Postman.
 * Internal code should import sendPushToAdmins() directly instead of calling this.
 */
export async function POST(request: Request) {
  try {
    const { title, body, icon, data } = await request.json();
    if (!title || !body) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
    }
    const result = await sendPushToAdmins({ title, body, icon, data });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Push Notify Route] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/push/notify — returns the VAPID public key for client subscription
 */
export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  });
}
