'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, FileText, Pencil, ShieldCheck, ShieldX, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime } from '@/lib/format.js';
import { ACCEPTED_UPLOADS, readFileAsDataUrl } from '@/lib/readFile.js';
import { Badge, Button, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

export const KYC_STATUS = {
  missing: { label: 'Missing', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

// The fields HR types for each item.
const FORMS = {
  pan: [
    { key: 'number', label: 'PAN', placeholder: 'ABCDE1234F', upper: true },
    { key: 'nameOnPan', label: 'Name on the PAN card' },
  ],
  aadhaar: [
    {
      key: 'last4',
      label: 'Last 4 digits of Aadhaar',
      placeholder: '1234',
      hint: 'Only the last 4 digits are kept. Never type the full number.',
    },
  ],
  bank: [
    { key: 'accountHolderName', label: 'Account holder name' },
    { key: 'bankName', label: 'Bank name' },
    { key: 'ifsc', label: 'IFSC', placeholder: 'SBIN0001234', upper: true },
    {
      key: 'accountNumber',
      label: 'Account number',
      hint: 'Leave empty to keep the saved number.',
    },
  ],
};

/** PAN, Aadhaar and bank of one employee: status, masked numbers, proofs, and the actions allowed. */
export function KycPanel({ kyc }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {kyc.items.map((item) => (
        <KycCard key={item.item} userId={kyc.user._id} item={item} permissions={kyc.permissions} />
      ))}
    </div>
  );
}

function KycCard({ userId, item, permissions }) {
  const router = useRouter();
  const fileInput = useRef(null);
  const [dialog, setDialog] = useState(null); // 'edit' | 'verify' | 'reject' | 'reveal'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = KYC_STATUS[item.status];
  const base = `/api/users/${userId}/kyc/${item.item}`;

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`${base}/proof`, {
        method: 'POST',
        body: { file: await readFileAsDataUrl(file), fileName: file.name },
      });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const detailRows = [
    item.masked && ['Number', item.masked],
    item.details.nameOnPan && ['Name on PAN', item.details.nameOnPan],
    item.details.accountHolderName && ['Account holder', item.details.accountHolderName],
    item.details.bankName && ['Bank', item.details.bankName],
    item.details.ifsc && ['IFSC', item.details.ifsc],
    item.enteredBy && ['Entered by', `${item.enteredBy}, ${formatDateTime(item.enteredAt)}`],
    item.reviewedBy && [
      item.status === 'rejected' ? 'Rejected by' : 'Verified by',
      `${item.reviewedBy}, ${formatDateTime(item.reviewedAt)}`,
    ],
  ].filter(Boolean);

  return (
    <Card className="flex flex-col">
      <CardHeader title={item.label} action={<Badge tone={status.tone}>{status.label}</Badge>} />
      <div className="flex-1 space-y-3 p-4 text-sm">
        {detailRows.length ? (
          <dl className="space-y-1.5">
            {detailRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted">Nothing entered yet.</p>
        )}
        {item.status === 'rejected' && item.rejectReason && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
            Rejected: {item.rejectReason}
          </p>
        )}
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Proof files ({item.proofs.length})</p>
          {item.proofs.length ? (
            <ul className="space-y-1">
              {item.proofs.map((proof, index) => (
                <li key={proof._id} className="flex items-center gap-2">
                  <FileText size={14} className="shrink-0 text-muted" />
                  <a
                    href={proof.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-brand underline"
                  >
                    {proof.fileName}
                  </a>
                  <span className="shrink-0 text-xs text-muted">
                    {index === 0 ? 'latest' : formatDateTime(proof.uploadedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No proof uploaded.</p>
          )}
        </div>
        {item.isMaker &&
          ['submitted', 'under_review'].includes(item.status) &&
          permissions.verify && (
            <p className="text-xs text-muted">You entered this, so someone else must verify it.</p>
          )}
        <ErrorText>{error}</ErrorText>
      </div>
      {(permissions.manage ||
        item.canReview ||
        (permissions.reveal && item.masked && item.item !== 'aadhaar')) && (
        <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
          {permissions.manage && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDialog('edit')}>
                <Pencil size={14} /> {item.masked ? 'Change' : 'Enter'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                <Upload size={14} /> Proof
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_UPLOADS}
                className="hidden"
                onChange={upload}
              />
            </>
          )}
          {item.canReview && (
            <>
              <Button size="sm" onClick={() => setDialog('verify')}>
                <ShieldCheck size={14} /> Verify
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDialog('reject')}>
                <ShieldX size={14} /> Reject
              </Button>
            </>
          )}
          {permissions.reveal && item.masked && item.item !== 'aadhaar' && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('reveal')}>
              <Eye size={14} /> Full number
            </Button>
          )}
        </div>
      )}
      {dialog === 'edit' && <EditDialog base={base} item={item} onClose={() => setDialog(null)} />}
      {(dialog === 'verify' || dialog === 'reject') && (
        <ReviewDialog
          base={base}
          item={item}
          decision={dialog === 'verify' ? 'verified' : 'rejected'}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'reveal' && (
        <RevealDialog base={base} item={item} onClose={() => setDialog(null)} />
      )}
    </Card>
  );
}

function EditDialog({ base, item, onClose }) {
  const router = useRouter();
  const fields = FORMS[item.item];
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.key, item.details[field.key] ?? ''])),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch(base, { method: 'PATCH', body: form });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`${item.label} details`}>
      <form onSubmit={submit} className="space-y-4">
        {fields.map((field) => (
          <Field key={field.key} label={field.label} htmlFor={`kyc-${field.key}`} hint={field.hint}>
            <input
              id={`kyc-${field.key}`}
              className={`${inputClass} ${field.upper ? 'uppercase' : ''}`}
              value={form[field.key]}
              placeholder={field.placeholder}
              autoComplete="off"
              onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
            />
          </Field>
        ))}
        <p className="text-xs text-muted">
          Saving makes this item &ldquo;Submitted&rdquo;: it must be verified again.
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ReviewDialog({ base, item, decision, onClose }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const verify = decision === 'verified';
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`${base}/review`, { method: 'POST', body: { decision, reason } });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={`${verify ? 'Verify' : 'Reject'} ${item.label}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={verify ? 'primary' : 'danger'} onClick={submit} disabled={busy}>
            {verify ? 'Verify' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          {verify
            ? 'Confirm that the details match the latest proof file.'
            : 'The employee and HR will see the reason.'}
        </p>
        {!verify && (
          <Field label="Reason" htmlFor="kyc-reason">
            <input
              id="kyc-reason"
              className={inputClass}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={300}
            />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Dialog>
  );
}

function RevealDialog({ base, item, onClose }) {
  const [number, setNumber] = useState(null);
  const [error, setError] = useState('');
  const show = async () => {
    try {
      setNumber((await apiFetch(`${base}/reveal`)).number);
    } catch (failure) {
      setError(failure.message);
    }
  };
  return (
    <Dialog open onClose={onClose} size="sm" title={`Full ${item.label} number`}>
      <div className="space-y-3 text-sm">
        {number ? (
          <p className="rounded-lg bg-raised px-3 py-2 font-mono text-base tracking-wider">
            {number}
          </p>
        ) : (
          <>
            <p className="text-muted">Viewing the full number is recorded in the audit log.</p>
            <Button onClick={show}>Show the number</Button>
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Dialog>
  );
}
