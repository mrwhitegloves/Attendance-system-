'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DoorOpen, LogOut, Undo2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime, formatDay, todayKey } from '@/lib/format.js';
import { EXIT_STATUS, EXIT_TYPES, exitTypeOptions } from '@/config/exitOptions.js';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';
import { AutomaticChecks, TaskList } from '@/features/onboarding/Checklist.jsx';

/** The exits of one employee: the open one with its tasks, and the old ones. */
export function ExitPanel({ userId, employeeName, exits, canManage, canClose, isSelf }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const open = exits.find((exit) => exit.status === 'notice') ?? null;
  const old = exits.filter((exit) => exit.status !== 'notice');
  const base = `/api/users/${userId}/exits`;

  const run = async (path, options) => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(path, options);
      setDialog(null);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!open && (
        <Card>
          <EmptyState
            title="No exit in progress"
            text="Record a resignation or another kind of exit to start the notice period."
            action={
              canManage &&
              !isSelf && (
                <Button onClick={() => setDialog('start')}>
                  <DoorOpen size={15} /> Start exit
                </Button>
              )
            }
          />
        </Card>
      )}
      {open && (
        <>
          <Card>
            <CardHeader
              title={`${EXIT_TYPES[open.type]} · last working day ${formatDay(open.lastWorkingDay)}`}
              subtitle={`Notice given ${formatDay(open.noticeDate)} · ${open.progress.done} of ${open.progress.total} done${open.overdue ? ' · past the last working day' : ''}`}
              action={<Badge tone={open.overdue ? 'danger' : 'warning'}>Notice period</Badge>}
            />
            {open.reason && <p className="px-4 pb-3 text-sm">{open.reason}</p>}
            <TaskList
              tasks={open.tasks}
              editable={canManage}
              busy={busy}
              onToggle={(task) =>
                run(`${base}/current/tasks/${task._id}`, {
                  method: 'PATCH',
                  body: { done: !task.done },
                })
              }
            />
            {canManage && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border p-3">
                <Button variant="secondary" size="sm" onClick={() => setDialog('withdraw')}>
                  <Undo2 size={15} /> Withdraw
                </Button>
                {canClose && (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!open.ready}
                    title={open.ready ? undefined : 'Finish every item first'}
                    onClick={() => setDialog('complete')}
                  >
                    <LogOut size={15} /> Close exit
                  </Button>
                )}
              </div>
            )}
          </Card>
          <AutomaticChecks checks={open.checks} />
          <p className="text-xs text-muted">
            The full-and-final settlement is added with salary payouts.
          </p>
        </>
      )}
      {error && !dialog && <ErrorText>{error}</ErrorText>}
      {old.length > 0 && (
        <Card>
          <CardHeader title="Earlier" />
          <ul className="divide-y divide-border text-sm">
            {old.map((exit) => (
              <li
                key={exit._id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <span>
                  {EXIT_TYPES[exit.type]} · last working day {formatDay(exit.lastWorkingDay)}
                  {exit.closingNote && <span className="text-muted"> · {exit.closingNote}</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {exit.closedByName} · {formatDateTime(exit.closedAt)}
                  <Badge tone={EXIT_STATUS[exit.status].tone}>
                    {EXIT_STATUS[exit.status].label}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dialog === 'start' && (
        <StartDialog
          employeeName={employeeName}
          busy={busy}
          error={error}
          onClose={() => setDialog(null)}
          onSave={(body) => run(base, { method: 'POST', body })}
        />
      )}
      {(dialog === 'complete' || dialog === 'withdraw') && (
        <CloseDialog
          kind={dialog}
          employeeName={employeeName}
          busy={busy}
          error={error}
          onClose={() => setDialog(null)}
          onSave={(body) => run(`${base}/current/${dialog}`, { method: 'POST', body })}
        />
      )}
    </div>
  );
}

function StartDialog({ employeeName, busy, error, onClose, onSave }) {
  const [form, setForm] = useState({
    type: 'resignation',
    noticeDate: todayKey(),
    lastWorkingDay: '',
    reason: '',
  });
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  return (
    <Dialog open onClose={onClose} title={`Exit of ${employeeName}`} size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...form, ...(form.reason ? {} : { reason: undefined }) });
        }}
        className="space-y-3"
      >
        <Field label="Kind" htmlFor="exit-type">
          <Select
            id="exit-type"
            value={form.type}
            onChange={change('type')}
            options={exitTypeOptions}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Notice given on" htmlFor="exit-notice">
            <input
              id="exit-notice"
              type="date"
              className={inputClass}
              value={form.noticeDate}
              onChange={change('noticeDate')}
              required
            />
          </Field>
          <Field label="Last working day" htmlFor="exit-last">
            <input
              id="exit-last"
              type="date"
              className={inputClass}
              value={form.lastWorkingDay}
              min={form.noticeDate}
              onChange={change('lastWorkingDay')}
              required
            />
          </Field>
        </div>
        <Field label="Reason (optional)" htmlFor="exit-reason">
          <textarea
            id="exit-reason"
            className={`${inputClass} min-h-16`}
            value={form.reason}
            onChange={change('reason')}
            maxLength={1000}
          />
        </Field>
        <p className="text-xs text-muted">
          The employee moves to &quot;Notice period&quot;. They can still sign in until the exit is
          closed.
        </p>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Start exit
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CloseDialog({ kind, employeeName, busy, error, onClose, onSave }) {
  const [note, setNote] = useState('');
  const closing = kind === 'complete';
  return (
    <Dialog
      open
      onClose={onClose}
      title={
        closing ? `Close the exit of ${employeeName}?` : `Withdraw the exit of ${employeeName}?`
      }
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={closing ? 'danger' : 'primary'}
            disabled={busy}
            onClick={() => onSave(note ? { note } : {})}
          >
            {closing ? 'Close exit' : 'Withdraw'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        {closing
          ? 'The employee is marked exited and their account is deactivated: they are signed out everywhere at once. Every record is kept.'
          : 'The employee goes back to their earlier employment status. The exit stays in the history.'}
      </p>
      <Field label="Note (optional)" htmlFor="exit-close-note">
        <input
          id="exit-close-note"
          className={inputClass}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
        />
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
    </Dialog>
  );
}
