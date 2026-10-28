'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

/** Sends a notification to every active employee's devices. */
export function BroadcastButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const send = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { sent, total } = await apiFetch('/api/push/broadcast', { method: 'POST', body: form });
      setResult(`Sent to ${sent} of ${total} devices.`);
      setForm({ title: '', body: '' });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
          setResult('');
        }}
      >
        <Megaphone size={16} /> Send notification
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Notification to all employees">
        <form onSubmit={send} className="space-y-4">
          <Field label="Title" htmlFor="broadcast-title">
            <input
              id="broadcast-title"
              className={inputClass}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Message" htmlFor="broadcast-body">
            <textarea
              id="broadcast-body"
              rows={3}
              className={`${inputClass} h-auto py-2`}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              maxLength={300}
              required
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          {result && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{result}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={busy}>
              Send
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
