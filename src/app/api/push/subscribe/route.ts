import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import PushSubscriptionModel from '@/models/PushSubscription';

/**
 * POST /api/push/subscribe
 * Saves admin's push subscription to DB.
 */
export async function POST(request: Request) {
  try {
    const subscription = await request.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    await dbConnect();

    // Upsert — update if endpoint exists, otherwise create
    await PushSubscriptionModel.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        adminId: 'admin',
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Push Subscribe] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 * Removes a push subscription (unsubscribe).
 */
export async function DELETE(request: Request) {
  try {
    const { endpoint } = await request.json();
    await dbConnect();
    await PushSubscriptionModel.deleteOne({ endpoint });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
