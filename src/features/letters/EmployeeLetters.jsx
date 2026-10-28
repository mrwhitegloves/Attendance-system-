'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime } from '@/lib/format.js';
import { Badge, Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { DataTable } from '@/components/shared/DataTable.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';
import { LETTER_KIND_LABELS, LETTER_STATUS, letterTitle } from './labels.js';

/**
 * One person's letters, newest first, and the button to start a new one. A candidate's
 * letters pass their own address to create letters at.
 */
export function EmployeeLetters({
  data,
  templates,
  createUrl = `/api/users/${data.user._id}/letters`,
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // An offer letter in the company's own format (MWG / EngenX), edited on its own screen.
  const newOffer = async () => {
    setBusy(true);
    setError('');
    try {
      const { letter } = await apiFetch(offerUrl, { method: 'POST' });
      router.push(`/letters/${letter._id}/build`);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <>
      {data.canManage && (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          <Button onClick={newOffer} disabled={busy}>
            <FileText size={16} /> New offer letter
          </Button>
          <Button variant="secondary" onClick={() => setOpen(true)} disabled={!templates.length}>
            <Plus size={16} /> Letter from a template
          </Button>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      <Card>
        <DataTable
          rows={data.letters}
          onRowClick={(row) => router.push(`/letters/${row._id}`)}
          empty={{
            title: 'No letters yet',
            text: data.canManage ? 'Start one from a template.' : undefined,
          }}
          columns={[
            {
              key: 'title',
              label: 'Letter',
              render: (row) => <span className="font-medium">{letterTitle(row)}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge tone={LETTER_STATUS[row.status].tone}>
                  {LETTER_STATUS[row.status].label}
                </Badge>
              ),
            },
            {
              key: 'issued',
              label: 'Issued',
              render: (row) => (
                <span className="text-xs text-muted">{formatDateTime(row.issuedAt)}</span>
              ),
            },
            {
              key: 'reply',
              label: 'Reply',
              render: (row) => (
                <span className="text-xs text-muted">{formatDateTime(row.respondedAt)}</span>
              ),
            },
          ]}
        />
      </Card>
      {open && (
        <NewLetterDialog
          createUrl={createUrl}
          templates={templates}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function NewLetterDialog({ createUrl, templates, onClose }) {
  const router = useRouter();
  const [form, setForm] = useState({
    templateId: templates[0]._id,
    ctcAnnual: '',
    probationMonths: '6',
    joiningDate: '',
    acceptBy: '',
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
      const { letter } = await apiFetch(createUrl, {
        method: 'POST',
        body: { templateId: form.templateId, fields },
      });
      router.push(`/letters/${letter._id}`);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title="New letter">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Template" htmlFor="letter-template">
          <Select
            id="letter-template"
            value={form.templateId}
            onChange={update('templateId')}
            options={templates.map((template) => ({
              value: template._id,
              label: `${template.name} (${LETTER_KIND_LABELS[template.kind]})`,
            }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Annual CTC (₹)" htmlFor="letter-ctc">
            <input
              id="letter-ctc"
              type="number"
              min="0"
              step="1"
              className={inputClass}
              value={form.ctcAnnual}
              onChange={update('ctcAnnual')}
            />
          </Field>
          <Field label="Probation (months)" htmlFor="letter-probation">
            <input
              id="letter-probation"
              type="number"
              min="0"
              max="24"
              className={inputClass}
              value={form.probationMonths}
              onChange={update('probationMonths')}
            />
          </Field>
          <Field
            label="Joining date"
            htmlFor="letter-joining"
            hint="Empty: the joining date on the employee's file."
          >
            <input
              id="letter-joining"
              type="date"
              className={inputClass}
              value={form.joiningDate}
              onChange={update('joiningDate')}
            />
          </Field>
          <Field label="Accept by" htmlFor="letter-accept">
            <input
              id="letter-accept"
              type="date"
              className={inputClass}
              value={form.acceptBy}
              onChange={update('acceptBy')}
            />
          </Field>
        </div>
        <p className="text-xs text-muted">
          This makes a draft. You can read and change it before issuing.
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Make draft
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
