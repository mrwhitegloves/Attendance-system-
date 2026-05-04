import { NextResponse } from 'next/server';
import { sendPushToAdmins } from '@/lib/sendPushNotification';
import { isAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  try {
    const { title, body } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // Pass 'employee' to only send to employee devices
    const result = await sendPushToAdmins(
      { title, body, icon: '/logo.png' },
      'employee'
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Push Broadcast] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
