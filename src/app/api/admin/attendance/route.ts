
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Attendance from '@/models/Attendance';
import User from '@/models/User';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Filter by date (YYYY-MM-DD or today)
    const employeeId = searchParams.get('employeeId');

    await dbConnect();
    
    let query: any = {};
    if (date) {
      query.date = { $regex: date };
    } else if (!employeeId) {
       // Default to today's logs only if no employee filter
       query.date = new Date().toLocaleDateString('en-CA');
    }
    if (employeeId) query.employeeId = employeeId;

    const logs = await Attendance.find(query).sort({ date: -1, lastPunch: -1 }).limit(100);
    
    // Enrich with user name
    const employeeIds = [...new Set(logs.map(l => l.employeeId))];
    const users = await User.find({ employeeId: { $in: employeeIds } }, 'name employeeId department');
    const userMap = users.reduce((acc, u) => ({ ...acc, [u.employeeId]: u }), {});

    const enrichedLogs = logs.map(l => ({
      ...l.toObject(),
      userName: userMap[l.employeeId]?.name || 'Unknown',
      department: userMap[l.employeeId]?.department || 'N/A'
    }));

    return NextResponse.json(enrichedLogs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
