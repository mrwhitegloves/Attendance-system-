import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import { isAdminRequest, unauthorizedResponse } from '@/lib/adminAuth';

// Max selfie size: 2 MB of raw bytes = ~2.7 MB base64 string
const MAX_SELFIE_BASE64_LENGTH = 2 * 1024 * 1024 * (4 / 3);


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const employeeId = searchParams.get('employeeId');

    // Fetching ALL records (no employeeId filter) is an admin-only operation
    if (!employeeId && !isAdminRequest(request)) {
      return unauthorizedResponse();
    }

    await dbConnect();
    
    // Explicitly reference models to avoid MissingSchemaError in Vercel population
    const _u = User; 
    const _a = Attendance;

    // 1. Run Auto-Checkout for forgotten logouts (from previous days) before fetching currently active logs
    await autoCheckoutMissedLogs(employeeId);

    let query: any = {};
    if (employeeId) query.employeeId = employeeId;
    if (date) query.date = date;

    const records = await Attendance.find(query)
      .populate('userId', 'name mwgId department')
      .sort({ createdAt: -1 });

    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Automatically check out employees who forgot to log out on past dates
async function autoCheckoutMissedLogs(employeeId: string | null) {
  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Query for past "Open" records. If employeeId is passed, limit to that employee.
    let searchParams: any = { date: { $lt: todayStr }, status: { $in: ['Checked In', 'Late'] } };
    if (employeeId) searchParams.employeeId = employeeId;

    const pastOpenLogs = await Attendance.find(searchParams);
    if (pastOpenLogs.length === 0) return;

    // Group to avoid duplicates if someone checked in twice in one day without checking out
    const distinctMissed = new Map();
    for (const log of pastOpenLogs) {
      const key = `${log.employeeId}_${log.date}`;
      if (!distinctMissed.has(key)) distinctMissed.set(key, log);
    }

    const checkoutsToCreate = [];

    for (const [key, log] of distinctMissed.entries()) {
      const hasCheckout = await Attendance.findOne({
        employeeId: log.employeeId,
        date: log.date,
        status: 'Checked Out'
      });

      if (!hasCheckout) {
        checkoutsToCreate.push({
          employeeId: log.employeeId,
          userId: log.userId,
          userName: log.userName,
          date: log.date,
          time: '11:59 PM', // Auto logout at end of the day
          status: 'Checked Out',
          location: 'System Auto Checkout',
          remark: 'System Note: You forgot to log out. System automatically checked you out at midnight.'
        });
      }
    }

    if (checkoutsToCreate.length > 0) {
      await Attendance.insertMany(checkoutsToCreate);
      console.log(`Auto-checked out ${checkoutsToCreate.length} missed logs.`);
    }
  } catch (err) {
    console.error("Auto-checkout error:", err);
  }
}

// 1-Month Retention Policy: Cleanup function
async function cleanupOldImages() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find records with selfies older than 30 days
    const oldRecords = await Attendance.find({
      createdAt: { $lt: thirtyDaysAgo },
      ikFileId: { $ne: null }
    }).limit(5); // Process in small batches

    if (oldRecords.length === 0) return;

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) return;
    const authBuffer = Buffer.from(privateKey + ':').toString('base64');

    for (const record of oldRecords) {
      try {
        // Delete from ImageKit
        const ikDelRes = await fetch(`https://upload.imagekit.io/api/v1/files/${record.ikFileId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Basic ${authBuffer}` }
        });

        if (ikDelRes.ok || ikDelRes.status === 404) {
          // If deleted successfully (or already gone), update DB to reflect image is removed
          record.selfie = null;
          record.ikFileId = null;
          record.remark = record.remark + " (Selfie auto-deleted after 30 days)";
          await record.save();
          console.log(`Auto-deleted old selfie for ${record.employeeId}`);
        }
      } catch (e) {
        console.error("Single Cleanup Error:", e);
      }
    }
  } catch (error) {
    console.error("Global Cleanup Error:", error);
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
          
          // ImageKit expects form-data for robust base64 uploads
          const formData = new FormData();
          formData.append('file', body.selfie);
          formData.append('fileName', `selfie_${body.employeeId || 'id'}_${Date.now()}.png`);
          formData.append('folder', 'attendance-selfies');

          const ikRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authBuffer}`
              // Note: Do NOT set Content-Type header when sending FormData
            },
            body: formData
          });

          if (ikRes.ok) {
            const ikData = await ikRes.json();
            selfieUrl = ikData.url;
            ikFileId = ikData.fileId;
          } else {
            const errorText = await ikRes.text();
            console.error("ImageKit error response:", errorText);
          }
        } catch (ikError) {
          console.error("ImageKit Upload Error:", ikError);
        }
      }
    }

    // 2. Save Updated Record
    const record = await Attendance.create({
      ...body,
      selfie: selfieUrl,
      ikFileId: ikFileId
    });
    
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    console.error("Attendance POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
