'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

const FIELDS = [
  ['name', 'Company name'],
  ['signatoryName', 'Who signs letters (name)'],
  ['signatoryTitle', 'Their designation'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['website', 'Website'],
];

export function CompanyForm({ company }) {
  const router = useRouter();
  const [form, setForm] = useState(company);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = Object.fromEntries(
        [...FIELDS.map(([key]) => key), 'address'].map((key) => [key, form[key] ?? '']),
      );
      await apiFetch('/api/settings/company', { method: 'PATCH', body });
      setMessage('Saved.');
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-4 sm:p-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([key, label]) => (
          <Field key={key} label={label} htmlFor={`company-${key}`}>
            <input
              id={`company-${key}`}
              className={inputClass}
              value={form[key] ?? ''}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Field label="Address" htmlFor="company-address">
            <textarea
              id="company-address"
              rows={3}
              className={`${inputClass} h-auto py-2`}
              value={form.address ?? ''}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {message && <span className="text-sm text-success">{message}</span>}
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
