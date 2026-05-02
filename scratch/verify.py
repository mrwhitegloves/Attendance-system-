import sys
sys.stdout.reconfigure(encoding='utf-8')

checks = {
    # PWA files
    'public/manifest.json': ['MWG Attendance System', 'standalone', 'manifest'],
    'public/sw.js': ['push', 'notificationclick', 'skipWaiting', 'showNotification'],
    # Push API
    'src/app/api/push/subscribe/route.ts': ['PushSubscriptionModel', 'findOneAndUpdate', 'upsert'],
    'src/app/api/push/notify/route.ts': ['webpush', 'sendNotification', 'VAPID_PRIVATE_KEY', '410'],
    # Model
    'src/models/PushSubscription.ts': ['endpoint', 'p256dh', 'auth'],
    # Attendance POST triggers push
    'src/app/api/attendance/route.ts': ['push/notify', 'Punched In', 'Punched Out'],
    # PushNotificationManager
    'src/components/PushNotificationManager.tsx': ['serviceWorker', 'pushManager', 'subscribe', 'api/push/subscribe'],
    # AdminDashboard has NotificationToggleButton
    'src/components/AdminDashboard.tsx': ['NotificationToggleButton', 'urlBase64ToUint8Array', 'Enable Notifs', 'Notifs ON'],
    # Layout registers SW
    'src/app/layout.tsx': ['PushNotificationManager', 'manifest.json', 'mobile-web-app-capable'],
    # Env has VAPID keys
    '.env.local': ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_BASE_URL'],
    # Vercel has SW headers
    'vercel.json': ['sw.js', 'Service-Worker-Allowed'],
}

all_ok = True
for file, keywords in checks.items():
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    for kw in keywords:
        found = kw in content
        status = 'OK  ' if found else 'MISS'
        if not found:
            all_ok = False
        print(f'{status}: {repr(kw)[:45]} in {file.split("/")[-1]}')

print()
print('ALL CHECKS PASSED!' if all_ok else 'SOME CHECKS FAILED!')
