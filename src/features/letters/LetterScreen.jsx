'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  CopyPlus,
  Download,
  FileText,
  Pencil,
  Printer,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime } from '@/lib/format.js';
import { ACCEPTED_UPLOADS, readFileAsDataUrl } from '@/lib/readFile.js';
import { Badge, Button, ButtonLink, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { ConfirmDialog, Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';
import { LETTER_STATUS, letterTitle } from './labels.js';
import { LetterBody } from './LetterBody.jsx';

/** One letter: the text, its history, and the actions allowed now. */
export function LetterScreen({ data, isOwn }) {
  const router = useRouter();
  const { letter, rendered, permissions } = data;
  const fileInput = useRef(null);
  const [dialog, setDialog] = useState(null); // 'edit' | 'issue' | 'accepted' | 'declined'
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const status = LETTER_STATUS[letter.status];
  const base = `/api/letters/${letter._id}`;

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      setDialog(null);
      if (result?.letter?._id && result.letter._id !== letter._id && !result.rendered) {
        router.push(`/letters/${result.letter._id}`);
      } else {
        router.refresh();
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadSigned = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run(async () =>
      apiFetch(`${base}/signed-copy`, {
        method: 'POST',
        body: { file: await readFileAsDataUrl(file), fileName: file.name },
      }),
    );
  };

  const history = [
    ['Issued', letter.issuedAt],
    [
      letter.status === 'declined' ? 'Declined' : 'Accepted',
      letter.respondedAt,
      letter.respondedVia === 'employee'
        ? 'by the employee in the app'
        : letter.respondedVia === 'hr'
          ? 'recorded by HR'
          : '',
    ],
  ].filter(([, when]) => when);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader
          title={`${letterTitle(letter)} · ${data.employee.name}`}
          subtitle={letter.subject}
          action={<Badge tone={status.tone}>{status.label}</Badge>}
        />
        {permissions.pdf ? (
          // The offer letter in the founder's format: the real PDF file.
          <iframe
            key={letter.updatedAt}
            src={`${base}/pdf`}
            title={letterTitle(letter)}
            className="h-[80vh] w-full rounded-b-xl border-0 bg-white"
          />
        ) : (
          <div className="p-5 text-sm sm:p-8">
            {rendered.missing.length > 0 && (
              <p className="mb-4 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                Still empty: the marked values. Fill them in with “Edit draft” (or on the employee’s
                file) before issuing.
              </p>
            )}
            <LetterBody text={rendered.text} highlightMissing={letter.status === 'draft'} />
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Actions" />
          <div className="flex flex-col gap-2 p-4">
            {permissions.pdf ? (
              <>
                <ButtonLink variant="secondary" href={`${base}/pdf`} target="_blank">
                  <FileText size={16} /> Open PDF
                </ButtonLink>
                <ButtonLink variant="secondary" href={`${base}/pdf?download=1`}>
                  <Download size={16} /> Download PDF
                </ButtonLink>
              </>
            ) : (
              <ButtonLink variant="secondary" href={`/print/letters/${letter._id}`} target="_blank">
                <Printer size={16} /> Print or save as PDF
              </ButtonLink>
            )}
            {permissions.edit && permissions.pdf && (
              <ButtonLink variant="secondary" href={`/letters/${letter._id}/build`}>
                <Pencil size={16} /> Edit draft
              </ButtonLink>
            )}
            {permissions.edit && !permissions.pdf && (
              <Button variant="secondary" onClick={() => setDialog('edit')}>
                <Pencil size={16} /> Edit draft
              </Button>
            )}
            {permissions.issue && (
              <Button onClick={() => setDialog('issue')} disabled={rendered.missing.length > 0}>
                <Send size={16} /> Issue the letter
              </Button>
            )}
            {permissions.respond && (
              <>
                <Button onClick={() => setDialog('accepted')}>
                  <Check size={16} /> {isOwn ? 'I accept' : 'Record acceptance'}
                </Button>
                <Button variant="secondary" onClick={() => setDialog('declined')}>
                  <X size={16} /> {isOwn ? 'I decline' : 'Record decline'}
                </Button>
              </>
            )}
            {permissions.signedCopy && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                >
                  <Upload size={16} /> Upload signed copy
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED_UPLOADS}
                  className="hidden"
                  onChange={uploadSigned}
                />
              </>
            )}
            {permissions.reissue && (
              <Button
                variant="ghost"
                onClick={() => run(() => apiFetch(`${base}/reissue`, { method: 'POST' }))}
                disabled={busy}
              >
                <CopyPlus size={16} /> Make a new version
              </Button>
            )}
            <ErrorText>{error}</ErrorText>
          </div>
        </Card>
        {history.length > 0 && (
          <Card>
            <CardHeader title="History" />
            <ul className="space-y-2 p-4 text-sm">
              {history.map(([label, when, how]) => (
                <li key={label}>
                  <span className="font-medium">{label}</span>{' '}
                  <span className="text-muted">
                    {formatDateTime(when)}
                    {how ? `, ${how}` : ''}
                  </span>
                </li>
              ))}
              {letter.responseNote && (
                <li className="text-xs text-muted">Note: {letter.responseNote}</li>
              )}
            </ul>
          </Card>
        )}
      </div>

      {dialog === 'edit' && (
        <EditDraftDialog
          letter={letter}
          base={base}
          onClose={() => setDialog(null)}
          onSaved={() => router.refresh()}
        />
      )}
      <ConfirmDialog
        open={dialog === 'issue'}
        title="Issue this letter?"
        text="The text is frozen and the employee is told. To change it later you make a new version."
        confirmLabel="Issue"
        busy={busy}
        onConfirm={() => run(() => apiFetch(`${base}/issue`, { method: 'POST' }))}
        onClose={() => setDialog(null)}
      />
      {(dialog === 'accepted' || dialog === 'declined') && (
        <RespondDialog
          decision={dialog}
          isOwn={isOwn}
          busy={busy}
          error={error}
          onClose={() => setDialog(null)}
          onSubmit={(note) =>
            run(() =>
              apiFetch(`${base}/respond`, { method: 'POST', body: { decision: dialog, note } }),
            )
          }
        />
      )}
    </div>
  );
}

function EditDraftDialog({ letter, base, onClose, onSaved }) {
  const [form, setForm] = useState({
    subject: letter.subject,
    body: letter.body,
    ctcAnnual:
      letter.fields.ctcAnnualPaise === null ? '' : String(letter.fields.ctcAnnualPaise / 100),
    probationMonths:
      letter.fields.probationMonths === null ? '' : String(letter.fields.probationMonths),
    joiningDate: letter.fields.joiningDate,
    acceptBy: letter.fields.acceptBy,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const fields = Object.fromEntries(
      ['ctcAnnual', 'probationMonths', 'joiningDate', 'acceptBy']
        .filter((key) => form[key] !== '')
        .map((key) => [key, form[key]]),
    );
    try {
      await apiFetch(base, {
        method: 'PATCH',
        body: { subject: form.subject, body: form.body, fields },
      });
      onClose();
      onSaved();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title="Edit draft" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Annual CTC (₹)" htmlFor="edit-ctc">
            <input
              id="edit-ctc"
              type="number"
              min="0"
              className={inputClass}
              value={form.ctcAnnual}
              onChange={update('ctcAnnual')}
            />
          </Field>
          <Field label="Probation (months)" htmlFor="edit-probation">
            <input
              id="edit-probation"
              type="number"
              min="0"
              max="24"
              className={inputClass}
              value={form.probationMonths}
              onChange={update('probationMonths')}
            />
          </Field>
          <Field label="Joining date" htmlFor="edit-joining">
            <input
              id="edit-joining"
              type="date"
              className={inputClass}
              value={form.joiningDate}
              onChange={update('joiningDate')}
            />
          </Field>
          <Field label="Accept by" htmlFor="edit-accept">
            <input
              id="edit-accept"
              type="date"
              className={inputClass}
              value={form.acceptBy}
              onChange={update('acceptBy')}
            />
          </Field>
        </div>
        <Field label="Subject" htmlFor="edit-subject">
          <input
            id="edit-subject"
            className={inputClass}
            value={form.subject}
            onChange={update('subject')}
          />
        </Field>
        <Field
          label="Text"
          htmlFor="edit-body"
          hint="A blank line starts a new paragraph. {{name}} style words are filled in when issued."
        >
          <textarea
            id="edit-body"
            rows={14}
            className={`${inputClass} h-auto py-2 font-mono text-xs`}
            value={form.body}
            onChange={update('body')}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save draft
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RespondDialog({ decision, isOwn, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const accept = decision === 'accepted';
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={
        accept
          ? isOwn
            ? 'Accept this letter'
            : 'Record acceptance'
          : isOwn
            ? 'Decline this letter'
            : 'Record decline'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={accept ? 'primary' : 'danger'}
            onClick={() => onSubmit(note)}
            disabled={busy}
          >
            {accept ? 'Accept' : 'Decline'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          {isOwn
            ? accept
              ? 'Your acceptance is recorded with the date and time.'
              : 'HR will be told that you declined.'
            : 'Use this when the employee replied outside the app.'}
        </p>
        <Field label="Note (optional)" htmlFor="respond-note">
          <input
            id="respond-note"
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Dialog>
  );
}
