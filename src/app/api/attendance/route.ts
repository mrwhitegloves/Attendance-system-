import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Attendance from '@/models/Attendance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    await dbConnect();
    const records = await Attendance.find({ employeeId }).sort({ createdAt: -1 });

    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    // 1. ImageKit Upload Integration
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
