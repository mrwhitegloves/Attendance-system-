import webpush from 'web-push';
import { env } from '../config/env.js';

// The ONLY file that talks to the browser push services.

let configured = false;

export const isPushConfigured = () => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

/** Sends one notification. Returns 'sent', 'gone' (subscription expired) or 'failed'. */
export async function sendPush(subscription, payload) {
  if (!isPushConfigured()) return 'failed';
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload),
    );
    return 'sent';
  } catch (error) {
    if (error?.statusCode === 404 || error?.statusCode === 410) return 'gone';
    console.error('[push] send failed', error?.statusCode ?? error?.message);
    return 'failed';
  }
}
