'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, ButtonLink, Card, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  department: '',
  staffType: 'Office Staff',
  expectedInTime: '09:30',
  expectedOutTime: '18:30',
  roleKey: 'employee',
  managerId: '',
  password: '',
};

/** Add or edit an employee. In edit mode only changed fields are sent; password is optional. */
export function EmployeeForm({ employee, roles, staffTypes, managers, canGiveCeo }) {
  const router = useRouter();
  const editing = Boolean(employee);
  const initial = editing
    ? {
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, employee[key] ?? EMPTY[key]])),
        managerId: employee.managerId ?? '',
        password: '',
      }
    : EMPTY;
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editing) {
        const changes = Object.fromEntries(
          Object.entries(form).filter(([key, value]) =>
            key === 'password' ? value !== '' : value !== initial[key],
          ),
        );
        if (!Object.keys(changes).length) {
          router.push(`/employees/${employee._id}`);
          return;
        }
        await apiFetch(`/api/users/${employee._id}`, {
          method: 'PATCH',
          body: {
            ...changes,
            ...('managerId' in changes ? { managerId: changes.managerId || null } : {}),
          },
        });
        router.push(`/employees/${employee._id}`);
      } else {
        const { user } = await apiFetch('/api/users', {
          method: 'POST',
          body: { ...form, managerId: form.managerId || null },
        });
        router.push(`/employees/${user._id}`);
      }
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  const roleOptions = roles.filter(
    (role) => canGiveCeo || role.value !== 'ceo' || initial.roleKey === 'ceo',
  );

  return (
    <Card className="p-4 sm:p-6">
      <form onSubmit={submit} className="space-y-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Person</legend>
          <Field label="Full name" htmlFor="name">
            <input
              id="name"
              className={inputClass}
              value={form.name}
              onChange={update('name')}
              required
              minLength={2}
            />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <input
              id="phone"
              type="tel"
              className={inputClass}
              value={form.phone}
              onChange={update('phone')}
            />
          </Field>
          <Field label="Email (optional)" htmlFor="email">
            <input
              id="email"
              type="email"
              className={inputClass}
              value={form.email}
              onChange={update('email')}
            />
          </Field>
          <Field label="Department" htmlFor="department">
            <input
              id="department"
              className={inputClass}
              value={form.department}
              onChange={update('department')}
            />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Work</legend>
          <Field label="Staff type" htmlFor="staffType">
            <Select
              id="staffType"
              value={form.staffType}
              onChange={update('staffType')}
              options={staffTypes.map((value) => ({ value, label: value }))}
            />
          </Field>
          <Field label="Reports to" htmlFor="managerId">
            <Select
              id="managerId"
              value={form.managerId}
              onChange={update('managerId')}
              options={[
                { value: '', label: 'Nobody' },
                ...managers
                  .filter((manager) => manager._id !== employee?._id)
                  .map((manager) => ({
                    value: manager._id,
                    label: `${manager.name} (${manager.employeeId})`,
                  })),
              ]}
            />
          </Field>
          <Field label="Expected in-time" htmlFor="in" hint="A punch-in after this minute is late.">
            <input
              id="in"
              type="time"
              className={inputClass}
              value={form.expectedInTime}
              onChange={update('expectedInTime')}
              required
            />
          </Field>
          <Field label="Expected out-time" htmlFor="out">
            <input
              id="out"
              type="time"
              className={inputClass}
              value={form.expectedOutTime}
              onChange={update('expectedOutTime')}
              required
            />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Sign-in and access</legend>
          <Field label="Role" htmlFor="roleKey" hint="Decides what this person can see and do.">
            <Select
              id="roleKey"
              value={form.roleKey}
              onChange={update('roleKey')}
              options={roleOptions}
            />
          </Field>
          <Field
            label={editing ? 'New password (leave empty to keep)' : 'Password'}
            htmlFor="password"
            hint="At least 8 characters."
          >
            <input
              id="password"
              type="text"
              autoComplete="new-password"
              className={inputClass}
              value={form.password}
              onChange={update('password')}
              required={!editing}
              minLength={8}
            />
          </Field>
        </fieldset>

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
    </Card>
  );
}
