import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import { isAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';
import { sendPushToAdmins } from '@/lib/sendPushNotification';

// Max selfie size: 2 MB of raw bytes = ~2.7 MB base64 string
const MAX_SELFIE_BASE64_LENGTH = 2 * 1024 * 1024 * (4 / 3);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const employeeId = searchParams.get('employeeId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    // Fetching ALL records (no employeeId filter) is an admin-only operation
    if (!employeeId && !isAdminRequest(request)) {
      return unauthorizedResponse();
    }

    await dbConnect();

    // Explicitly reference models to avoid MissingSchemaError in Vercel population
    const _u = User;
    const _a = Attendance;

    // Non-blocking background job: mark missed punch-outs as Absent
    // Only run for admin all-records fetches to avoid overhead on employee fetches
    if (!employeeId) {
      markMissedPunchOutsAsAbsent().catch(e => console.error('Auto-absent error:', e));
    }

    const query: Record<string, any> = {};
    if (employeeId) query.employeeId = employeeId;
    if (date) query.date = date;

    const skip = (page - 1) * limit;

    // Use .lean() for significantly faster reads — returns plain JS objects, not Mongoose Documents
    const records = await Attendance.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Mark employees who did NOT punch out on past working days as ABSENT with a remark.
 * This replaces the old auto-checkout behaviour.
 * Runs non-blocking from the GET handler (fire-and-forget).
 */
async function markMissedPunchOutsAsAbsent() {
  try {
    const now = new Date();
    // Use IST offset (+5:30) for correct date boundary
    const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const todayStr = nowIST.toISOString().slice(0, 10);

    // Find past Checked In / Late records (not today) that are still "open"
    const pastOpenLogs = await Attendance.find({
      date: { $lt: todayStr },
      status: { $in: ['Checked In', 'Late'] }
    }).lean();

    if (pastOpenLogs.length === 0) return;

    // Group by employee+date to deduplicate
    const distinctMissed = new Map<string, any>();
    for (const log of pastOpenLogs) {
      const key = `${log.employeeId}_${log.date}`;
      if (!distinctMissed.has(key)) distinctMissed.set(key, log);
    }

    for (const [, log] of distinctMissed.entries()) {
      // Skip if already has a Checked Out or Absent record for that day
      const existingClose = await Attendance.findOne({
        employeeId: log.employeeId,
        date: log.date,
        status: { $in: ['Checked Out', 'Absent'] }
      }).lean();

      if (!existingClose) {
        await Attendance.create({
          employeeId: log.employeeId,
          userId: log.userId,
          userName: log.userName,
          date: log.date,
          time: '12:00 AM',
          status: 'Absent',
          location: 'System Generated',
          remark: `Marked Absent: Employee punched in at ${log.time} but did not punch out by end of working day (12:00 AM). Please contact admin if this is incorrect.`,
        });
        console.log(`[Auto-Absent] Marked ABSENT: ${log.employeeId} on ${log.date}`);
      }
    }
  } catch (err) {
    console.error('[markMissedPunchOutsAsAbsent] Error:', err);
  }
}

// 1-Month Retention Policy: Cleanup old selfie images from ImageKit
async function cleanupOldImages() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldRecords = await Attendance.find({
      createdAt: { $lt: thirtyDaysAgo },
      ikFileId: { $ne: null }
    }).limit(5);

    if (oldRecords.length === 0) return;

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) return;
    const authBuffer = Buffer.from(privateKey + ':').toString('base64');

    for (const record of oldRecords) {
      try {
        const ikDelRes = await fetch(`https://upload.imagekit.io/api/v1/files/${record.ikFileId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Basic ${authBuffer}` }
        });

        if (ikDelRes.ok || ikDelRes.status === 404) {
          record.selfie = null;
          record.ikFileId = null;
          record.remark = record.remark + ' (Selfie auto-deleted after 30 days)';
          await record.save();
          console.log(`[ImageKit] Auto-deleted old selfie for ${record.employeeId}`);
        }
      } catch (e) {
        console.error('[ImageKit] Single cleanup error:', e);
      }
    }
  } catch (error) {
    console.error('[ImageKit] Global cleanup error:', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await dbConnect();

    // Trigger non-blocking cleanup of old images
    cleanupOldImages();

    // 1. File size check — reject selfies larger than 2 MB
    if (body.selfie && body.selfie.startsWith('data:image')) {
      if (body.selfie.length > MAX_SELFIE_BASE64_LENGTH) {
        return NextResponse.json(
          { error: 'Photo is too large. Please retake a smaller photo (max 2 MB).' },
          { status: 413 }
        );
      }
    }

    // 2. ImageKit Upload Integration
    let selfieUrl = body.selfie;
    let ikFileId = null;

    if (body.selfie && body.selfie.startsWith('data:image')) {
      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

      if (privateKey) {
        try {
          const authBuffer = Buffer.from(privateKey + ':').toString('base64');

          const formData = new FormData();
          formData.append('file', body.selfie);
          formData.append('fileName', `selfie_${body.employeeId || 'id'}_${Date.now()}.png`);
          formData.append('folder', 'attendance-selfies');

          const ikRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${authBuffer}` },
            body: formData
          });

          if (ikRes.ok) {
            const ikData = await ikRes.json();
            selfieUrl = ikData.url;
            ikFileId = ikData.fileId;
          } else {
            const errorText = await ikRes.text();
            console.error('[ImageKit] Upload error response:', errorText);
          }
        } catch (ikError) {
          console.error('[ImageKit] Upload Error:', ikError);
        }
      }
    }

    // 3. Save Record
    const record = await Attendance.create({
      ...body,
      selfie: selfieUrl,
      ikFileId: ikFileId
    });

    // 4. Send real-time push notification to all admin devices (non-blocking)
    const employeeName = body.userName || body.employeeId || 'An employee';
    const punchStatus = body.status; // 'Checked In', 'Checked Out', 'Late'
    
    let notifTitle = '';
    let notifBody = '';
    if (punchStatus === 'Checked In') {
      notifTitle = `✅ ${employeeName} Punched In`;
      notifBody = `Punched in at ${body.time} — ${body.location || 'Location tracked'}`;
    } else if (punchStatus === 'Late') {
      notifTitle = `🟡 ${employeeName} Punched In (Late)`;
      notifBody = `Late punch-in at ${body.time} — ${body.location || 'Location tracked'}`;
    } else if (punchStatus === 'Checked Out') {
      notifTitle = `🚪 ${employeeName} Punched Out`;
      notifBody = `Punched out at ${body.time} — ${body.location || 'Location tracked'}`;
    }

    if (notifTitle) {
      // Call the push utility directly — no HTTP self-fetch needed, works on any host
      sendPushToAdmins({
        title: notifTitle,
        body: notifBody,
        icon: record.selfie || '/logo.png',
        data: {
          employeeId: body.employeeId,
          status: punchStatus,
          time: body.time,
          date: body.date,
        },
      }).catch(e => console.error('[Push] Notify error:', e));
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    console.error('[Attendance POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

