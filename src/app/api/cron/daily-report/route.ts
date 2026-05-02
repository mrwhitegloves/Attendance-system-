/**
 * This file is intentionally minimal.
 * The WhatsApp daily report feature was removed.
 * Real-time push notifications now handle admin alerts via PWA (Web Push API).
 *
 * See:
 *   /api/push/subscribe  — admin push subscription
 *   /api/push/notify     — server sends push to all admin devices
 *   /public/sw.js        — service worker that displays notifications
 */
export async function GET() {
  return new Response('Push notifications are handled via PWA. See /api/push/notify.', {
    status: 200,
  });
}
