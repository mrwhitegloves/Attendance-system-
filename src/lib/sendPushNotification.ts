/**
 * lib/sendPushNotification.ts
 *
 * Shared server-side utility for sending Web Push notifications to all admin devices.
 * Import this directly into any API route — no self-HTTP-fetch needed.
 */
import webpush from 'web-push';
import dbConnect from '@/lib/dbConnect';
import PushSubscriptionModel from '@/models/PushSubscription';

// Configure VAPID once — safe to call multiple times (no-op if already set)
let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn('[Push] VAPID keys not configured — push notifications disabled');
    return;
  }
  webpush.setVapidDetails('mailto:admin@whitegloves.in', pub, priv);
  vapidConfigured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, any>;
}

/**
 * Sends a push notification to every stored admin subscription.
 * Automatically removes expired/invalid subscriptions (HTTP 410).
 *
 * @returns { sent, failed, total }
 */
export async function sendPushToAdmins(payload: PushPayload): Promise<{ sent: number; failed: number; total: number }> {
  ensureVapidConfigured();
  if (!vapidConfigured) return { sent: 0, failed: 0, total: 0 };

  await dbConnect();
  const subscriptions = await PushSubscriptionModel.find({}).lean();

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/logo.png',
    data: payload.data || {},
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          payloadStr
        );
      } catch (err: any) {
        // Auto-cleanup expired subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscriptionModel.deleteOne({ endpoint: sub.endpoint });
          console.log(`[Push] Removed stale subscription: ${sub.endpoint.substring(0, 50)}...`);
        }
        throw err;
      }
    })
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`[Push] Sent: ${sent}, Failed: ${failed}, Total: ${subscriptions.length}`);

  return { sent, failed, total: subscriptions.length };
}
