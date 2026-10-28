'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCheck, Download, FileSpreadsheet, Wallet } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { useListParams } from '@/lib/useListParams.js';
import { formatDay, formatMonth, formatRupees, todayKey } from '@/lib/format.js';
import {
  PAYOUT_STATUS,
  PAY_MODES,
  needsReference,
  payModeOptions,
} from '@/config/payoutOptions.js';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ErrorText,
  StatTile,
} from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter.jsx';
import { Field, compactInputClass, inputClass, Select } from '@/components/shared/form.jsx';

/** The address of the same list as a CSV export (same filters). */
const exportHref = (filters) => {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([key, value]) => value && key !== 'page'),
  );
  return `/api/payouts/export?${params}`;
};

export function PayoutsScreen({ result, filters }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [search, setSearch] = useState(get('q'));
  const [chosen, setChosen] = useState([]);
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const approvable = result.items.filter((item) => item.payout?.status === 'unpaid');

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/payouts/approve', { method: 'POST', body: { ids: chosen } });
      setChosen([]);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id) =>
    setChosen((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));

  return (
    <div className={`space-y-4 ${isPending ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label={`Paid${filters.range || filters.from || filters.to ? ' (in the chosen dates)' : ''}`}
          value={formatRupees(result.totals.paid.net)}
          hint={`${result.totals.paid.count} salary payment(s)`}
          tone="success"
        />
        <StatTile
          label="Approved, not paid"
          value={formatRupees(result.totals.approved.net)}
          hint={`${result.totals.approved.count} to pay`}
          tone="info"
        />
        <StatTile
          label="Waiting for CEO approval"
          value={formatRupees(result.totals.unpaid.net)}
          hint={`${result.totals.unpaid.count} final slip(s)`}
          tone="warning"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              set({ q: search.trim() });
            }}
            className="min-w-0 flex-1 sm:max-w-[14rem]"
          >
            <input
              className={`${compactInputClass} w-full`}
              placeholder="Search name or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search"
            />
          </form>
          <Select
            className={compactInputClass}
            value={get('status')}
            onChange={(event) => set({ status: event.target.value })}
            options={[
              { value: '', label: 'Any status' },
              ...Object.entries(PAYOUT_STATUS).map(([value, item]) => ({
                value,
                label: item.label,
              })),
            ]}
            aria-label="Status"
          />
          <input
            type="month"
            className={compactInputClass}
            value={get('month')}
            onChange={(event) => set({ month: event.target.value })}
            aria-label="Salary month"
            title="Salary month"
          />
          <DateRangeFilter label="Paid on" />
          <span className="ml-auto flex flex-wrap gap-2">
            {result.canApprove && chosen.length > 0 && (
              <Button size="sm" onClick={approve} disabled={busy}>
                <CheckCheck size={15} /> Approve {chosen.length}
              </Button>
            )}
            {result.canPay && get('month') && (
              <ButtonLink
                size="sm"
                variant="secondary"
                href={`/api/payouts/bank-file?month=${get('month')}`}
              >
                <FileSpreadsheet size={15} /> Bank file
              </ButtonLink>
            )}
            <ButtonLink size="sm" variant="secondary" href={exportHref(filters)}>
              <Download size={15} /> Export
            </ButtonLink>
          </span>
        </div>
        {error && (
          <div className="px-3 pt-3">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        {result.canApprove && approvable.length > 0 && (
          <label className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={approvable.every((item) => chosen.includes(item._id))}
              onChange={(event) =>
                setChosen(event.target.checked ? approvable.map((item) => item._id) : [])
              }
            />
            Choose every salary waiting for approval on this page
          </label>
        )}
        <DataTable
          rows={result.items}
          empty={{ title: 'No final salary slips here' }}
          columns={[
            {
              key: 'person',
              label: 'Employee',
              render: (row) => (
                <span className="flex items-center gap-2">
                  {result.canApprove && row.payout?.status === 'unpaid' && (
                    <input
                      type="checkbox"
                      checked={chosen.includes(row._id)}
                      onChange={() => toggle(row._id)}
                      aria-label={`Choose ${row.employee.name}`}
                    />
                  )}
                  <span>
                    <Link href={`/payslips/${row._id}`} className="font-medium hover:underline">
                      {row.employee.name}
                    </Link>
                    <span className="block text-xs text-muted">
                      {row.employee.code || row.employeeId}
                    </span>
                  </span>
                </span>
              ),
            },
            { key: 'month', label: 'Salary month', render: (row) => formatMonth(row.month) },
            {
              key: 'net',
              label: 'Net salary',
              className: 'text-right',
              render: (row) => <span className="tabular-nums">{formatRupees(row.totals.net)}</span>,
            },
            {
              key: 'due',
              label: 'Due',
              mobile: false,
              render: (row) => (
                <span className={row.overdue ? 'font-medium text-danger' : 'text-muted'}>
                  {formatDay(row.dueOn)}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => {
                const payout = row.payout ?? { status: 'unpaid' };
                return (
                  <span>
                    <Badge tone={PAYOUT_STATUS[payout.status].tone}>
                      {PAYOUT_STATUS[payout.status].label}
                    </Badge>
                    {payout.status === 'paid' && (
                      <span className="block text-xs text-muted">
                        {formatDay(payout.paidOn)} · {PAY_MODES[payout.mode]}
                        {payout.reference ? ` · ${payout.reference}` : ''}
                      </span>
                    )}
                  </span>
                );
              },
            },
            {
              key: 'action',
              label: '',
              render: (row) =>
                result.canPay && row.payout?.status === 'approved' ? (
                  <Button size="sm" variant="secondary" onClick={() => setPaying(row)}>
                    <Wallet size={14} /> Record payment
                  </Button>
                ) : null,
            },
          ]}
        />
        <Pagination page={result.page} pages={result.pages} total={result.total} />
      </Card>

      {result.byMonth.length > 0 && (
        <Card>
          <CardHeader title="Paid per salary month" subtitle="Inside the chosen filters." />
          <ul className="divide-y divide-border text-sm">
            {result.byMonth.map((row) => (
              <li key={row._id} className="flex justify-between px-4 py-2.5">
                <span>
                  {formatMonth(row._id)}{' '}
                  <span className="text-xs text-muted">· {row.count} paid</span>
                </span>
                <span className="font-semibold tabular-nums">{formatRupees(row.net)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {paying && <PaymentDialog slip={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PaymentDialog({ slip, onClose }) {
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
      await apiFetch(`/api/payslips/${slip._id}/paid`, { method: 'POST', body });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Salary paid: ${slip.employee.name}`} size="sm">
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm">
          {formatMonth(slip.month)} · <strong>{formatRupees(slip.totals.net)}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid on" htmlFor="pay-on">
            <input
              id="pay-on"
              type="date"
              className={inputClass}
              value={form.paidOn}
              max={todayKey()}
              onChange={change('paidOn')}
              required
            />
          </Field>
          <Field label="How" htmlFor="pay-mode">
            <Select
              id="pay-mode"
              value={form.mode}
              onChange={change('mode')}
              options={payModeOptions}
            />
          </Field>
        </div>
        {needsReference(form.mode) ? (
          <Field label="UTR, UPI or cheque number" htmlFor="pay-reference">
            <input
              id="pay-reference"
              className={inputClass}
              value={form.reference}
              onChange={change('reference')}
              required
              maxLength={80}
            />
          </Field>
        ) : null}
        <Field
          label={needsReference(form.mode) ? 'Note (optional)' : 'Who received the cash'}
          htmlFor="pay-note"
        >
          <input
            id="pay-note"
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
