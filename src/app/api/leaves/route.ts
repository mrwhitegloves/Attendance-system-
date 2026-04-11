import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import LeaveRequest from '@/models/LeaveRequest';
import Attendance from '@/models/Attendance';
import User from '@/models/User';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const userId = searchParams.get('userId');

    await dbConnect();
    let query: any = {};
    if (employeeId) query.employeeId = employeeId;
    if (userId) query.userId = userId;

    const leaves = await LeaveRequest.find(query)
      .populate('userId', 'name mwgId department')
      .sort({ createdAt: -1 });
    return NextResponse.json(leaves);
  } catch (error: any) {
    console.error("Leaves GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await dbConnect();
    const newLeave = await LeaveRequest.create(body);
    return NextResponse.json(newLeave, { status: 201 });
  } catch (error: any) {
    console.error("Leaves POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, status, adminNote } = await request.json();
    await dbConnect();

    const leave = await LeaveRequest.findById(id);
    if (!leave) return NextResponse.json({ error: 'Leave not found' }, { status: 404 });

    const statusLower = status.toLowerCase();
    leave.status = statusLower;
    leave.adminNote = adminNote || '';
    leave.processedAt = new Date();
    await leave.save();

    if (statusLower === 'approved') {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const dateList = [];
      let current = new Date(start);

      while (current <= end) {
        dateList.push(new Date(current).toLocaleDateString('en-CA'));
        current.setDate(current.getDate() + 1);
      }

      // Create "Leave" entry in Attendance for each day
      for (const d of dateList) {
        // Check if already exists to avoid duplicates
        const filter = leave.userId ? { userId: leave.userId, date: d } : { employeeId: leave.employeeId, date: d };
        const existing = await Attendance.findOne(filter);
        if (!existing) {
          await Attendance.create({
            userId: leave.userId,
            employeeId: leave.employeeId,
            date: d,
            time: '09:00', // Default time
            status: 'Leave',
            location: 'System Approved Leave',
            remark: `Approved Leave: ${leave.reason} - Admin: ${adminNote || 'No note'}`,
          });
        } else if (existing.status !== 'Leave') {
           existing.status = 'Leave';
           existing.remark = `Marked as Leave (Previously ${existing.status}) - Admin: ${adminNote || 'No note'}`;
           await existing.save();
        }
      }
    }

    return NextResponse.json(leave);
  } catch (error: any) {
    console.error("Leaves PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
