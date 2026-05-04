import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { sendPushToAdmins } from '@/lib/sendPushNotification';

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();

    // Admin backdoor — credentials are stored in .env.local, NOT in source code
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (
      adminUsername && adminPassword &&
      (identifier === adminUsername || identifier === adminEmail) &&
      password === adminPassword
    ) {
       return NextResponse.json({
          name: 'White Gloves Admin',
          employeeId: 'ADMIN-001',
          department: 'Management',
          staffType: 'Management',
          isAdmin: true,
          createdAt: new Date().toISOString()
       });
    }

    await dbConnect();
    const user = await User.findOne({
      $or: [{ email: identifier }, { employeeId: identifier }]
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // In a real app, use bcrypt to compare hashed passwords
    if (user.password && user.password !== password) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    if (!user.isAdmin) {
      sendPushToAdmins({
        title: `🔓 Employee Logged In`,
        body: `${user.name} (${user.employeeId}) has logged into the portal.`,
        icon: '/logo.png',
        data: { employeeId: user.employeeId, action: 'login' },
      }).catch(e => console.error('[Push] Login notify error:', e));
    }

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
