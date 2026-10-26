'use client';

import { useEffect } from 'react';
import { apiFetch } from '@/lib/apiFetch.js';
import { subscribeThisDevice } from './push.js';

/**
 * Runs once per signed-in page load: registers the service worker, keeps this device's push
 * subscription linked to the signed-in person (when notifications are already allowed), and
 * schedules the punch reminders for people who punch.
 */
export function DeviceSetup({ user, canPunch, vapidPublicKey }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    (async () => {
      const registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
      if (!registration || cancelled) return;
      if (vapidPublicKey && 'Notification' in window && Notification.permission === 'granted') {
        await subscribeThisDevice(vapidPublicKey).catch(() => {});
      }
      if (canPunch) await scheduleReminders(user).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [user, canPunch, vapidPublicKey]);
  return null;
}

/** Local reminders before the expected in/out time, delivered by the service worker. */
async function scheduleReminders(user) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const day = await apiFetch('/api/attendance/today');
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({
    type: 'SCHEDULE_REMINDERS',
    expectedInTime: user.expectedInTime || '09:30',
    expectedOutTime: user.expectedOutTime || '18:30',
    employeeName: user.name,
    isCheckedIn: day.next !== 'in',
    isCheckedOut: day.next === 'done',
  });
}
