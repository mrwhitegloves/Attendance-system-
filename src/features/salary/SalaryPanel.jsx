'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Undo2, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime, formatDay, formatRupees, todayKey } from '@/lib/format.js';
import { COMPONENT_GROUPS, SALARY_COMPONENTS, SALARY_STATUS } from '@/config/salaryComponents.js';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorText } from '@/components/shared/ui.jsx';
import { DataTable } from '@/components/shared/DataTable.jsx';
import { ConfirmDialog, Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';
import { SalaryBreakdown } from './SalaryBreakdown.jsx';

/** One employee's salary: in force, waiting for approval, and every version. */
export function SalaryPanel({ data }) {
  const router = useRouter();
  const { current, pending, versions, permissions } = data;
  const [proposing, setProposing] = useState(false);
  const [deciding, setDeciding] = useState(null); // 'approved' | 'rejected'
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (path, body) => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(path, { method: 'POST', body });
      setDeciding(null);
      setWithdrawing(false);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Salary in force"
            subtitle={
              current
                ? `Version ${current.version}, from ${formatDay(current.effectiveFrom)}`
                : undefined
            }
            action={
              permissions.manage &&
              !pending && (
                <Button size="sm" onClick={() => setProposing(true)}>
                  <Plus size={14} /> {current ? 'Propose revision' : 'Set salary'}
                </Button>
              )
            }
          />
          <div className="p-4">
            {current ? (
              <SalaryBreakdown structure={current} />
            ) : (
              <EmptyState title="No approved salary yet" />
            )}
          </div>
        </Card>
        {pending && (
          <Card className="border-warning/50">
            <CardHeader
              title="Waiting for approval"
              subtitle={`Version ${pending.version}, from ${formatDay(pending.effectiveFrom)} · proposed by ${pending.preparedByName}`}
              action={<Badge tone="warning">Pending</Badge>}
            />
            <div className="space-y-3 p-4">
              <p className="rounded-lg bg-raised px-3 py-2 text-sm">Reason: {pending.reason}</p>
              {current && (
                <p className="text-sm">
                  Annual CTC {formatRupees(current.totals.annualCtc)} →{' '}
                  <strong>{formatRupees(pending.totals.annualCtc)}</strong>{' '}
                  <span className="text-muted">
                    ({pending.totals.annualCtc >= current.totals.annualCtc ? '+' : ''}
                    {(
                      ((pending.totals.annualCtc - current.totals.annualCtc) /
                        current.totals.annualCtc) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </p>
              )}
              <SalaryBreakdown structure={pending} />
              <ErrorText>{error}</ErrorText>
              <div className="flex flex-wrap gap-2">
                {permissions.decidePending && (
                  <>
                    <Button size="sm" onClick={() => setDeciding('approved')}>
                      <Check size={14} /> Approve
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeciding('rejected')}>
                      <X size={14} /> Reject
                    </Button>
                  </>
                )}
                {permissions.approve && !permissions.decidePending && (
                  <p className="text-xs text-muted">
                    You proposed this, so someone else must approve it.
                  </p>
                )}
                {permissions.withdrawPending && (
                  <Button size="sm" variant="ghost" onClick={() => setWithdrawing(true)}>
                    <Undo2 size={14} /> Withdraw
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader
          title="All versions"
          subtitle="Nothing is overwritten: every change is a new version."
        />
        <DataTable
          rows={versions}
          empty={{ title: 'No salary recorded yet' }}
          columns={[
            {
              key: 'version',
              label: 'Version',
              render: (row) => (
                <span className="font-medium">
                  v{row.version}
                  {row.inForce ? ' · in force' : row.upcoming ? ' · upcoming' : ''}
                </span>
              ),
            },
            { key: 'from', label: 'From', render: (row) => formatDay(row.effectiveFrom) },
            {
              key: 'ctc',
              label: 'Annual CTC',
              render: (row) => formatRupees(row.totals.annualCtc),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge tone={SALARY_STATUS[row.status].tone}>
                  {SALARY_STATUS[row.status].label}
                </Badge>
              ),
            },
            {
              key: 'reason',
              label: 'Reason',
              className: 'max-w-xs',
              render: (row) => (
                <span className="line-clamp-2 text-xs">
                  {row.reason}
                  {row.decisionNote ? ` — ${row.decisionNote}` : ''}
                </span>
              ),
            },
            {
              key: 'who',
              label: 'Proposed / decided',
              mobile: false,
              render: (row) => (
                <span className="text-xs text-muted">
                  {row.preparedByName}
                  {row.decidedByName
                    ? ` / ${row.decidedByName}, ${formatDateTime(row.decidedAt)}`
                    : ''}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {proposing && (
        <ProposeDialog
          userId={data.user._id}
          base={pending ?? current}
          onClose={() => setProposing(false)}
          onDone={() => router.refresh()}
        />
      )}
      {deciding && (
        <DecideDialog
          decision={deciding}
          busy={busy}
          error={error}
          onClose={() => setDeciding(null)}
          onSubmit={(note) =>
            act(`/api/salary/${pending._id}/decide`, { decision: deciding, note })
          }
        />
      )}
      <ConfirmDialog
        open={withdrawing}
        title="Withdraw this proposal?"
        text="It stays in the history as withdrawn. You can propose again."
        confirmLabel="Withdraw"
        busy={busy}
        onConfirm={() => act(`/api/salary/${pending._id}/withdraw`)}
        onClose={() => setWithdrawing(false)}
      />
    </div>
  );
}

function ProposeDialog({ userId, base, onClose, onDone }) {
  const [effectiveFrom, setEffectiveFrom] = useState(todayKey());
  const [reason, setReason] = useState('');
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      SALARY_COMPONENTS.map((item) => [
        item.key,
        base ? String((base.components[item.key] ?? 0) / 100) : '',
      ]),
    ),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const number = (key) => Number(values[key]) || 0;
  // Live totals while typing (the server works them out again on save).
  const sum = (kind) =>
    SALARY_COMPONENTS.filter((item) => item.kind === kind).reduce(
      (total, item) => total + number(item.key),
      0,
    );
  const gross = sum('earning');
  const monthlyCtc = gross + sum('variable') + sum('employer');
  const preview = { gross, net: gross - sum('deduction'), monthlyCtc, annual: monthlyCtc * 12 };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/users/${userId}/salary`, {
        method: 'POST',
        body: {
          effectiveFrom,
          reason,
          components: Object.fromEntries(
            SALARY_COMPONENTS.map((item) => [item.key, number(item.key)]),
          ),
        },
      });
      onClose();
      onDone();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  const rupee = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;
  return (
    <Dialog
      open
      onClose={onClose}
      title={base ? 'Propose a salary revision' : 'Set the salary'}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Effective from" htmlFor="salary-from">
            <input
              id="salary-from"
              type="date"
              className={inputClass}
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              required
            />
          </Field>
          <Field label="Reason" htmlFor="salary-reason">
            <input
              id="salary-reason"
              className={inputClass}
              placeholder="Joining, annual increment, promotion …"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </Field>
        </div>
        {COMPONENT_GROUPS.map((group) => (
          <fieldset key={group.kind} className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-1 text-xs font-semibold text-muted">{group.label}, in ₹</legend>
            {SALARY_COMPONENTS.filter((item) => item.kind === group.kind).map((item) => (
              <Field key={item.key} label={item.label} htmlFor={`salary-${item.key}`}>
                <input
                  id={`salary-${item.key}`}
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={values[item.key]}
                  onChange={(event) => setValues({ ...values, [item.key]: event.target.value })}
                />
              </Field>
            ))}
          </fieldset>
        ))}
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-raised p-3 text-sm sm:grid-cols-4">
          <span>
            Gross <strong className="block">{rupee(preview.gross)}</strong>
          </span>
          <span>
            Take-home <strong className="block">{rupee(preview.net)}</strong>
          </span>
          <span>
            Monthly CTC <strong className="block">{rupee(preview.monthlyCtc)}</strong>
          </span>
          <span>
            Annual CTC <strong className="block">{rupee(preview.annual)}</strong>
          </span>
        </div>
        <p className="text-xs text-muted">
          PF, ESI and tax are typed by hand for now; automatic calculation comes with payroll, after
          the CEO decides the rules. Someone other than you must approve this.
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Send for approval
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DecideDialog({ decision, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const approve = decision === 'approved';
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={approve ? 'Approve this salary' : 'Reject this salary'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={approve ? 'primary' : 'danger'}
            onClick={() => onSubmit(note)}
            disabled={busy}
          >
            {approve ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          {approve
            ? 'It takes effect from its effective date.'
            : 'The person who proposed it will see your reason.'}
        </p>
        <Field label={approve ? 'Note (optional)' : 'Reason'} htmlFor="salary-note">
          <input
            id="salary-note"
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Dialog>
  );
}
