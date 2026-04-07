import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();

    // Admin backdoor for White Gloves Management
    if ((identifier === 'whitegloves' || identifier === 'whitegloves@gmail.com') && password === 'dwmt5088') {
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

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
