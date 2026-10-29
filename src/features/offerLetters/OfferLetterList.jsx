'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { useListParams } from '@/lib/useListParams.js';
import { formatDateTime } from '@/lib/format.js';
import { BRANDS } from '@/config/brands.js';
import { Badge, Button, Card, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { ConfirmDialog, Dialog } from '@/components/shared/Dialog.jsx';
import { compactInputClass, Field, inputClass, Select } from '@/components/shared/form.jsx';
import { brandOptions } from '@/config/brands.js';
import { LETTER_STATUS } from '@/features/letters/labels.js';

/** The Offer letters screen: every offer letter in use, a new one from a name and phone. */
export function OfferLetterList({ result }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [search, setSearch] = useState(get('q'));
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/letters/${deleting._id}`, { method: 'DELETE' });
      setDeleting(null);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <FileText size={16} /> New offer letter
        </Button>
      </div>
      {error && (
        <div className="mb-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      <Card className={isPending ? 'opacity-60' : ''}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              set({ q: search.trim() });
            }}
            className="min-w-0 flex-1 sm:max-w-xs"
          >
            <input
              className={`${compactInputClass} w-full`}
              placeholder="Search name, phone, employee ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search"
            />
          </form>
          <Select
            className={compactInputClass}
            value={get('status', '')}
            onChange={(event) => set({ status: event.target.value })}
            options={[
              { value: '', label: 'Every status' },
              ...['draft', 'issued', 'accepted', 'declined'].map((value) => ({
                value,
                label: LETTER_STATUS[value].label,
              })),
            ]}
            aria-label="Status"
          />
        </div>
        <DataTable
          rows={result.items}
          onRowClick={(row) => router.push(`/letters/${row._id}`)}
          empty={{
            title: 'No offer letters yet',
            text: 'Start one with the name and phone of the candidate.',
          }}
          columns={[
            {
              key: 'person',
              label: 'Person',
              render: (row) => (
                <div>
                  <p className="font-medium">{row.person.name}</p>
                  <p className="text-xs text-muted">
                    {[row.person.phone, row.person.employeeId].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              ),
            },
            {
              key: 'employee',
              label: 'Employee',
              mobile: false,
              render: (row) =>
                row.person.userId ? (
                  <Badge tone="success">Linked to {row.person.employeeId}</Badge>
                ) : (
                  <span className="text-muted">Candidate</span>
                ),
            },
            {
              key: 'brand',
              label: 'Company',
              mobile: false,
              render: (row) => (
                <span className="text-muted">{BRANDS[row.brandKey]?.label ?? '—'}</span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge tone={LETTER_STATUS[row.status].tone}>
                  {LETTER_STATUS[row.status].label}
                  {row.version > 1 ? ` · v${row.version}` : ''}
                </Badge>
              ),
            },
            {
              key: 'updated',
              label: 'Changed',
              mobile: false,
              render: (row) => <span className="text-muted">{formatDateTime(row.updatedAt)}</span>,
            },
            {
              key: 'actions',
              label: '',
              render: (row) => (
                <button
                  type="button"
                  aria-label={`Delete the offer letter of ${row.person.name}`}
                  title="Delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleting(row);
                  }}
                  className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              ),
            },
          ]}
        />
        <Pagination page={result.page} pages={result.pages} total={result.total} />
      </Card>
      <NewOfferDialog open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this offer letter?"
        text={
          deleting
            ? `The offer letter of ${deleting.person.name} and all its versions move to Settings → Recently deleted (restorable for 90 days).`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

/** Name and phone first; the letter itself is filled in on the builder screen. */
function NewOfferDialog({ open, onClose }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', brandKey: 'mwg' });
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setExisting(null);
    try {
      const { letter } = await apiFetch('/api/offer-letters', { method: 'POST', body: form });
      router.push(`/letters/${letter._id}/build`);
    } catch (failure) {
      setError(failure.message);
      if (failure.data?.letterId) setExisting(failure.data.letterId);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New offer letter"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="new-offer" disabled={busy}>
            {busy && <Spinner />} Create offer letter
          </Button>
        </>
      }
    >
      <form id="new-offer" onSubmit={submit} className="space-y-3">
        <Field label="Candidate's full name" htmlFor="offer-name">
          <input
            id="offer-name"
            className={inputClass}
            required
            minLength={2}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field
          label="Mobile number"
          htmlFor="offer-phone"
          hint="One offer letter per mobile number."
        >
          <input
            id="offer-phone"
            type="tel"
            className={inputClass}
            required
            minLength={10}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>
        <Field label="Company" htmlFor="offer-brand">
          <Select
            id="offer-brand"
            value={form.brandKey}
            onChange={(event) => setForm({ ...form, brandKey: event.target.value })}
            options={brandOptions}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        {existing && (
          <Button variant="secondary" onClick={() => router.push(`/letters/${existing}`)}>
            Open the existing offer letter
          </Button>
        )}
      </form>
    </Dialog>
  );
}
