'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDayName } from '@/lib/format.js';
import { Badge, Button, Card, EmptyState, ErrorText } from '@/components/shared/ui.jsx';
import { ConfirmDialog } from '@/components/shared/Dialog.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

const KIND_TONE = { occasion: 'info', festival: 'brand', national: 'success' };

/** The holidays of one year: add, and remove one added by mistake. */
export function HolidaysManager({ year, holidays, kinds }) {
  const router = useRouter();
  const [form, setForm] = useState({ date: `${year}-01-26`, name: '', kind: 'festival' });
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const kindLabel = Object.fromEntries(kinds.map((kind) => [kind.value, kind.label]));

  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/holidays', { method: 'POST', body: form });
      setForm({ ...form, name: '' });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    await apiFetch(`/api/holidays/${removing._id}`, { method: 'DELETE' }).catch((failure) =>
      setError(failure.message),
    );
    setBusy(false);
    setRemoving(null);
    router.refresh();
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <span className="flex items-center gap-2">
          <Link
            href={`/settings/holidays?year=${year - 1}`}
            className="rounded-lg border border-border p-1.5"
            aria-label="Previous year"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="text-sm font-semibold">{year}</span>
          <Link
            href={`/settings/holidays?year=${year + 1}`}
            className="rounded-lg border border-border p-1.5"
            aria-label="Next year"
          >
            <ChevronRight size={16} />
          </Link>
        </span>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className={compactInputClass}
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
            required
            aria-label="Date"
          />
          <input
            className={compactInputClass}
            placeholder="Name (e.g. Diwali)"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            maxLength={80}
            aria-label="Name"
          />
          <Select
            className={compactInputClass}
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value })}
            options={kinds}
            aria-label="Kind"
          />
          <Button type="submit" size="sm" disabled={busy}>
            <Plus size={15} /> Add
          </Button>
        </form>
      </div>
      {error && (
        <div className="p-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {holidays.length === 0 ? (
        <EmptyState
          title={`No holidays in ${year} yet`}
          text="Add them in advance; they are paid days on every salary slip."
        />
      ) : (
        <ul className="divide-y divide-border">
          {holidays.map((holiday) => (
            <li
              key={holiday._id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-3">
                <span className="w-32 text-muted">{formatDayName(holiday.date)}</span>
                <span className="font-medium">{holiday.name}</span>
                <Badge tone={KIND_TONE[holiday.kind]}>{kindLabel[holiday.kind]}</Badge>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setRemoving(holiday)}>
                <Trash2 size={14} /> Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remove ${removing?.name ?? ''}?`}
        text="That day becomes a normal working day again on salary slips filled after this."
        confirmLabel="Remove"
        danger
        busy={busy}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </Card>
  );
}
