'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatMonth, todayKey } from '@/lib/format.js';
import { Button, Card, CardHeader, EmptyState, ErrorText } from '@/components/shared/ui.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

/** Paid leave balance of one employee: the number, every entry, and (for HR) a form to give days. */
export function LeaveBalance({ userId, data, canAdjust }) {
  const router = useRouter();
  const [form, setForm] = useState({ days: '1', month: todayKey().slice(0, 7), reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/users/${userId}/leave-balance`, {
        method: 'POST',
        body: { ...form, days: Number(form.days) },
      });
      setForm({ ...form, reason: '' });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Paid leave balance"
        subtitle="Days HR gives, minus paid leave taken from it. Shown on the salary slip as balance leaves."
        action={
          <span
            className={`text-2xl font-semibold tabular-nums ${data.balance < 0 ? 'text-danger' : 'text-text'}`}
          >
            {data.balance} {Math.abs(data.balance) === 1 ? 'day' : 'days'}
          </span>
        }
      />
      {canAdjust && (
        <form
          onSubmit={submit}
          className="grid gap-3 border-b border-border p-4 sm:grid-cols-[110px_160px_1fr_auto] sm:items-end"
        >
          <Field label="Days (+ give, − take back)" htmlFor="balance-days">
            <input
              id="balance-days"
              type="number"
              step="0.5"
              min="-60"
              max="60"
              className={inputClass}
              value={form.days}
              onChange={(event) => setForm({ ...form, days: event.target.value })}
              required
            />
          </Field>
          <Field label="For month" htmlFor="balance-month">
            <input
              id="balance-month"
              type="month"
              className={inputClass}
              value={form.month}
              onChange={(event) => setForm({ ...form, month: event.target.value })}
              required
            />
          </Field>
          <Field label="Reason" htmlFor="balance-reason">
            <input
              id="balance-reason"
              className={inputClass}
              placeholder="e.g. 12 paid leaves for 2026"
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              required
              maxLength={200}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            <Plus size={15} /> Save
          </Button>
          {error && (
            <div className="sm:col-span-4">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </form>
      )}
      {data.entries.length === 0 ? (
        <EmptyState title="No paid leave given yet" />
      ) : (
        <ul className="divide-y divide-border">
          {data.entries.map((entry) => (
            <li
              key={entry._id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span>
                <span
                  className={`font-semibold tabular-nums ${entry.days < 0 ? 'text-danger' : 'text-success'}`}
                >
                  {entry.days > 0 ? '+' : ''}
                  {entry.days}
                </span>{' '}
                {entry.reason}
              </span>
              <span className="text-xs text-muted">
                {formatMonth(entry.month)}
                {entry.createdByName ? ` · ${entry.createdByName}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
