"use client";

import { useEffect } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

/**
 * Converts a VAPID base64 URL-safe key to an ArrayBuffer for the browser API.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

/**
 * PushNotificationManager
 *
 * Mounts invisibly in the layout. On every page load it:
 *
 *  FOR ADMINS:
 *   1. Registers /sw.js
 *   2. Subscribes to Web Push (server-push) so the server can send real-time
 *      alerts when any employee punches in or out.
 *
 *  FOR EMPLOYEES:
 *   1. Registers /sw.js
 *   2. Requests notification permission (required for local SW notifications)
 *   3. The actual reminder scheduling is done by AttendanceSystem.tsx which
 *      posts a SCHEDULE_REMINDERS message to the SW with the employee's times.
 *
 * No UI is rendered — this is a side-effect-only component.
 */
export default function PushNotificationManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // 1. Register service worker for everyone (admins + employees)
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[SW] Registered, scope:", reg.scope))
      .catch((err) => console.error("[SW] Registration failed:", err));

    // 2. Read user profile from localStorage
    const raw = localStorage.getItem("user");
    if (!raw) return;

    let profile: any;
    try { profile = JSON.parse(raw); } catch { return; }

    if (!("Notification" in window) || !("PushManager" in window)) return;

    const init = async () => {
      // Request notification permission for both admins and employees
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("[Push] Permission not granted");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // ── Subscribe to server-push for EVERYONE (Admins & Employees) ─────────
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const subJSON = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          endpoint: subJSON.endpoint, 
          keys: subJSON.keys,
          role: profile?.isAdmin ? 'admin' : 'employee'
        }),
      });
      console.log(`[Push] ${profile?.isAdmin ? 'Admin' : 'Employee'} server-push subscription saved ✓`);
    };

    navigator.serviceWorker.ready.then(init).catch((err) =>
      console.error("[Push] Init error:", err)
    );
  }, []);

  return null; // No UI — pure side effects
}
