'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { todayKey } from '@/lib/format.js';
import { ACCEPTED_UPLOADS, readFileAsDataUrl } from '@/lib/readFile.js';
import {
  REQUEST_KINDS,
  categoryOptions,
  missedPunches,
  requestKindOptions,
} from '@/config/requestKinds.js';
import { Button, ButtonLink, Card, ErrorText } from '@/components/shared/ui.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';

const emptyFor = (kind) => ({
  kind,
  subject: '',
  details: '',
  category: Object.keys(REQUEST_KINDS[kind].categories ?? {})[0] ?? '',
  amount: '',
  date: kind === 'expense' || REQUEST_KINDS[kind].punches ? todayKey() : '',
  punchInTime: '',
  punchOutTime: '',
});

/** One form for every kind of request; the fields follow the kind. */
export function RequestForm({ initialKind }) {
  const router = useRouter();
  const [form, setForm] = useState(() => emptyFor(initialKind));
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const kind = REQUEST_KINDS[form.kind];
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const dateRequired = form.kind === 'expense' || Boolean(kind.punches);
  const wanted = kind.punches ? missedPunches(form.category) : {};

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { kind: form.kind, details: form.details };
      if (!kind.punches) body.subject = form.subject;
      if (wanted.punchIn) body.punchInTime = form.punchInTime;
      if (wanted.punchOut) body.punchOutTime = form.punchOutTime;
      if (kind.categories) body.category = form.category;
      if (kind.money) body.amount = Number(form.amount);
      if (kind.dateLabel && form.date) body.date = form.date;
      if (file) {
        body.file = await readFileAsDataUrl(file);
        body.fileName = file.name;
      }
      const result = await apiFetch('/api/requests', { method: 'POST', body });
      router.push(`/requests/${result.request._id}`);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={submit} className="space-y-4 p-4 sm:p-5">
        <Field label="Kind of request" htmlFor="request-kind" hint={kind.hint}>
          <Select
            id="request-kind"
            value={form.kind}
            onChange={(event) => setForm(emptyFor(event.target.value))}
            options={requestKindOptions}
          />
        </Field>
        {kind.categories && (
          <Field label={kind.categoryLabel} htmlFor="request-category">
            <Select
              id="request-category"
              value={form.category}
              onChange={change('category')}
              options={categoryOptions(form.kind)}
            />
          </Field>
        )}
        {!kind.punches && (
          <Field label="Subject" htmlFor="request-subject">
            <input
              id="request-subject"
              className={inputClass}
              value={form.subject}
              onChange={change('subject')}
              required
              minLength={3}
              maxLength={120}
              placeholder={form.kind === 'expense' ? 'e.g. Cab to client site, Noida' : ''}
            />
          </Field>
        )}
        {(kind.money || kind.dateLabel) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {kind.money && (
              <Field label="Amount (₹)" htmlFor="request-amount">
                <input
                  id="request-amount"
                  type="number"
                  min="1"
                  max="1000000"
                  step="0.01"
                  className={inputClass}
                  value={form.amount}
                  onChange={change('amount')}
                  required
                />
              </Field>
            )}
            {kind.dateLabel && (
              <Field
                label={dateRequired ? kind.dateLabel : `${kind.dateLabel} (optional)`}
                htmlFor="request-date"
              >
                <input
                  id="request-date"
                  type="date"
                  className={inputClass}
                  value={form.date}
                  onChange={change('date')}
                  required={dateRequired}
                  max={kind.punches ? todayKey() : undefined}
                />
              </Field>
            )}
          </div>
        )}
        {kind.punches && (
          <div className="grid gap-4 sm:grid-cols-2">
            {wanted.punchIn && (
              <Field label="Punch-in time" htmlFor="request-in">
                <input
                  id="request-in"
                  type="time"
                  className={inputClass}
                  value={form.punchInTime}
                  onChange={change('punchInTime')}
                  required
                />
              </Field>
            )}
            {wanted.punchOut && (
              <Field label="Punch-out time" htmlFor="request-out">
                <input
                  id="request-out"
                  type="time"
                  className={inputClass}
                  value={form.punchOutTime}
                  onChange={change('punchOutTime')}
                  required
                />
              </Field>
            )}
          </div>
        )}
        <Field
          label={
            form.kind === 'advance'
              ? 'Why do you need it?'
              : kind.punches
                ? 'Why was it missed? (optional)'
                : 'Details'
          }
          htmlFor="request-details"
        >
          <textarea
            id="request-details"
            className={`${inputClass} min-h-28`}
            value={form.details}
            onChange={change('details')}
            maxLength={2000}
            required={Boolean(kind.detailsRequired)}
          />
        </Field>
        <Field
          label={form.kind === 'expense' ? 'Bill or receipt (PDF or photo)' : 'File (optional)'}
          htmlFor="request-file"
          hint="At most 3 MB."
        >
          <input
            id="request-file"
            type="file"
            accept={ACCEPTED_UPLOADS}
            className="block w-full text-sm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex justify-end gap-2">
          <ButtonLink variant="secondary" href="/requests?box=mine">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={busy}>
            <Send size={15} /> Send
          </Button>
        </div>
      </form>
    </Card>
  );
}
