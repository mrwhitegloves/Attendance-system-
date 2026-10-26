import { apiFetch } from '@/lib/apiFetch.js';

// Browser push for this device. The subscription is saved for the signed-in person.

function keyToBytes(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** Asks for permission if needed and links this device. Returns the permission state. */
export async function enableNotifications(vapidPublicKey) {
  if (!isPushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await subscribeThisDevice(vapidPublicKey);
  return permission;
}

export async function subscribeThisDevice(vapidPublicKey) {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(vapidPublicKey),
    });
  }
  const { endpoint, keys } = subscription.toJSON();
  await apiFetch('/api/push/subscribe', { method: 'POST', body: { endpoint, keys } });
}

export async function disableNotifications() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await apiFetch('/api/push/subscribe', {
    method: 'DELETE',
    body: { endpoint: subscription.endpoint },
  }).catch(() => {});
  await subscription.unsubscribe();
}
