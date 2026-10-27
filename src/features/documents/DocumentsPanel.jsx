'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, FileText, ShieldCheck, ShieldX, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime, formatDay } from '@/lib/format.js';
import { ACCEPTED_UPLOADS, readFileAsDataUrl } from '@/lib/readFile.js';
import { REVIEW_STATUS, SIGNATURE_STATUS } from '@/config/reviewStatus.js';
import { Badge, Button, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

/** One employee's documents, grouped like the CEO spec's table. */
export function DocumentsPanel({ data }) {
  const [uploading, setUploading] = useState(null); // a document type
  const [reviewing, setReviewing] = useState(null); // { item, decision }
  return (
    <div className="space-y-4">
      {data.groups.map((group) => (
        <Card key={group.category}>
          <CardHeader title={group.label} />
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <DocumentRow
                key={item.type._id}
                item={item}
                permissions={data.permissions}
                onUpload={() => setUploading(item.type)}
                onReview={(decision) => setReviewing({ item, decision })}
              />
            ))}
          </ul>
        </Card>
      ))}
      {uploading && (
        <UploadDialog userId={data.user._id} type={uploading} onClose={() => setUploading(null)} />
      )}
      {reviewing && <ReviewDialog value={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

function DocumentRow({ item, permissions, onUpload, onReview }) {
  const [open, setOpen] = useState(false);
  const { type, document } = item;
  const status = REVIEW_STATUS[document?.status ?? 'missing'];
  const signature = document ? SIGNATURE_STATUS[document.signature] : null;
  const latest = document?.versions[0];
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {type.name}
            {type.required && <span className="text-xs font-normal text-muted">required</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge tone={status.tone}>{status.label}</Badge>
            {signature && <Badge tone={signature.tone}>{signature.label}</Badge>}
            {document?.expiresOn && <span>Expires {formatDay(document.expiresOn)}</span>}
            {latest && (
              <a
                href={latest.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand underline"
              >
                <FileText size={12} /> {latest.fileName}
              </a>
            )}
            {document?.versions.length > 1 && (
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex items-center gap-0.5 hover:text-text"
              >
                {document.versions.length} versions{' '}
                <ChevronDown size={12} className={open ? 'rotate-180' : ''} />
              </button>
            )}
          </p>
          {document?.status === 'rejected' && document.rejectReason && (
            <p className="mt-1 text-xs text-danger">Rejected: {document.rejectReason}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {permissions.manage && (
            <Button size="sm" variant="secondary" onClick={onUpload}>
              <Upload size={14} /> {document ? 'New version' : 'Upload'}
            </Button>
          )}
          {document?.canReview && (
            <>
              <Button size="sm" onClick={() => onReview('verified')}>
                <ShieldCheck size={14} /> Verify
              </Button>
              <Button size="sm" variant="danger" onClick={() => onReview('rejected')}>
                <ShieldX size={14} /> Reject
              </Button>
            </>
          )}
        </div>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 border-l-2 border-border pl-3 text-xs">
          {document.versions.map((version, index) => (
            <li key={version._id} className="flex flex-wrap items-center gap-2">
              <a
                href={version.url}
                target="_blank"
                rel="noreferrer"
                className="text-brand underline"
              >
                {version.fileName}
              </a>
              <span className="text-muted">
                {index === 0 ? 'latest · ' : ''}
                {formatDateTime(version.uploadedAt)}
                {version.note ? ` · ${version.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function UploadDialog({ userId, type, onClose }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [expiresOn, setExpiresOn] = useState('');
  const [signed, setSigned] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!file) return setError('Choose a file.');
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/users/${userId}/documents`, {
        method: 'POST',
        body: {
          typeId: type._id,
          file: await readFileAsDataUrl(file),
          fileName: file.name,
          expiresOn,
          signed,
          note,
        },
      });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
    return undefined;
  };
  return (
    <Dialog open onClose={onClose} title={`Upload: ${type.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="File (PDF or photo, at most 5 MB)" htmlFor="doc-file">
          <input
            id="doc-file"
            type="file"
            accept={ACCEPTED_UPLOADS}
            className="block w-full text-sm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
        {type.hasExpiry && (
          <Field label="Expiry date" htmlFor="doc-expiry">
            <input
              id="doc-expiry"
              type="date"
              className={inputClass}
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
              required
            />
          </Field>
        )}
        {type.needsSignature && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={signed}
              onChange={(event) => setSigned(event.target.checked)}
            />
            This copy is signed by the employee
          </label>
        )}
        <Field label="Note (optional)" htmlFor="doc-note">
          <input
            id="doc-note"
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
          />
        </Field>
        <p className="text-xs text-muted">
          Earlier versions are kept. The new version must be checked again.
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Upload
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ReviewDialog({ value, onClose }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const verify = value.decision === 'verified';
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/documents/${value.item.document._id}/review`, {
        method: 'POST',
        body: { decision: value.decision, reason },
      });
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
      title={`${verify ? 'Verify' : 'Reject'}: ${value.item.type.name}`}
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
            ? 'Confirm that the latest version is correct and complete.'
            : 'HR will see the reason.'}
        </p>
        {!verify && (
          <Field label="Reason" htmlFor="doc-reason">
            <input
              id="doc-reason"
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
