'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Check, FileText, Plus, Save, Trash2, Wallet } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDay, formatMonth, formatRupees, todayKey } from '@/lib/format.js';
import { PAY_MODES, needsReference, payModeOptions } from '@/config/payoutOptions.js';
import { Badge, Button, ButtonLink, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, compactInputClass, inputClass, Select } from '@/components/shared/form.jsx';

const STATUS = {
  draft: { label: 'Draft, waiting for the CEO', tone: 'warning' },
  approved: { label: 'Approved, not settled', tone: 'info' },
  paid: { label: 'Settled', tone: 'success' },
};

const toForm = (lines) =>
  lines.map((line) => ({ ...line, amount: String(line.amountPaise / 100) }));

/** The full and final of an exit: prepare, change, approve, settle, print. */
export function SettlementCard({ userId, data, canManage, canApprove, canPay }) {
  const router = useRouter();
  const settlement = data?.settlement ?? null;
  const [lines, setLines] = useState(() => toForm(settlement?.lines ?? []));
  const [noticeDays, setNoticeDays] = useState(String(settlement?.noticeDays ?? 30));
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `/api/users/${userId}/settlement`;
  const draft = settlement?.status === 'draft';
  const editable = draft && canManage;

  const run = async (path, options) => {
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch(path, options);
      if (result?.settlement) setLines(toForm(result.settlement.lines));
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const setLine = (index, changes) =>
    setLines(lines.map((line, at) => (at === index ? { ...line, ...changes } : line)));
  const add = lines
    .filter((line) => line.kind === 'add')
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const deduct = lines
    .filter((line) => line.kind === 'deduct')
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const net = Math.round((add - deduct) * 100);

  return (
    <Card>
      <CardHeader
        title="Full and final settlement"
        subtitle="The salary of the last month comes on its normal salary slip."
        action={
          settlement && (
            <Badge tone={STATUS[settlement.status].tone}>{STATUS[settlement.status].label}</Badge>
          )
        }
      />
      <div className="space-y-3 px-4 pb-4 text-sm">
        {data?.unpaidSlips?.length > 0 && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Salary slips not paid yet:{' '}
            {data.unpaidSlips
              .map((slip) => `${formatMonth(slip.month)} (${formatRupees(slip.totals.net)})`)
              .join(', ')}
            .
          </p>
        )}

        {!settlement &&
          (canManage ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Notice days to give" htmlFor="settlement-notice">
                <input
                  id="settlement-notice"
                  type="number"
                  min="0"
                  max="180"
                  className={compactInputClass}
                  value={noticeDays}
                  onChange={(event) => setNoticeDays(event.target.value)}
                />
              </Field>
              <Button
                onClick={() =>
                  run(base, { method: 'POST', body: { noticeDays: Number(noticeDays) } })
                }
                disabled={busy}
              >
                <Calculator size={15} /> Prepare
              </Button>
            </div>
          ) : (
            <p className="text-muted">Not prepared yet.</p>
          ))}

        {settlement && (
          <>
            {settlement.basis && (
              <p className="text-xs text-muted">
                One day = {formatRupees(settlement.basis.perDayPaise)} (monthly gross{' '}
                {formatRupees(settlement.basis.monthlyGrossPaise)} ÷ {settlement.basis.daysInMonth}{' '}
                days) · paid leave balance {settlement.basis.leaveBalance} · notice served{' '}
                {settlement.basis.servedDays} of {settlement.noticeDays} days
              </p>
            )}
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="grid items-center gap-2 rounded-lg border border-border p-2 sm:grid-cols-[110px_1fr_120px_auto]"
                >
                  {editable ? (
                    <>
                      <Select
                        className={compactInputClass}
                        value={line.kind}
                        onChange={(event) => setLine(index, { kind: event.target.value })}
                        options={[
                          { value: 'add', label: 'Pay' },
                          { value: 'deduct', label: 'Take back' },
                        ]}
                        aria-label={`Line ${index + 1} kind`}
                      />
                      <input
                        className={compactInputClass}
                        value={line.label}
                        onChange={(event) => setLine(index, { label: event.target.value })}
                        maxLength={120}
                        aria-label={`Line ${index + 1} label`}
                        placeholder="What for"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={compactInputClass}
                        value={line.amount}
                        onChange={(event) => setLine(index, { amount: event.target.value })}
                        aria-label={`Line ${index + 1} amount`}
                      />
                      <button
                        type="button"
                        className="rounded p-1 text-muted hover:text-danger"
                        onClick={() => setLines(lines.filter((_, at) => at !== index))}
                        aria-label={`Remove line ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={line.kind === 'add' ? 'text-success' : 'text-danger'}>
                        {line.kind === 'add' ? 'Pay' : 'Take back'}
                      </span>
                      <span>
                        {line.label}
                        {line.note && <span className="block text-xs text-muted">{line.note}</span>}
                      </span>
                      <span className="text-right tabular-nums">
                        {formatRupees(line.amountPaise)}
                      </span>
                      <span />
                    </>
                  )}
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-muted">No lines: nothing to pay or take back.</p>
              )}
            </div>
            {editable && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLines([...lines, { kind: 'add', label: '', amount: '0', note: '' }])
                  }
                >
                  <Plus size={14} /> Add line
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(base, { method: 'POST', body: { noticeDays: Number(noticeDays) } })
                  }
                >
                  <Calculator size={14} /> Suggest again
                </Button>
              </div>
            )}
            <p className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>
                {net >= 0 ? 'Net payable to the employee' : 'Net payable by the employee'}
              </span>
              <span className="tabular-nums">
                {formatRupees(Math.abs(draft ? net : settlement.totals.net))}
              </span>
            </p>
            {settlement.approvedByName && (
              <p className="text-xs text-muted">Approved by {settlement.approvedByName}</p>
            )}
            {settlement.status === 'paid' && settlement.paidOn && (
              <p className="text-xs text-muted">
                Settled on {formatDay(settlement.paidOn)} · {PAY_MODES[settlement.mode]}
                {settlement.reference ? ` · ${settlement.reference}` : ''} · recorded by{' '}
                {settlement.paidByName}
              </p>
            )}
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex flex-wrap justify-end gap-2">
              <ButtonLink variant="secondary" size="sm" href={`${base}/pdf`} target="_blank">
                <FileText size={14} /> Statement PDF
              </ButtonLink>
              {editable && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(base, {
                      method: 'PUT',
                      body: {
                        noticeDays: Number(noticeDays),
                        lines: lines.map((line) => ({
                          kind: line.kind,
                          label: line.label,
                          amount: Number(line.amount || 0),
                          ...(line.note ? { note: line.note } : {}),
                        })),
                      },
                    })
                  }
                >
                  <Save size={14} /> Save
                </Button>
              )}
              {draft && canApprove && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => run(`${base}/approve`, { method: 'POST' })}
                >
                  <Check size={14} /> Approve
                </Button>
              )}
              {settlement.status === 'approved' && canPay && (
                <Button size="sm" onClick={() => setPaying(true)}>
                  <Wallet size={14} />{' '}
                  {settlement.totals.net < 0 ? 'Record money recovered' : 'Record payment'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      {paying && <PaymentDialog base={base} onClose={() => setPaying(false)} />}
    </Card>
  );
}

function PaymentDialog({ base, onClose }) {
  const router = useRouter();
  const [form, setForm] = useState({
    paidOn: todayKey(),
    mode: 'bank_transfer',
    reference: '',
    note: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { paidOn: form.paidOn, mode: form.mode };
      if (form.reference.trim()) body.reference = form.reference.trim();
      if (form.note.trim()) body.note = form.note.trim();
      await apiFetch(`${base}/paid`, { method: 'POST', body });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title="Full and final settled" size="sm">
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="On" htmlFor="settle-on">
            <input
              id="settle-on"
              type="date"
              className={inputClass}
              value={form.paidOn}
              max={todayKey()}
              onChange={change('paidOn')}
              required
            />
          </Field>
          <Field label="How" htmlFor="settle-mode">
            <Select
              id="settle-mode"
              value={form.mode}
              onChange={change('mode')}
              options={payModeOptions}
            />
          </Field>
        </div>
        {needsReference(form.mode) && (
          <Field label="UTR, UPI or cheque number" htmlFor="settle-reference">
            <input
              id="settle-reference"
              className={inputClass}
              value={form.reference}
              onChange={change('reference')}
              required
              maxLength={80}
            />
          </Field>
        )}
        <Field
          label={needsReference(form.mode) ? 'Note (optional)' : 'Who gave or got the cash'}
          htmlFor="settle-note"
        >
          <input
            id="settle-note"
            className={inputClass}
            value={form.note}
            onChange={change('note')}
            required={!needsReference(form.mode)}
            maxLength={300}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
