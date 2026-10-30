'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, Undo2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime, formatDay, formatRupees } from '@/lib/format.js';
import { GENDER } from '@/config/employeeOptions.js';
import { Badge, Button, Card, CardHeader, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { ConfirmDialog, Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

const orDash = (value) => (value ? value : '—');

/** HR checks a sent KYC form: approve (saved to the file) or send back with a reason. */
export function KycReview({ data }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(null); // 'approve' | 'reject'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { input, user, files } = data;

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      if (action === 'approve') {
        const result = await apiFetch(`/api/kyc-links/${data.link._id}/approve`, {
          method: 'POST',
        });
        router.push(`/employees/${result.userId}`);
      } else {
        await apiFetch(`/api/kyc-links/${data.link._id}/reject`, {
          method: 'POST',
          body: { reason },
        });
        router.push('/kyc-links');
      }
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setDialog(null);
      setBusy(false);
    }
  };

  const contact = input.emergencyContact ?? {};
  const previous = input.previousCompany ?? {};
  const experienced = input.experienceType === 'experienced';
  const sections = [
    {
      title: 'Personal',
      rows: [
        ['Mobile', input.phone],
        ['Date of birth', input.dateOfBirth ? formatDay(input.dateOfBirth) : '—'],
        ['Gender', GENDER.label(input.gender)],
        ['Blood group', orDash(input.bloodGroup)],
        ['Personal email', orDash(input.personalEmail)],
        ['Current address', input.currentAddress],
        ['Permanent address', input.permanentAddress],
      ],
    },
    {
      title: 'Emergency contact',
      rows: [
        ['Name', contact.name],
        ['Relation', contact.relation],
        ['Phone', contact.phone],
      ],
    },
    {
      title: 'KYC and bank',
      rows: [
        ['PAN', input.pan?.number],
        ['Name on PAN', input.pan?.nameOnPan],
        ['Aadhaar (last 4)', input.aadhaarLast4],
        ['Account holder', input.bank?.accountHolderName],
        ['Bank', input.bank?.bankName],
        ['Account number', input.bank?.accountNumber],
        ['IFSC', input.bank?.ifsc],
      ],
    },
    {
      title: 'Work experience',
      rows: experienced
        ? [
            ['Type', 'Experienced'],
            ['Previous company', previous.name],
            ["HR's name", previous.hrName],
            ["HR's phone", previous.hrPhone],
            ["HR's email", previous.hrEmail],
            ['Reporting manager', orDash(previous.reportingManager)],
            [
              'Last drawn monthly salary',
              input.lastDrawnSalary ? formatRupees(Math.round(input.lastDrawnSalary * 100)) : '—',
            ],
          ]
        : [['Type', 'Fresher']],
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold">
            {user?.name} <span className="text-muted">({user?.employeeId})</span>
          </p>
          <p className="text-xs text-muted">Sent {formatDateTime(data.link.submittedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDialog('reject')} disabled={busy}>
            <Undo2 size={16} /> Send back
          </Button>
          <Button onClick={() => setDialog('approve')} disabled={busy}>
            <Check size={16} /> Approve and save to the file
          </Button>
        </div>
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
      {!data.reveal && (
        <p className="text-xs text-muted">
          PAN and account numbers are masked: your role cannot see full numbers.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader title={section.title} />
            <dl className="divide-y divide-border text-sm">
              {section.rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right break-words">{orDash(value)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Files" subtitle="Open each file to check it against the answers." />
        <ul className="divide-y divide-border text-sm">
          {files.map((file) => (
            <li key={file.field} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="font-medium first-letter:uppercase">{file.label}</p>
                <p className="truncate text-xs text-muted">{file.fileName}</p>
              </div>
              {file.url ? (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  Open <ExternalLink size={14} />
                </a>
              ) : (
                <Badge>Not stored</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={dialog === 'approve'}
        title="Approve this KYC form?"
        text={`Everything goes into the file of ${user?.name}: profile, previous employment, KYC and bank (marked verified) and the documents. You can still edit any of it later.`}
        confirmLabel="Approve"
        busy={busy}
        onConfirm={() => run('approve')}
        onClose={() => setDialog(null)}
      />
      <Dialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Send the form back"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => run('reject')}
              disabled={busy || reason.trim().length < 3}
            >
              {busy && <Spinner />} Send back
            </Button>
          </>
        }
      >
        <Field
          label="What must be corrected?"
          htmlFor="reject-reason"
          hint="The employee sees this on the same link, with their answers still filled in."
        >
          <textarea
            id="reject-reason"
            rows={3}
            maxLength={500}
            className={`${inputClass} h-auto py-2`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </Dialog>
    </div>
  );
}
