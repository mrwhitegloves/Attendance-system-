'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch.js';
import { EMPLOYMENT_TYPE, WORK_MODE } from '@/config/employeeOptions.js';
import { Button, ButtonLink, Card, ErrorText } from '@/components/shared/ui.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';

const choose = (list) => [{ value: '', label: 'Choose…' }, ...list];
const plain = (values) => values.map((value) => ({ value, label: value }));

const FIELDS = [
  'name',
  'email',
  'phone',
  'designation',
  'department',
  'branch',
  'staffType',
  'employmentType',
  'workMode',
  'managerId',
  'roleKey',
  'expectedJoiningDate',
  'source',
  'note',
];

/** Add or edit a candidate: who they are and the job they are offered. */
export function CandidateForm({
  candidate = null,
  lists,
  managers,
  roles,
  staffTypes,
  canGiveCeo,
}) {
  const router = useRouter();
  const [form, setForm] = useState(() =>
    Object.fromEntries(
      FIELDS.map((key) => [
        key,
        candidate?.[key] ?? { staffType: 'Office Staff', roleKey: 'employee' }[key] ?? '',
      ]),
    ),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const fromList = (type) => {
    const names = lists[type] ?? [];
    const current = form[type];
    return choose(plain(current && !names.includes(current) ? [current, ...names] : names));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...form, managerId: form.managerId || null };
    try {
      const result = candidate
        ? await apiFetch(`/api/candidates/${candidate._id}`, { method: 'PATCH', body })
        : await apiFetch('/api/candidates', { method: 'POST', body });
      router.push(`/recruitment/${result.candidate._id}`);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  const select = (key, label, options) => (
    <Field label={label} htmlFor={`candidate-${key}`}>
      <Select id={`candidate-${key}`} value={form[key]} onChange={change(key)} options={options} />
    </Field>
  );
  const input = (key, label, props = {}) => (
    <Field label={label} htmlFor={`candidate-${key}`}>
      <input
        id={`candidate-${key}`}
        className={inputClass}
        value={form[key]}
        onChange={change(key)}
        {...props}
      />
    </Field>
  );

  return (
    <Card className="max-w-3xl">
      <form onSubmit={submit} className="space-y-5 p-4 sm:p-5">
        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-sm font-semibold sm:col-span-2">The person</h2>
          {input('name', 'Full name', { required: true, minLength: 2, maxLength: 100 })}
          {input('phone', 'Mobile', { type: 'tel', maxLength: 20 })}
          {input('email', 'Email', { type: 'email' })}
          {input('source', 'Came through (optional)', {
            maxLength: 80,
            placeholder: 'Referral, job portal…',
          })}
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-sm font-semibold sm:col-span-2">The job offered</h2>
          {select('designation', 'Designation', fromList('designation'))}
          {select('department', 'Department', fromList('department'))}
          {select('branch', 'Branch', fromList('branch'))}
          {select('managerId', 'Reports to', [
            { value: '', label: 'Nobody' },
            ...managers.map((manager) => ({
              value: manager._id,
              label: `${manager.name} (${manager.employeeId})`,
            })),
          ])}
          {select('staffType', 'Staff type', plain(staffTypes))}
          {select('employmentType', 'Employment type', choose(EMPLOYMENT_TYPE.list))}
          {select('workMode', 'Work mode', choose(WORK_MODE.list))}
          {select(
            'roleKey',
            'Role after joining',
            roles.filter((role) => canGiveCeo || role.value !== 'ceo'),
          )}
          {input('expectedJoiningDate', 'Expected joining date', { type: 'date' })}
        </section>
        <Field label="Note (optional)" htmlFor="candidate-note">
          <textarea
            id="candidate-note"
            className={`${inputClass} min-h-20`}
            value={form.note}
            onChange={change('note')}
            maxLength={1000}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex justify-end gap-2">
          <ButtonLink
            variant="secondary"
            href={candidate ? `/recruitment/${candidate._id}` : '/recruitment'}
          >
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
