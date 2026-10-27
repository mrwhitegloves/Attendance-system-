'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Printer, RefreshCcw, RotateCcw, Save } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime, formatMonth, formatRupees } from '@/lib/format.js';
import { ATTENDANCE_SUMMARY, DEDUCTIONS, EARNINGS } from '@/config/payslipFields.js';
import { Badge, Button, ButtonLink, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { ConfirmDialog, Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

const EMPLOYEE_FIELDS = [
  ['name', 'Employee name'],
  ['code', 'Employee code'],
  ['designation', 'Designation'],
  ['department', 'Department'],
  ['joiningDate', 'Date of joining', 'date'],
  ['bankName', 'Bank name'],
];

const rupeesOf = (paise) => String((paise ?? 0) / 100);

/** Form values from a slip: rupees as text, so any field can be typed freely. */
function toForm(slip) {
  return {
    employee: Object.fromEntries(EMPLOYEE_FIELDS.map(([key]) => [key, slip.employee[key] ?? ''])),
    pan: '',
    accountNumber: '',
    attendance: Object.fromEntries(
      ATTENDANCE_SUMMARY.map((line) => [line.key, String(slip.attendance[line.key] ?? 0)]),
    ),
    earnings: Object.fromEntries(
      EARNINGS.map((line) => [line.key, rupeesOf(slip.earnings[line.key])]),
    ),
    deductions: Object.fromEntries(
      DEDUCTIONS.map((line) => [line.key, rupeesOf(slip.deductions[line.key])]),
    ),
    notes: slip.notes ?? '',
  };
}

/** Only what changed, in the shape the API takes. */
function changes(form, initial) {
  const body = {};
  const employee = Object.fromEntries(
    Object.entries(form.employee).filter(([key, value]) => value !== initial.employee[key]),
  );
  if (form.pan) employee.pan = form.pan;
  if (form.accountNumber) employee.accountNumber = form.accountNumber;
  if (Object.keys(employee).length) body.employee = employee;
  for (const group of ['attendance', 'earnings', 'deductions']) {
    const changed = Object.fromEntries(
      Object.entries(form[group])
        .filter(([key, value]) => value !== initial[group][key])
        .map(([key, value]) => [key, Number(value) || 0]),
    );
    if (Object.keys(changed).length) body[group] = changed;
  }
  if (form.notes !== initial.notes) body.notes = form.notes;
  return body;
}

export function PayslipEditor({ slip }) {
  const router = useRouter();
  const [initial, setInitial] = useState(() => toForm(slip));
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // 'finalise' | 'prefill' | 'reopen'
  const editable = slip.permissions.edit;

  const set = (group, key) => (event) =>
    setForm({ ...form, [group]: { ...form[group], [key]: event.target.value } });
  const total = (group, lines) =>
    lines.reduce((sum, line) => sum + (Number(form[group][line.key]) || 0), 0);
  const earnings = total('earnings', EARNINGS);
  const deductions = total('deductions', DEDUCTIONS);
  const dirty = Object.keys(changes(form, initial)).length > 0;

  const run = async (action, after) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await action();
      if (result?._id) {
        const next = toForm(result);
        setInitial(next);
        setForm(next);
      }
      setDialog(null);
      if (after) setMessage(after);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(
      () =>
        apiFetch(`/api/payslips/${slip._id}`, { method: 'PATCH', body: changes(form, initial) }),
      'Saved.',
    );
  const action = (name, body) =>
    run(() => apiFetch(`/api/payslips/${slip._id}/${name}`, { method: 'POST', body }));

  const numberInput = (group, line, step = '1') => (
    <Field key={line.key} label={line.label} htmlFor={`${group}-${line.key}`}>
      <input
        id={`${group}-${line.key}`}
        type="number"
        min="0"
        step={step}
        className={inputClass}
        value={form[group][line.key]}
        onChange={set(group, line.key)}
        disabled={!editable}
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold">
              Salary slip · {formatMonth(slip.month)}
              <Badge tone={slip.status === 'final' ? 'success' : 'warning'}>
                {slip.status === 'final' ? 'Final' : 'Draft'}
              </Badge>
            </p>
            <p className="text-sm text-muted">
              {slip.employee.name} · {slip.employee.code}
              {slip.finalisedAt ? ` · final since ${formatDateTime(slip.finalisedAt)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink variant="secondary" href={`/print/payslips/${slip._id}`} target="_blank">
              <Printer size={16} /> Print / PDF
            </ButtonLink>
            {editable && (
              <>
                <Button variant="secondary" onClick={() => setDialog('prefill')} disabled={busy}>
                  <RefreshCcw size={16} /> Fill again from records
                </Button>
                <Button onClick={save} disabled={busy || !dirty}>
                  <Save size={16} /> Save changes
                </Button>
              </>
            )}
            {slip.permissions.finalise && !dirty && (
              <Button onClick={() => setDialog('finalise')} disabled={busy}>
                <Check size={16} /> Make final
              </Button>
            )}
            {slip.permissions.reopen && (
              <Button variant="secondary" onClick={() => setDialog('reopen')} disabled={busy}>
                <RotateCcw size={16} /> Re-open
              </Button>
            )}
          </div>
        </div>
        {(error || message || (slip.status === 'draft' && slip.permissions.lastEditedByYou)) && (
          <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
            <ErrorText>{error}</ErrorText>
            {message && <p className="text-success">{message}</p>}
            {slip.status === 'draft' && slip.permissions.lastEditedByYou && (
              <p className="text-xs text-muted">
                You made the last change, so someone else must make this slip final.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Employee details"
              subtitle="Copied from the employee file and KYC; change them only for this slip."
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              {EMPLOYEE_FIELDS.map(([key, label, type]) => (
                <Field key={key} label={label} htmlFor={`employee-${key}`}>
                  <input
                    id={`employee-${key}`}
                    type={type ?? 'text'}
                    className={inputClass}
                    value={form.employee[key]}
                    onChange={set('employee', key)}
                    disabled={!editable}
                  />
                </Field>
              ))}
              <Field
                label={`PAN (now ${slip.employee.pan || 'empty'})`}
                htmlFor="employee-pan"
                hint="Type a new PAN only to replace it."
              >
                <input
                  id="employee-pan"
                  className={`${inputClass} uppercase`}
                  value={form.pan}
                  onChange={(event) => setForm({ ...form, pan: event.target.value })}
                  disabled={!editable}
                  autoComplete="off"
                />
              </Field>
              <Field
                label={`Bank account (now ${slip.employee.account || 'empty'})`}
                htmlFor="employee-account"
                hint="Type a new number only to replace it."
              >
                <input
                  id="employee-account"
                  className={inputClass}
                  value={form.accountNumber}
                  onChange={(event) => setForm({ ...form, accountNumber: event.target.value })}
                  disabled={!editable}
                  autoComplete="off"
                />
              </Field>
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Attendance"
              subtitle="Filled from the month's punches and leave; change as needed."
            />
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
              {ATTENDANCE_SUMMARY.map((line) => numberInput('attendance', line, '0.5'))}
            </div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Earnings (₹)" />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {EARNINGS.map((line) => numberInput('earnings', line))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Deductions (₹)" />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {DEDUCTIONS.map((line) => numberInput('deductions', line))}
              </div>
            </Card>
          </div>
          <Card className="p-4">
            <Field label="Note (not printed)" htmlFor="payslip-notes">
              <textarea
                id="payslip-notes"
                rows={2}
                className={`${inputClass} h-auto py-2`}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                disabled={!editable}
              />
            </Field>
          </Card>
        </div>
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader title="Totals" />
          <dl className="space-y-2 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Total earnings</dt>
              <dd className="tabular-nums">{formatRupees(earnings * 100)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Total deductions</dt>
              <dd className="tabular-nums">{formatRupees(deductions * 100)}</dd>
            </div>
            <div
              className={`flex justify-between border-t border-border pt-2 text-base font-semibold ${earnings - deductions < 0 ? 'text-danger' : ''}`}
            >
              <dt>Net payable</dt>
              <dd className="tabular-nums">{formatRupees((earnings - deductions) * 100)}</dd>
            </div>
            {!dirty && <p className="text-xs italic text-muted">{slip.netInWords}</p>}
            {dirty && <p className="text-xs text-warning">Not saved yet.</p>}
          </dl>
        </Card>
      </div>

      <ConfirmDialog
        open={dialog === 'finalise'}
        title="Make this slip final?"
        text="The slip is locked and the employee can see it. To change it later it must be re-opened with a reason."
        confirmLabel="Make final"
        busy={busy}
        onConfirm={() => action('finalise')}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'prefill'}
        title="Fill again from the records?"
        text="Every field is filled again from the employee file, KYC, the salary in force and this month's attendance. Your changes on this slip are replaced."
        confirmLabel="Fill again"
        danger
        busy={busy}
        onConfirm={() => action('prefill')}
        onClose={() => setDialog(null)}
      />
      {dialog === 'reopen' && (
        <ReopenDialog
          busy={busy}
          error={error}
          onClose={() => setDialog(null)}
          onSubmit={(reason) => action('reopen', { reason })}
        />
      )}
    </div>
  );
}

function ReopenDialog({ busy, error, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Re-open this slip"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(reason)} disabled={busy}>
            Re-open
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted">It becomes a draft again. The reason is kept in the audit log.</p>
        <Field label="Reason" htmlFor="reopen-reason">
          <input
            id="reopen-reason"
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Dialog>
  );
}
