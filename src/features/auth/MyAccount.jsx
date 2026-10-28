'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, LogOut } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';
import {
  disableNotifications,
  enableNotifications,
  isPushSupported,
} from '@/features/notifications/push.js';

/** The signed-in person's own settings: notifications, password, sign out. */
export function MyAccount({ vapidPublicKey }) {
  const router = useRouter();
  const signOut = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <NotificationsCard vapidPublicKey={vapidPublicKey} />
      <div className="space-y-4">
        <PasswordCard onChanged={() => router.replace('/login')} />
        <Button variant="secondary" className="w-full" onClick={signOut}>
          <LogOut size={16} /> Sign out
        </Button>
      </div>
    </div>
  );
}

const noSubscribe = () => () => {};

function NotificationsCard({ vapidPublicKey }) {
  // What the browser says now; after a click, what the click changed.
  const browserState = useSyncExternalStore(
    noSubscribe,
    () => (!isPushSupported() || !vapidPublicKey ? 'unsupported' : Notification.permission),
    () => 'loading',
  );
  const [changed, setChanged] = useState(null);
  const state = changed ?? browserState;
  const enable = async () =>
    setChanged(await enableNotifications(vapidPublicKey).catch(() => 'denied'));
  const disable = async () => {
    await disableNotifications().catch(() => {});
    setChanged('off');
  };
  return (
    <Card>
      <CardHeader
        title="Notifications on this device"
        subtitle="Reminders to punch, leave decisions and messages from HR."
      />
      <div className="flex items-center justify-between gap-3 p-4 text-sm">
        <span className="text-muted">
          {
            {
              granted: 'On',
              denied: 'Blocked in the browser settings',
              unsupported: 'Not available on this device',
              off: 'Off',
              default: 'Off',
              loading: '…',
            }[state]
          }
        </span>
        {state === 'granted' ? (
          <Button variant="secondary" size="sm" onClick={disable}>
            <BellOff size={15} /> Turn off
          </Button>
        ) : state === 'default' || state === 'off' ? (
          <Button size="sm" onClick={enable}>
            <Bell size={15} /> Turn on
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function PasswordCard({ onChanged }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/password', { method: 'POST', body: form });
      onChanged();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Change password" subtitle="You will be signed out on every device." />
      <form onSubmit={submit} className="space-y-3 p-4">
        <Field label="Current password" htmlFor="current-password">
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
            required
          />
        </Field>
        <Field label="New password" htmlFor="new-password" hint="At least 8 characters.">
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            className={inputClass}
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            required
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy}>
          Change password
        </Button>
      </form>
    </Card>
  );
}
