'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, Power } from 'lucide-react';
import { ACCOUNT_STATUS } from '@/config/employeeOptions.js';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, ButtonLink, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, Select } from '@/components/shared/form.jsx';

/** Edit, change the account status, and show password (explicit click, audited). */
export function EmployeeActions({ employee, canEdit, canSwitch, canSeePassword }) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [status, setStatus] = useState(employee.status);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(null);

  const openStatus = () => {
    setStatus(employee.status);
    setError('');
    setStatusOpen(true);
  };
  const saveStatus = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/users/${employee._id}`, { method: 'PATCH', body: { status } });
      setStatusOpen(false);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const showPassword = async () => {
    const result = await apiFetch(`/api/users/${employee._id}/password`).catch((failure) => ({
      password: failure.message,
    }));
    setPassword(result.password);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {canSeePassword && (
        <Button variant="secondary" size="sm" onClick={showPassword}>
          <Eye size={15} /> Password
        </Button>
      )}
      {canSwitch && (
        <Button variant="secondary" size="sm" onClick={openStatus}>
          <Power size={15} /> Status: {ACCOUNT_STATUS.label(employee.status)}
        </Button>
      )}
      {canEdit && (
        <ButtonLink size="sm" href={`/employees/${employee._id}/edit`}>
          <Pencil size={15} /> Edit
        </ButtonLink>
      )}
      <Dialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={`Account status of ${employee.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={status === 'active' ? 'primary' : 'danger'}
              onClick={saveStatus}
              disabled={busy || status === employee.status}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Status" htmlFor="account-status">
          <Select
            id="account-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={ACCOUNT_STATUS.list}
          />
        </Field>
        <p className="mt-3 text-sm text-muted">
          {status === 'active'
            ? 'They can sign in and punch with their password.'
            : 'They are signed out on every device at once and cannot sign in or punch. Their records are kept.'}
        </p>
        {error && <ErrorText>{error}</ErrorText>}
      </Dialog>
      <Dialog
        open={password !== null}
        onClose={() => setPassword(null)}
        title={`Password of ${employee.name}`}
        size="sm"
      >
        <p className="rounded-lg bg-raised px-3 py-2 font-mono text-sm">{password}</p>
        <p className="mt-2 text-xs text-muted">This view is recorded in the audit log.</p>
      </Dialog>
    </div>
  );
}
