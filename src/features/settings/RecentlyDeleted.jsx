'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { useListParams } from '@/lib/useListParams.js';
import { formatDateTime } from '@/lib/format.js';
import { Badge, Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { ConfirmDialog } from '@/components/shared/Dialog.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

// Where a restored item shows again.
const PLACE = {
  employee: (id) => `/employees/${id}`,
  offer_letter: (id) => `/letters/${id}`,
  kyc_link: () => '/kyc-links',
  holiday: () => '/settings/holidays',
  comp_off: (id) => `/employees/${id}/leave`,
};

const daysLeft = (expiresAt) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

/** Settings → Recently deleted: restore within 90 days, or delete for good. */
export function RecentlyDeleted({ result, kinds }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [confirm, setConfirm] = useState(null); // { item, action: 'restore' | 'forever' }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const { item, action } = confirm;
    setBusy(true);
    setError('');
    try {
      if (action === 'restore') {
        const restored = await apiFetch(`/api/trash/${item._id}/restore`, { method: 'POST' });
        setConfirm(null);
        router.push(PLACE[restored.kind]?.(restored.entityId) ?? '/settings/recently-deleted');
      } else {
        await apiFetch(`/api/trash/${item._id}`, { method: 'DELETE' });
        setConfirm(null);
      }
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      <Card className={isPending ? 'opacity-60' : ''}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Select
            className={compactInputClass}
            value={get('kind', '')}
            onChange={(event) => set({ kind: event.target.value })}
            options={[{ value: '', label: 'Everything' }, ...kinds]}
            aria-label="Kind"
          />
          <p className="text-xs text-muted">
            Deleted items stay here for 90 days, then they are removed for good by themselves.
          </p>
        </div>
        <DataTable
          rows={result.items}
          empty={{ title: 'Nothing deleted', text: 'Deleted items show here for 90 days.' }}
          columns={[
            {
              key: 'label',
              label: 'Item',
              render: (row) => (
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="text-xs text-muted">
                    <Badge>{row.kindLabel}</Badge> {row.detail}
                  </p>
                </div>
              ),
            },
            {
              key: 'deleted',
              label: 'Deleted',
              mobile: false,
              render: (row) => (
                <span className="text-xs text-muted">
                  {formatDateTime(row.deletedAt)}
                  {row.deletedByName ? ` by ${row.deletedByName}` : ''}
                </span>
              ),
            },
            {
              key: 'left',
              label: 'Days left',
              render: (row) => {
                const left = daysLeft(row.expiresAt);
                return (
                  <Badge tone={left <= 7 ? 'warning' : 'neutral'}>
                    {left} day{left === 1 ? '' : 's'}
                  </Badge>
                );
              },
            },
            {
              key: 'actions',
              label: '',
              render: (row) =>
                row.canRestore ? (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirm({ item: row, action: 'restore' })}
                    >
                      <RotateCcw size={14} /> Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete for good"
                      title="Delete for good"
                      onClick={() => setConfirm({ item: row, action: 'forever' })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
        <Pagination page={result.page} pages={result.pages} total={result.total} />
      </Card>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.action === 'restore'
            ? `Restore ${confirm.item.label}?`
            : `Delete ${confirm?.item.label ?? ''} for good?`
        }
        text={
          confirm?.action === 'restore'
            ? 'It goes back to where it was, exactly as it was when deleted.'
            : 'It is removed now and cannot be restored any more.'
        }
        confirmLabel={confirm?.action === 'restore' ? 'Restore' : 'Delete for good'}
        danger={confirm?.action === 'forever'}
        busy={busy}
        onConfirm={run}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
