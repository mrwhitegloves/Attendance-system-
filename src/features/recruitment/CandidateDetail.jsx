'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, UserCheck, UserX } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDay, todayKey } from '@/lib/format.js';
import { EMPLOYMENT_TYPE, WORK_MODE } from '@/config/employeeOptions.js';
import { CANDIDATE_STATUS, DROP_REASONS, dropReasonOptions } from '@/config/recruitmentOptions.js';
import { Badge, Button, ButtonLink, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';
import { EmployeeLetters } from '@/features/letters/EmployeeLetters.jsx';

/** One candidate: the job offered, the offer letters, and joining (or not). */
export function CandidateDetail({ data, templates, roleName, canManage, canLetters, canJoin }) {
  const { candidate, manager, letters, hasAcceptedOffer } = data;
  const [dialog, setDialog] = useState(null);
  const open = candidate.status === 'open';
  const rows = [
    ['Mobile', candidate.phone],
    ['Email', candidate.email],
    ['Designation', candidate.designation],
    ['Department', candidate.department],
    ['Branch', candidate.branch],
    ['Reports to', manager ? `${manager.name} (${manager.employeeId})` : ''],
    [
      'Employment type',
      candidate.employmentType && EMPLOYMENT_TYPE.label(candidate.employmentType),
    ],
    ['Work mode', candidate.workMode && WORK_MODE.label(candidate.workMode)],
    ['Role after joining', roleName],
    ['Expected joining', candidate.expectedJoiningDate && formatDay(candidate.expectedJoiningDate)],
    ['Came through', candidate.source],
  ].filter(([, value]) => value);

  return (
    <>
      <Link
        href="/recruitment"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={15} /> Hiring
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {candidate.name}
            <Badge tone={CANDIDATE_STATUS[candidate.status].tone}>
              {CANDIDATE_STATUS[candidate.status].label}
            </Badge>
          </h1>
          {candidate.status === 'dropped' && (
            <p className="text-sm text-muted">
              {DROP_REASONS[candidate.dropReason]}
              {candidate.dropNote ? ` · ${candidate.dropNote}` : ''}
            </p>
          )}
          {candidate.status === 'joined' && candidate.userId && (
            <Link href={`/employees/${candidate.userId}`} className="text-sm text-brand underline">
              Open the employee file
            </Link>
          )}
        </div>
        {canManage && open && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink variant="secondary" size="sm" href={`/recruitment/${candidate._id}/edit`}>
              <Pencil size={15} /> Edit
            </ButtonLink>
            <Button variant="secondary" size="sm" onClick={() => setDialog('drop')}>
              <UserX size={15} /> Not joining
            </Button>
            {canJoin && (
              <Button
                size="sm"
                onClick={() => setDialog('join')}
                disabled={!hasAcceptedOffer}
                title={
                  hasAcceptedOffer ? undefined : 'Record the acceptance of an offer letter first'
                }
              >
                <UserCheck size={15} /> Joined
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="The job offered" />
          <dl className="divide-y divide-border text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {candidate.note && (
            <p className="whitespace-pre-wrap border-t border-border px-4 py-3 text-sm">
              {candidate.note}
            </p>
          )}
        </Card>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Offer letters</h2>
          {open && !hasAcceptedOffer && (
            <p className="mb-3 text-sm text-muted">
              Draft the offer from the template, issue it, then record the candidate&apos;s reply on
              the letter. &quot;Joined&quot; opens once an offer is accepted.
            </p>
          )}
          <EmployeeLetters
            data={{ letters, canManage: canLetters && open, user: { _id: candidate._id } }}
            templates={templates}
            createUrl={`/api/candidates/${candidate._id}/letters`}
          />
        </div>
      </div>

      {dialog === 'join' && <JoinDialog candidate={candidate} onClose={() => setDialog(null)} />}
      {dialog === 'drop' && <DropDialog candidate={candidate} onClose={() => setDialog(null)} />}
    </>
  );
}

function JoinDialog({ candidate, onClose }) {
  const router = useRouter();
  const [form, setForm] = useState({
    joiningDate: candidate.expectedJoiningDate || todayKey(),
    password: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { employee } = await apiFetch(`/api/candidates/${candidate._id}/join`, {
        method: 'POST',
        body: form,
      });
      router.push(`/employees/${employee._id}`);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`${candidate.name} joined`} size="sm">
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-muted">
          The employee is made now with the next employee ID. Their offer letters move to their
          file.
        </p>
        <Field label="Joining date" htmlFor="join-date">
          <input
            id="join-date"
            type="date"
            className={inputClass}
            value={form.joiningDate}
            onChange={change('joiningDate')}
            required
          />
        </Field>
        <Field label="Password for sign-in" htmlFor="join-password" hint="At least 8 characters.">
          <input
            id="join-password"
            className={inputClass}
            value={form.password}
            onChange={change('password')}
            required
            minLength={8}
          />
        </Field>
        <Field label="Work email (optional)" htmlFor="join-email">
          <input
            id="join-email"
            type="email"
            className={inputClass}
            value={form.email}
            onChange={change('email')}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Make employee
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DropDialog({ candidate, onClose }) {
  const router = useRouter();
  const [form, setForm] = useState({ reason: 'declined', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/candidates/${candidate._id}/drop`, {
        method: 'POST',
        body: { reason: form.reason, ...(form.note ? { note: form.note } : {}) },
      });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`${candidate.name} is not joining`} size="sm">
      <form onSubmit={save} className="space-y-3">
        <Field label="Why" htmlFor="drop-reason">
          <Select
            id="drop-reason"
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            options={dropReasonOptions}
          />
        </Field>
        <Field label="Note (optional)" htmlFor="drop-note">
          <input
            id="drop-note"
            className={inputClass}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            maxLength={1000}
          />
        </Field>
        <p className="text-xs text-muted">The candidate and their letters are kept.</p>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
