'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Undo2, UserPlus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime, formatDay, formatRupees } from '@/lib/format.js';
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_STATUS_TONE,
  idleStatusOptions,
  returnStatusOptions,
} from '@/config/assetOptions.js';
import { Badge, Button, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';
import { AssetFormDialog } from './AssetFormDialog.jsx';

const ACTION_WORDS = {
  added: 'Added to stock',
  assigned: 'Handed over',
  returned: 'Taken back',
  status: 'Status changed',
};

/** One asset: details, who has it, hand over / take back, and its whole history. */
export function AssetDetail({ asset, people, canManage }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);
  const saved = () => {
    close();
    router.refresh();
  };

  const rows = [
    ['Kind', ASSET_CATEGORIES[asset.category]],
    asset.serialNumber && ['Serial / number', asset.serialNumber],
    asset.valuePaise !== null && ['Value', formatRupees(asset.valuePaise)],
    asset.purchasedOn && ['Bought on', formatDay(asset.purchasedOn)],
    asset.status === 'assigned' && [
      'With',
      <Link key="with" href={`/employees/${asset.userId}`} className="text-brand hover:underline">
        {asset.employeeName} ({asset.employeeId})
      </Link>,
    ],
    asset.assignedAt && ['Since', formatDateTime(asset.assignedAt)],
  ].filter(Boolean);

  return (
    <>
      <Link
        href="/assets"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={15} /> Assets
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{asset.code}</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {asset.name}
            <Badge tone={ASSET_STATUS_TONE[asset.status]}>{ASSET_STATUSES[asset.status]}</Badge>
          </h1>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDialog('edit')}>
              <Pencil size={15} /> Edit
            </Button>
            {asset.status === 'assigned' ? (
              <Button size="sm" onClick={() => setDialog('return')}>
                <Undo2 size={15} /> Take back
              </Button>
            ) : (
              <>
                {asset.status !== 'retired' && (
                  <Button variant="secondary" size="sm" onClick={() => setDialog('status')}>
                    Change status
                  </Button>
                )}
                {asset.status === 'in_stock' && (
                  <Button size="sm" onClick={() => setDialog('assign')}>
                    <UserPlus size={15} /> Hand over
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <dl className="divide-y divide-border text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {asset.note && (
            <p className="whitespace-pre-wrap border-t border-border px-4 py-3 text-sm">
              {asset.note}
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="History" subtitle="Newest first. Nothing is ever removed." />
          <ol className="divide-y divide-border text-sm">
            {asset.history.map((entry, index) => (
              <li key={index} className="px-4 py-2.5">
                <p className="font-medium">
                  {ACTION_WORDS[entry.action]}
                  {entry.employeeName &&
                    ` ${entry.action === 'returned' ? 'from' : 'to'} ${entry.employeeName}`}
                  {entry.status && entry.action !== 'added' && ` · ${ASSET_STATUSES[entry.status]}`}
                </p>
                {(entry.condition || entry.note) && (
                  <p className="text-muted">
                    {[entry.condition && `Condition: ${entry.condition}`, entry.note]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <p className="text-xs text-muted">
                  {entry.byName} · {formatDateTime(entry.at)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {canManage && (
        <>
          <AssetFormDialog
            key={`edit-${asset.updatedAt}`}
            open={dialog === 'edit'}
            onClose={close}
            onSaved={saved}
            asset={asset}
          />
          <MoveDialog
            key={`move-${dialog}-${asset.updatedAt}`}
            kind={dialog}
            asset={asset}
            people={people}
            onClose={close}
            onSaved={saved}
          />
        </>
      )}
    </>
  );
}

/** Hand over, take back, or change the status while nobody has it. */
function MoveDialog({ kind, asset, people, onClose, onSaved }) {
  const [form, setForm] = useState({
    userId: people[0]?._id ?? '',
    status:
      kind === 'status' ? (asset.status === 'in_stock' ? 'under_repair' : 'in_stock') : 'in_stock',
    condition: '',
    note: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const open = ['assign', 'return', 'status'].includes(kind);
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (kind === 'assign') {
        await apiFetch(`/api/assets/${asset._id}/assign`, {
          method: 'POST',
          body: { userId: form.userId, condition: form.condition, note: form.note },
        });
      } else if (kind === 'return') {
        await apiFetch(`/api/assets/${asset._id}/return`, {
          method: 'POST',
          body: { status: form.status, condition: form.condition, note: form.note },
        });
      } else {
        await apiFetch(`/api/assets/${asset._id}`, {
          method: 'PATCH',
          body: { status: form.status, statusNote: form.note },
        });
      }
      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const title = {
    assign: `Hand over ${asset.name}`,
    return: `Take back from ${asset.employeeName}`,
    status: `Status of ${asset.name}`,
  }[kind];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? ''}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || (kind === 'assign' && !form.userId)}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {kind === 'assign' && (
          <Field label="Employee" htmlFor="move-person">
            <Select
              id="move-person"
              value={form.userId}
              onChange={change('userId')}
              options={people.map((person) => ({
                value: person._id,
                label: `${person.name} (${person.employeeId})`,
              }))}
            />
          </Field>
        )}
        {kind !== 'assign' && (
          <Field
            label={kind === 'return' ? 'Where does it go now?' : 'New status'}
            htmlFor="move-status"
          >
            <Select
              id="move-status"
              value={form.status}
              onChange={change('status')}
              options={(kind === 'return' ? returnStatusOptions : idleStatusOptions).filter(
                (option) => kind === 'return' || option.value !== asset.status,
              )}
            />
          </Field>
        )}
        {kind !== 'status' && (
          <Field label="Condition (optional)" htmlFor="move-condition">
            <input
              id="move-condition"
              className={inputClass}
              value={form.condition}
              onChange={change('condition')}
              maxLength={200}
              placeholder="e.g. Good, small scratch on the lid"
            />
          </Field>
        )}
        <Field label="Note (optional)" htmlFor="move-note">
          <input
            id="move-note"
            className={inputClass}
            value={form.note}
            onChange={change('note')}
            maxLength={300}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Dialog>
  );
}
