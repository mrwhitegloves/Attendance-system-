import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import Counter from '@/models/Counter';

export async function GET() {
  try {
    await dbConnect();
    const users = await User.find({}).sort({ createdAt: -1 });
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, password, department, staffType, isAdmin, expectedInTime, expectedOutTime } = await request.json();
    await dbConnect();

    // 1. Get next sequence for MWG-ID
    const counter = await Counter.findOneAndUpdate(
      { id: 'employeeId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const seqString = String(counter.seq).padStart(3, '0');
    const employeeId = `MWG-${seqString}`;

    // 2. Create User
    const newUser = await User.create({
      name,
      email: email || `${employeeId.toLowerCase()}@mwg.temporary`, // Fallback if no email provided
      employeeId,
      password,
      department,
      staffType,
      isAdmin,
      expectedInTime: expectedInTime || '09:30',
      expectedOutTime: expectedOutTime || '18:30'
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, password, ...rest } = await request.json();
    await dbConnect();
    
    const updateBody: any = { ...rest };
    if (password && password.trim() !== "") {
       updateBody.password = password;
    }
    
    const updatedUser = await User.findByIdAndUpdate(id, updateBody, { new: true });
    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    await dbConnect();
    await User.findByIdAndDelete(id);
    return NextResponse.json({ message: 'User deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
