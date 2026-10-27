'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, Power } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, ButtonLink } from '@/components/shared/ui.jsx';
import { ConfirmDialog, Dialog } from '@/components/shared/Dialog.jsx';

/** Edit, switch off / on, and show password (explicit click, audited). */
export function EmployeeActions({ employee, canEdit, canSwitch, canSeePassword }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(null);
  const switchingOff = employee.status === 'active';

  const toggleStatus = async () => {
    setBusy(true);
    await apiFetch(`/api/users/${employee._id}`, {
      method: 'PATCH',
      body: { status: switchingOff ? 'inactive' : 'active' },
    }).catch(() => {});
    setBusy(false);
    setConfirm(false);
    router.refresh();
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
        <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
          <Power size={15} /> {switchingOff ? 'Switch off' : 'Switch on'}
        </Button>
      )}
      {canEdit && (
        <ButtonLink size="sm" href={`/employees/${employee._id}/edit`}>
          <Pencil size={15} /> Edit
        </ButtonLink>
      )}
      <ConfirmDialog
        open={confirm}
        title={switchingOff ? `Switch off ${employee.name}?` : `Switch on ${employee.name}?`}
        text={
          switchingOff
            ? 'They are signed out on every device and cannot sign in. Their records are kept.'
            : 'They can sign in again with their password.'
        }
        confirmLabel={switchingOff ? 'Switch off' : 'Switch on'}
        danger={switchingOff}
        busy={busy}
        onConfirm={toggleStatus}
        onClose={() => setConfirm(false)}
      />
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
