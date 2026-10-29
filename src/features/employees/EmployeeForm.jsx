'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, ButtonLink, Card, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';
import {
  BLOOD_GROUPS,
  EMPLOYMENT_STATUS,
  EMPLOYMENT_TYPE,
  GENDER,
  WORK_MODE,
} from '@/config/employeeOptions.js';
import { brandOptions } from '@/config/brands.js';
import { OfferLetterPicker } from '@/features/offerLetters/OfferLetterPicker.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const choose = (list) => [{ value: '', label: 'Choose…' }, ...list];
const plain = (values) => values.map((value) => ({ value, label: value }));

/**
 * The sections of the form. A field is { key, label, type, options?, required?, hint? };
 * "emergencyContact.name" style keys are sent as one emergencyContact object.
 */
function sections({ editing, lists, managers, roles, staffTypes, employeeId }) {
  const fromList = (type, current) => {
    const names = lists[type] ?? [];
    return choose(plain(current && !names.includes(current) ? [current, ...names] : names));
  };
  return [
    {
      title: 'Personal',
      fields: [
        { key: 'name', label: 'Full name', required: true },
        { key: 'phone', label: 'Mobile', type: 'tel' },
        { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
        { key: 'gender', label: 'Gender', type: 'select', options: choose(GENDER.list) },
        {
          key: 'bloodGroup',
          label: 'Blood group',
          type: 'select',
          options: choose(plain(BLOOD_GROUPS)),
        },
        { key: 'personalEmail', label: 'Personal email', type: 'email' },
        { key: 'currentAddress', label: 'Current address', type: 'textarea' },
        { key: 'permanentAddress', label: 'Permanent address', type: 'textarea' },
      ],
    },
    {
      title: 'Emergency contact',
      fields: [
        { key: 'emergencyContact.name', label: 'Name' },
        { key: 'emergencyContact.relation', label: 'Relation' },
        { key: 'emergencyContact.phone', label: 'Phone', type: 'tel' },
      ],
    },
    {
      title: 'Employment',
      fields: [
        {
          key: 'employeeCode',
          label: 'Employee code (on slips and letters)',
          hint: 'Example: MWG-FSD-25-001. Empty: the employee ID is used.',
        },
        { key: 'designation', label: 'Designation', type: 'list' },
        { key: 'department', label: 'Department', type: 'list' },
        { key: 'branch', label: 'Branch', type: 'list' },
        {
          key: 'managerId',
          label: 'Reports to',
          type: 'select',
          options: [
            { value: '', label: 'Nobody' },
            ...managers
              .filter((manager) => manager._id !== employeeId)
              .map((manager) => ({
                value: manager._id,
                label: `${manager.name} (${manager.employeeId})`,
              })),
          ],
        },
        {
          key: 'employmentType',
          label: 'Employment type',
          type: 'select',
          options: choose(EMPLOYMENT_TYPE.list),
        },
        { key: 'workMode', label: 'Work mode', type: 'select', options: choose(WORK_MODE.list) },
        {
          key: 'employmentStatus',
          label: 'Employment status',
          type: 'select',
          options: choose(EMPLOYMENT_STATUS.list),
        },
        { key: 'staffType', label: 'Staff type', type: 'select', options: plain(staffTypes) },
        {
          key: 'brandKey',
          label: 'Company (letter and slip format)',
          type: 'select',
          options: brandOptions,
        },
        { key: 'joiningDate', label: 'Joining date', type: 'date' },
        { key: 'probationEndDate', label: 'Probation ends', type: 'date' },
      ],
      fromList,
    },
    {
      title: 'Work timing and access',
      fields: [
        {
          key: 'expectedInTime',
          label: 'Expected in-time',
          type: 'time',
          required: true,
          hint: 'Up to 5 minutes after this is on time; later is late.',
        },
        { key: 'expectedOutTime', label: 'Expected out-time', type: 'time', required: true },
        {
          key: 'weeklyOffs',
          label: 'Weekly off',
          type: 'weekdays',
          hint: 'One or two days. Not a working day on the salary slip.',
        },
        { key: 'email', label: 'Work email (optional, can sign in with it)', type: 'email' },
        {
          key: 'roleKey',
          label: 'Role',
          type: 'select',
          options: roles,
          hint: 'Decides what this person can see and do.',
        },
        {
          key: 'password',
          label: editing ? 'New password (leave empty to keep)' : 'Password',
          required: !editing,
          hint: 'At least 8 characters.',
          autoComplete: 'new-password',
        },
      ],
    },
  ];
}

const KEYS = [
  'name',
  'phone',
  'dateOfBirth',
  'gender',
  'bloodGroup',
  'personalEmail',
  'currentAddress',
  'permanentAddress',
  'emergencyContact.name',
  'emergencyContact.relation',
  'emergencyContact.phone',
  'employeeCode',
  'designation',
  'department',
  'branch',
  'managerId',
  'employmentType',
  'workMode',
  'employmentStatus',
  'staffType',
  'joiningDate',
  'probationEndDate',
  'expectedInTime',
  'expectedOutTime',
  'weeklyOffs',
  'brandKey',
  'email',
  'roleKey',
  'password',
];
const DEFAULTS = {
  staffType: 'Office Staff',
  expectedInTime: '09:30',
  expectedOutTime: '18:30',
  roleKey: 'employee',
  brandKey: 'mwg',
  // Sunday, until HR chooses (old records have none).
  weeklyOffs: '0',
};
const read = (record, key) => key.split('.').reduce((value, part) => value?.[part], record);

/** The form's values for an employee (flat keys, empty strings for empty fields). */
function initialValues(employee) {
  return Object.fromEntries(
    KEYS.map((key) => [
      key,
      key === 'password'
        ? ''
        : key === 'weeklyOffs'
          ? (employee?.weeklyOffs ?? [0]).join(',')
          : String((employee && read(employee, key)) ?? DEFAULTS[key] ?? ''),
    ]),
  );
}

/** Flat form values → the request body (only changed fields when editing). */
function toBody(form, initial, editing) {
  const changed = KEYS.filter((key) =>
    key === 'password' ? form.password !== '' : !editing || form[key] !== initial[key],
  );
  const body = {};
  for (const key of changed) {
    if (key.startsWith('emergencyContact.')) continue;
    if (key === 'password' && !form.password) continue;
    body[key] =
      key === 'managerId'
        ? form.managerId || null
        : key === 'weeklyOffs'
          ? form.weeklyOffs.split(',').filter(Boolean).map(Number)
          : form[key];
  }
  if (changed.some((key) => key.startsWith('emergencyContact.'))) {
    body.emergencyContact = {
      name: form['emergencyContact.name'],
      relation: form['emergencyContact.relation'],
      phone: form['emergencyContact.phone'],
    };
  }
  return body;
}

/** Add or edit an employee's file. */
export function EmployeeForm({
  employee,
  roles,
  staffTypes,
  managers,
  canGiveCeo,
  lists,
  canManageLists,
  canLinkOffer = false,
}) {
  const router = useRouter();
  const editing = Boolean(employee);
  const [initial] = useState(() => initialValues(employee));
  const [form, setForm] = useState(initial);
  // A candidate's offer letter (Offer letters screen) that moves to the new employee.
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const roleOptions = roles.filter(
    (role) => canGiveCeo || role.value !== 'ceo' || initial.roleKey === 'ceo',
  );
  const groups = sections({
    editing,
    lists,
    managers,
    roles: roleOptions,
    staffTypes,
    employeeId: employee?._id,
  });
  const fromList = groups.find((group) => group.fromList).fromList;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = toBody(form, initial, editing);
      if (editing) {
        if (Object.keys(body).length) {
          await apiFetch(`/api/users/${employee._id}`, { method: 'PATCH', body });
        }
        router.push(`/employees/${employee._id}`);
      } else {
        if (offer) body.offerLetterId = offer._id;
        const { user } = await apiFetch('/api/users', { method: 'POST', body });
        router.push(`/employees/${user._id}`);
      }
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  const control = (field) => {
    const common = {
      id: field.key,
      value: form[field.key],
      onChange: (event) => setForm({ ...form, [field.key]: event.target.value }),
      required: field.required,
    };
    if (field.type === 'select') return <Select {...common} options={field.options} />;
    if (field.type === 'weekdays') {
      const chosen = form.weeklyOffs.split(',').filter(Boolean).map(Number);
      const toggle = (day) => {
        const next = chosen.includes(day)
          ? chosen.filter((item) => item !== day)
          : [...chosen, day].slice(-2);
        setForm({ ...form, weeklyOffs: next.sort().join(',') });
      };
      return (
        <div id={field.key} className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((name, day) => (
            <button
              key={name}
              type="button"
              onClick={() => toggle(day)}
              aria-pressed={chosen.includes(day)}
              className={`rounded-lg border px-2.5 py-1.5 text-sm ${chosen.includes(day) ? 'border-brand bg-brand text-white' : 'border-border bg-surface'}`}
            >
              {name}
            </button>
          ))}
        </div>
      );
    }
    if (field.type === 'list')
      return <Select {...common} options={fromList(field.key, initial[field.key])} />;
    if (field.type === 'textarea')
      return (
        <textarea {...common} rows={2} maxLength={300} className={`${inputClass} h-auto py-2`} />
      );
    return (
      <input
        {...common}
        type={field.type ?? 'text'}
        autoComplete={field.autoComplete}
        className={inputClass}
        minLength={field.key === 'password' ? 8 : undefined}
      />
    );
  };

  // Choosing the letter fills the empty fields from the candidate (name, phone, planned job).
  const chooseOffer = (row) => {
    setOffer(row);
    if (!row) return;
    const fill = {
      name: row.person.name,
      phone: row.person.phone,
      designation: row.plan?.designation,
      department: row.plan?.department,
      branch: row.plan?.branch,
      brandKey: row.plan?.brandKey,
    };
    const next = { ...form };
    for (const [key, value] of Object.entries(fill)) {
      if (value && (!next[key] || next[key] === initial[key])) next[key] = value;
    }
    setForm(next);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {!editing && canLinkOffer && (
        <Card className="p-4 sm:p-5">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Offer letter (optional)</legend>
            <p className="text-xs text-muted">
              Made on the Offer letters screen before this person joined. It moves to the new
              employee.
            </p>
            <OfferLetterPicker id="offerLetter" value={offer} onChange={chooseOffer} />
          </fieldset>
        </Card>
      )}
      {groups.map((group) => (
        <Card key={group.title} className="p-4 sm:p-5">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold">{group.title}</legend>
            {group.fields.map((field) => (
              <Field key={field.key} label={field.label} htmlFor={field.key} hint={field.hint}>
                {control(field)}
              </Field>
            ))}
            {group.fromList && (
              <p className="text-xs text-muted sm:col-span-2">
                Designations, departments and branches come from{' '}
                {canManageLists ? (
                  <Link href="/settings/lists" className="text-brand underline">
                    Settings → Lists
                  </Link>
                ) : (
                  'Settings → Lists'
                )}
                .
              </p>
            )}
          </fieldset>
        </Card>
      ))}
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <ButtonLink
          variant="secondary"
          href={editing ? `/employees/${employee._id}` : '/employees'}
        >
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={busy}>
          {busy && <Spinner />}
          {editing ? 'Save changes' : 'Add employee'}
        </Button>
      </div>
    </form>
  );
}
