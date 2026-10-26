'use client';

import { useListParams } from '@/lib/useListParams.js';
import { formatDateTime } from '@/lib/format.js';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

const ACTIONS = {
  'auth.sign_in': 'Signed in',
  'user.created': 'Employee added',
  'user.updated': 'Employee edited',
  'user.password_set': 'Password set by admin',
  'user.password_changed': 'Own password changed',
  'user.password_viewed': 'Password viewed',
  'leave.approved': 'Leave approved',
  'leave.rejected': 'Leave rejected',
  'push.broadcast': 'Notification sent',
};

function describeChanges(changes) {
  if (!changes) return '';
  return Object.entries(changes)
    .map(([field, value]) =>
      value && typeof value === 'object' && 'from' in value
        ? `${field}: ${value.from ?? '—'} → ${value.to ?? '—'}`
        : field,
    )
    .join(' · ');
}

export function AuditList({ result }) {
  const { get, set, isPending } = useListParams();
  return (
    <div className={isPending ? 'opacity-60' : ''}>
      <div className="border-b border-border p-3">
        <Select
          className={compactInputClass}
          value={get('action')}
          onChange={(event) => set({ action: event.target.value })}
          options={[
            { value: '', label: 'All actions' },
            ...Object.entries(ACTIONS).map(([value, label]) => ({ value, label })),
          ]}
          aria-label="Action"
        />
      </div>
      <DataTable
        rows={result.items}
        empty={{ title: 'Nothing recorded yet' }}
        columns={[
          {
            key: 'when',
            label: 'When',
            render: (row) => (
              <span className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</span>
            ),
          },
          { key: 'who', label: 'Who', render: (row) => row.actorName },
          { key: 'action', label: 'What', render: (row) => ACTIONS[row.action] ?? row.action },
          {
            key: 'summary',
            label: 'Details',
            className: 'max-w-md',
            render: (row) => (
              <span className="text-xs text-muted">
                {[row.summary, describeChanges(row.changes)].filter(Boolean).join(' — ')}
              </span>
            ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </div>
  );
}
