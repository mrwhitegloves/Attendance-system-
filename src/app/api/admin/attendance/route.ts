
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Attendance from '@/models/Attendance';
import User from '@/models/User';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const employeeId = searchParams.get('employeeId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    await dbConnect();

    const query: Record<string, any> = {};
    if (date) {
      query.date = { $regex: date };
    } else if (!employeeId) {
      // Default: today's logs only when no filters set
      query.date = new Date().toLocaleDateString('en-CA');
    }
    if (employeeId) query.employeeId = employeeId;

    const skip = (page - 1) * limit;

    const logs = await Attendance.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Enrich with user info
    const employeeIds = [...new Set(logs.map((l: any) => l.employeeId))];
    const users = await User.find(
      { employeeId: { $in: employeeIds } },
      'name employeeId department'
    ).lean();
    const userMap = users.reduce((acc: any, u: any) => ({ ...acc, [u.employeeId]: u }), {});

    const enrichedLogs = logs.map((l: any) => ({
      ...l,
      userName: userMap[l.employeeId]?.name || l.userName || 'Unknown',
      department: userMap[l.employeeId]?.department || 'N/A'
    }));

    return NextResponse.json(enrichedLogs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
