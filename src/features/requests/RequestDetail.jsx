'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Paperclip, Undo2, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime, formatDay, formatRupees } from '@/lib/format.js';
import {
  REQUEST_KINDS,
  REQUEST_STATUS_TONE,
  categoryLabel,
  requestStatusLabel,
} from '@/config/requestKinds.js';
import { Badge, Button, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { ConfirmDialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

/** One request: what was asked, the files, the decision, and the decide / withdraw actions. */
export function RequestDetail({ request }) {
  const kind = REQUEST_KINDS[request.kind];
  const rows = [
    ['Employee', `${request.employeeName} (${request.employeeId})`],
    kind.categories && [kind.categoryLabel, categoryLabel(request.kind, request.category)],
    kind.money && ['Amount asked', formatRupees(request.amountPaise)],
    kind.dateLabel && request.date && [kind.dateLabel, formatDay(request.date)],
    ['Sent', formatDateTime(request.createdAt)],
  ].filter(Boolean);

  return (
    <>
      <Link
        href="/requests"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={15} /> Requests
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            {request.number} · {kind.label}
          </p>
          <h1 className="text-xl font-semibold">{request.subject}</h1>
        </div>
        <Badge tone={REQUEST_STATUS_TONE[request.status]}>
          {requestStatusLabel(request.kind, request.status)}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <dl className="divide-y divide-border text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {request.details && (
            <p className="whitespace-pre-wrap border-t border-border px-4 py-3 text-sm">
              {request.details}
            </p>
          )}
          {request.attachments.length > 0 && (
            <ul className="border-t border-border px-4 py-3 text-sm">
              {request.attachments.map((file) => (
                <li key={file.fileName}>
                  {file.url ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-brand hover:underline"
                    >
                      <Paperclip size={14} /> {file.fileName}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Paperclip size={14} /> {file.fileName} (storage not set up)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          {request.decidedAt && <Decision request={request} kind={kind} />}
          {request.canDecide && <DecidePanel request={request} kind={kind} />}
          {request.canCancel && <Withdraw request={request} />}
        </div>
      </div>
    </>
  );
}

function Decision({ request, kind }) {
  return (
    <Card>
      <CardHeader
        title={requestStatusLabel(request.kind, request.status)}
        subtitle={`${request.decidedByName} · ${formatDateTime(request.decidedAt)}`}
      />
      <div className="space-y-2 px-4 pb-4 text-sm">
        {kind.money && request.status === 'approved' && (
          <p>
            Approved amount:{' '}
            <strong className="tabular-nums">{formatRupees(request.approvedAmountPaise)}</strong>
          </p>
        )}
        {request.decisionNote && <p className="whitespace-pre-wrap">{request.decisionNote}</p>}
      </div>
    </Card>
  );
}

function DecidePanel({ request, kind }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState(kind.money ? String(request.amountPaise / 100) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (decision) => {
    setBusy(true);
    setError('');
    try {
      const body = { decision };
      if (note.trim()) body.note = note.trim();
      if (kind.money && decision === 'approved') body.approvedAmount = Number(amount);
      await apiFetch(`/api/requests/${request._id}/decide`, { method: 'POST', body });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Your decision" subtitle="The employee gets a notification." />
      <div className="space-y-3 px-4 pb-4">
        {kind.money && (
          <Field
            label="Amount to approve (₹)"
            htmlFor="approve-amount"
            hint="You may approve less than asked."
          >
            <input
              id="approve-amount"
              type="number"
              min="0"
              step="0.01"
              max={request.amountPaise / 100}
              className={inputClass}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
        )}
        <Field
          label={`Note for the employee (needed to ${kind.rejectLabel.toLowerCase()})`}
          htmlFor="decide-note"
        >
          <textarea
            id="decide-note"
            className={`${inputClass} min-h-20`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => decide('rejected')}
          >
            <X size={15} /> {kind.rejectLabel}
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide('approved')}>
            <Check size={15} /> {kind.approveLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Withdraw({ request }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const withdraw = async () => {
    setBusy(true);
    await apiFetch(`/api/requests/${request._id}/cancel`, { method: 'POST' }).catch(() => {});
    setBusy(false);
    setOpen(false);
    router.refresh();
  };
  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <Undo2 size={15} /> Withdraw request
      </Button>
      <ConfirmDialog
        open={open}
        title={`Withdraw ${request.number}?`}
        text="It stays in your list as withdrawn. Send a new request if you need it again."
        confirmLabel="Withdraw"
        danger
        busy={busy}
        onConfirm={withdraw}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
