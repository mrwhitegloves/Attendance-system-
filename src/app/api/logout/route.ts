import { NextResponse } from 'next/server';
import { sendPushToAdmins } from '@/lib/sendPushNotification';

export async function POST(request: Request) {
  try {
    const { employeeId, name } = await request.json();

    if (employeeId && name) {
      sendPushToAdmins({
        title: `👋 Employee Logged Out`,
        body: `${name} (${employeeId}) has logged out of the portal.`,
        icon: '/logo.png',
        data: { employeeId, action: 'logout' },
      }).catch(e => console.error('[Push] Logout notify error:', e));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
