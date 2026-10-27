'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDayName } from '@/lib/format.js';
import { Button, Card, CardHeader, EmptyState, ErrorText } from '@/components/shared/ui.jsx';
import { ConfirmDialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

/** Sundays this employee worked and the paid day off taken for each (recorded by HR). */
export function CompOffs({ userId, items, canManage }) {
  const router = useRouter();
  const [form, setForm] = useState({ workedOn: '', offOn: '', note: '' });
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/users/${userId}/comp-offs`, { method: 'POST', body: form });
      setForm({ workedOn: '', offOn: '', note: '' });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    await apiFetch(`/api/comp-offs/${removing._id}`, { method: 'DELETE' }).catch((failure) =>
      setError(failure.message),
    );
    setBusy(false);
    setRemoving(null);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader
        title="Sunday worked and comp-off"
        subtitle="The day off taken for a Sunday worked is a paid day on the salary slip."
      />
      {canManage && (
        <form
          onSubmit={add}
          className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"
        >
          <Field label="Sunday worked" htmlFor="comp-worked">
            <input
              id="comp-worked"
              type="date"
              className={inputClass}
              value={form.workedOn}
              onChange={(event) => setForm({ ...form, workedOn: event.target.value })}
              required
            />
          </Field>
          <Field label="Day off instead" htmlFor="comp-off">
            <input
              id="comp-off"
              type="date"
              className={inputClass}
              value={form.offOn}
              onChange={(event) => setForm({ ...form, offOn: event.target.value })}
              required
            />
          </Field>
          <Field label="Note (optional)" htmlFor="comp-note">
            <input
              id="comp-note"
              className={inputClass}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              maxLength={200}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            <Plus size={15} /> Add
          </Button>
          {error && (
            <div className="sm:col-span-4">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </form>
      )}
      {items.length === 0 ? (
        <EmptyState title="No Sunday work recorded" />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item._id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span>
                Worked <strong>{formatDayName(item.workedOn)}</strong> → day off{' '}
                <strong>{formatDayName(item.offOn)}</strong>
                {item.note && <span className="text-muted"> · {item.note}</span>}
              </span>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => setRemoving(item)}>
                  <Trash2 size={14} /> Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this comp-off?"
        text="The day off counts as a normal day again (absent if there is no punch) on slips filled after this."
        confirmLabel="Remove"
        danger
        busy={busy}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </Card>
  );
}
