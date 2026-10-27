'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { capitalize, formatDay, formatDateTime, statusTone, todayKey } from '@/lib/format.js';
import { Badge, Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { PersonCell } from '@/components/shared/Avatar.jsx';
import { LinkTabs } from '@/components/shared/Tabs.jsx';
import { Dialog, ConfirmDialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected', 'cancelled'];

const daysIn = (leave) =>
  Math.round(
    (new Date(`${leave.endDate}T00:00:00Z`) - new Date(`${leave.startDate}T00:00:00Z`)) / 86400000,
  ) + 1;

export function LeaveScreen({
  result,
  status,
  pendingToDecide,
  me,
  canRequest,
  canDecide,
  showPerson,
  basePath = '/leave',
}) {
  const router = useRouter();
  const [requestOpen, setRequestOpen] = useState(false);
  const [deciding, setDeciding] = useState(null); // { leave, decision }
  const [withdrawing, setWithdrawing] = useState(null);

  const tabs = STATUS_TABS.map((id) => ({
    id,
    label: id === 'all' ? 'All' : capitalize(id),
    href: id === 'all' ? basePath : `${basePath}?status=${id}`,
    count: id === 'pending' && canDecide ? pendingToDecide : 0,
  }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <LinkTabs tabs={tabs} active={status} />
        </div>
        {canRequest && (
          <Button onClick={() => setRequestOpen(true)}>
            <Plus size={16} /> Request leave
          </Button>
        )}
      </div>
      <Card>
        <DataTable
          rows={result.items}
          empty={{ title: 'No leave requests here' }}
          columns={[
            ...(showPerson
              ? [
                  {
                    key: 'person',
                    label: 'Employee',
                    render: (row) => (
                      <PersonCell name={row.employeeName} employeeId={row.employeeId} />
                    ),
                  },
                ]
              : []),
            {
              key: 'dates',
              label: 'Dates',
              render: (row) => (
                <span>
                  {formatDay(row.startDate)}
                  {row.endDate !== row.startDate && ` – ${formatDay(row.endDate)}`}{' '}
                  <span className="text-xs text-muted">
                    ({daysIn(row)} {daysIn(row) === 1 ? 'day' : 'days'})
                  </span>
                </span>
              ),
            },
            {
              key: 'reason',
              label: 'Reason',
              className: 'max-w-xs',
              render: (row) => <span className="line-clamp-2">{row.reason}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <span className="flex flex-wrap gap-1">
                  <Badge tone={statusTone(row.status)}>{capitalize(row.status)}</Badge>
                  {row.status === 'approved' && row.paid !== null && row.paid !== undefined && (
                    <Badge tone={row.paid ? 'info' : 'warning'}>
                      {row.paid ? 'Paid' : 'Unpaid'}
                    </Badge>
                  )}
                </span>
              ),
            },
            {
              key: 'note',
              label: 'Note',
              mobile: false,
              render: (row) => (
                <span className="text-xs text-muted">
                  {row.adminNote || (row.processedAt ? formatDateTime(row.processedAt) : '—')}
                </span>
              ),
            },
            {
              key: 'actions',
              label: '',
              className: 'text-right',
              render: (row) =>
                row.status !== 'pending' ? null : row.employeeId === me.employeeId ? (
                  <Button size="sm" variant="ghost" onClick={() => setWithdrawing(row)}>
                    Withdraw
                  </Button>
                ) : canDecide ? (
                  <span className="inline-flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDeciding({ leave: row, decision: 'rejected' })}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setDeciding({ leave: row, decision: 'approved' })}
                    >
                      Approve
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
        <Pagination page={result.page} pages={result.pages} total={result.total} />
      </Card>

      <RequestDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onDone={() => router.refresh()}
      />
      <DecideDialog
        key={deciding ? `${deciding.leave._id}-${deciding.decision}` : 'none'}
        value={deciding}
        onClose={() => setDeciding(null)}
        onDone={() => router.refresh()}
      />
      <WithdrawDialog
        leave={withdrawing}
        onClose={() => setWithdrawing(null)}
        onDone={() => router.refresh()}
      />
    </>
  );
}

function RequestDialog({ open, onClose, onDone }) {
  const [form, setForm] = useState({ startDate: todayKey(), endDate: todayKey(), reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/leaves', { method: 'POST', body: form });
      setForm({ startDate: todayKey(), endDate: todayKey(), reason: '' });
      onClose();
      onDone();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Request leave">
      <form id="leave-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="leave-from">
            <input
              id="leave-from"
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(event) =>
                setForm({
                  ...form,
                  startDate: event.target.value,
                  endDate: form.endDate < event.target.value ? event.target.value : form.endDate,
                })
              }
              required
            />
          </Field>
          <Field label="To" htmlFor="leave-to">
            <input
              id="leave-to"
              type="date"
              className={inputClass}
              min={form.startDate}
              value={form.endDate}
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="Reason" htmlFor="leave-reason">
          <textarea
            id="leave-reason"
            rows={3}
            className={`${inputClass} h-auto py-2`}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            required
            maxLength={500}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Send request
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DecideDialog({ value, onClose, onDone }) {
  const [note, setNote] = useState('');
  // Paid leave costs no salary; unpaid leave costs a full day (founder's rule).
  const [paid, setPaid] = useState(null);
  // With paid leave: the employee's balance, and whether to take the days from it for a month.
  const [balance, setBalance] = useState(null);
  const [useBalance, setUseBalance] = useState(false);
  const [balanceMonth, setBalanceMonth] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!value) return <Dialog open={false} onClose={onClose} title="" />;
  const approve = value.decision === 'approved';
  const choose = async (choice) => {
    setPaid(choice);
    if (!choice || balance !== null || !value.leave.userId) return;
    setBalanceMonth(value.leave.startDate.slice(0, 7));
    try {
      const data = await apiFetch(`/api/users/${value.leave.userId}/leave-balance`);
      setBalance(data.balance);
      setUseBalance(data.balance > 0);
    } catch {
      setBalance(null);
    }
  };
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/leaves/${value.leave._id}`, {
        method: 'PATCH',
        body: {
          decision: value.decision,
          note,
          ...(value.decision === 'approved' ? { paid } : {}),
          ...(value.decision === 'approved' && paid && useBalance
            ? { useBalance: true, balanceMonth }
            : {}),
        },
      });
      setNote('');
      setPaid(null);
      setBalance(null);
      setUseBalance(false);
      onClose();
      onDone();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={approve ? 'Approve leave' : 'Reject leave'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={approve ? 'primary' : 'danger'}
            onClick={submit}
            disabled={busy || (approve && paid === null)}
          >
            {approve ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          <strong>{value.leave.employeeName}</strong>: {formatDay(value.leave.startDate)} –{' '}
          {formatDay(value.leave.endDate)}
        </p>
        <p className="text-muted">{value.leave.reason}</p>
        {approve && (
          <fieldset className="space-y-2">
            <legend className="mb-1 font-medium">Is this paid leave?</legend>
            {[
              [true, 'Paid leave', 'No salary is cut for these days.'],
              [false, 'Unpaid leave', 'A full day of salary is cut for each day.'],
            ].map(([value, label, hint]) => (
              <label
                key={label}
                className="flex items-start gap-2 rounded-lg border border-border p-2"
              >
                <input
                  type="radio"
                  name="leave-paid"
                  className="mt-1"
                  checked={paid === value}
                  onChange={() => choose(value)}
                />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {approve && paid && balance !== null && (
          <div className="space-y-2 rounded-lg bg-raised p-3">
            <p>
              Paid leave balance:{' '}
              <strong className={balance <= 0 ? 'text-danger' : ''}>
                {balance} {Math.abs(balance) === 1 ? 'day' : 'days'}
              </strong>
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useBalance}
                onChange={(event) => setUseBalance(event.target.checked)}
              />
              Take these days from the balance (Sundays and holidays are not taken)
            </label>
            {useBalance && (
              <Field label="Taken for month" htmlFor="balance-month-choice">
                <input
                  id="balance-month-choice"
                  type="month"
                  className={inputClass}
                  value={balanceMonth}
                  onChange={(event) => setBalanceMonth(event.target.value)}
                />
              </Field>
            )}
          </div>
        )}
        <Field label="Note (optional)" htmlFor="decide-note">
          <input
            id="decide-note"
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Dialog>
  );
}

function WithdrawDialog({ leave, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      open={Boolean(leave)}
      title="Withdraw this request?"
      text="The request is cancelled. You can send a new one later."
      confirmLabel="Withdraw"
      danger
      busy={busy}
      onClose={onClose}
      onConfirm={async () => {
        setBusy(true);
        await apiFetch(`/api/leaves/${leave._id}`, { method: 'DELETE' }).catch(() => {});
        setBusy(false);
        onClose();
        onDone();
      }}
    />
  );
}
