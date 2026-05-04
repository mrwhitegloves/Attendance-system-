// MWG Attendance System — Service Worker
// Handles: Push Notifications (admin) + Scheduled Local Reminders (employees) + Offline Cache

const CACHE_NAME = 'mwg-attendance-v2';
const OFFLINE_URLS = ['/', '/login'];

// Track active reminder timers so we can cancel and reschedule
const reminderTimers = [];

// ── Install: pre-cache key pages ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first strategy ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Message: receive schedule from employee app ───────────────────────────────
/**
 * Called from AttendanceSystem.tsx when an employee loads the app.
 * Payload: { type: 'SCHEDULE_REMINDERS', expectedInTime: '09:30', expectedOutTime: '18:30', employeeName: 'Aryan', isCheckedIn: false }
 */
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SCHEDULE_REMINDERS') return;

  const { expectedInTime, expectedOutTime, employeeName, isCheckedIn, isCheckedOut } = event.data;

  // Cancel any previously scheduled reminders for this session
  reminderTimers.forEach((id) => clearTimeout(id));
  reminderTimers.length = 0;

  const firstName = (employeeName || 'there').split(' ')[0];

  const inMessages = [
    `Hi ${firstName}! 🌟 15 mins to go! Shift shuru hone wali hai, jaldi punch in karein! ⏱️`,
    `Namaste ${firstName}! 🙏 Ready for the day? Sirf 15 minute bache hain punch in ke liye! 🚀`,
    `Hello ${firstName}! 👋 Aaj ka din acha jaye! Don't forget to punch in within 15 mins. ⏰`,
    `Hi ${firstName}! ✨ Kaam ka waqt ho gaya hai! Please mark your attendance in 15 mins. 📅`
  ];

  const outMessages = [
    `Great job today, ${firstName}! 🌟 Shift khatam hone mein bas 15 minute baaki hain. Punch out zaroor karein! 🏁`,
    `Thak gaye ${firstName}? 🛋️ Just 15 mins left! Yaad se punch out kar lena. Good job! 👍`,
    `Hello ${firstName}! 👋 Din khatam! Don't forget to punch out in 15 mins. Ghar jaane ka time! 🏠`,
    `Awesome work ${firstName}! ✨ Bas 15 minute aur! Punch out karna mat bhoolna. Take care! 🌇`
  ];

  // Only remind to punch in if employee hasn't punched in yet today
  if (!isCheckedIn && expectedInTime) {
    const randomInMsg = inMessages[Math.floor(Math.random() * inMessages.length)];
    scheduleLocalReminder(expectedInTime, '⏰ Punch In Reminder', randomInMsg, 'reminder-in');
  }

  // Only remind to punch out if employee is currently checked in
  if (isCheckedIn && !isCheckedOut && expectedOutTime) {
    const randomOutMsg = outMessages[Math.floor(Math.random() * outMessages.length)];
    scheduleLocalReminder(expectedOutTime, '🏁 Punch Out Reminder', randomOutMsg, 'reminder-out');
  }
});

/**
 * Formats "09:30" → "9:30 AM", "18:30" → "6:30 PM"
 */
function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Schedules a local notification 15 minutes before the given time (HH:mm).
 * If the reminder time has already passed today, the notification is skipped.
 */
function scheduleLocalReminder(timeStr, title, body, tag) {
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Reminder fires 15 minutes BEFORE the target time
  const totalReminderMinutes = hours * 60 + minutes - 15;
  const remHours = Math.floor(totalReminderMinutes / 60);
  const remMinutes = totalReminderMinutes % 60;

  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(remHours, remMinutes, 0, 0);

  const msUntilReminder = reminderTime.getTime() - now.getTime();

  if (msUntilReminder <= 0) {
    console.log(`[SW Reminder] "${title}" time has already passed for today — skipping`);
    return;
  }

  const minutesLeft = Math.round(msUntilReminder / 60000);
  console.log(`[SW Reminder] Scheduled "${title}" in ${minutesLeft} min`);

  const timerId = setTimeout(() => {
    self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [300, 100, 300, 100, 300],
      tag,                   // same tag replaces old notification of same type
      requireInteraction: true,
      actions: [
        { action: 'open', title: '📲 Open App' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });
  }, msUntilReminder);

  reminderTimers.push(timerId);
}

// ── Push: receive server push notification (admin device) ────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'MWG Attendance', body: 'New activity', icon: '/logo.png', data: {} };

  try {
    if (event.data) data = JSON.parse(event.data.text());
  } catch (e) {
    console.error('[SW] Push parse error:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: '📊 Open Dashboard' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: false,
    tag: `mwg-punch-${Date.now()}`,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Notification Click: open app ──────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); return; }
      return self.clients.openWindow('/');
    })
  );
});
