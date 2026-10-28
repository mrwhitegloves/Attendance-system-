'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useListParams } from '@/lib/useListParams.js';
import { formatDateTime, formatRupees } from '@/lib/format.js';
import {
  REQUEST_KINDS,
  REQUEST_STATUS_TONE,
  categoryLabel,
  requestKindOptions,
  requestStatusLabel,
} from '@/config/requestKinds.js';
import { Badge, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter.jsx';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved / done' },
  { value: 'rejected', label: 'Rejected / closed' },
  { value: 'cancelled', label: 'Withdrawn' },
];

/** One box of the inbox, with filters in the address. */
export function RequestList({ result, box, showPerson }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [search, setSearch] = useState(get('q'));
  const defaultStatus = box === 'decide' ? 'pending' : 'all';

  const submitSearch = (event) => {
    event.preventDefault();
    set({ q: search.trim() });
  };

  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <DateRangeFilter label="Sent" />
        {showPerson && (
          <form onSubmit={submitSearch} className="min-w-0 flex-1 sm:max-w-xs">
            <input
              className={`${compactInputClass} w-full`}
              placeholder="Search number, name or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search"
            />
          </form>
        )}
        <Select
          className={compactInputClass}
          value={get('kind')}
          onChange={(event) => set({ kind: event.target.value })}
          options={[{ value: '', label: 'All kinds' }, ...requestKindOptions]}
          aria-label="Kind"
        />
        <Select
          className={compactInputClass}
          value={get('status', defaultStatus)}
          onChange={(event) => set({ status: event.target.value })}
          options={STATUS_OPTIONS}
          aria-label="Status"
        />
      </div>
      <DataTable
        rows={result.items}
        onRowClick={(row) => router.push(`/requests/${row._id}`)}
        empty={{
          title: box === 'decide' ? 'Nothing waiting for you' : 'No requests here',
          text: box === 'mine' ? 'Use "New request" to ask HR for something.' : undefined,
        }}
        columns={[
          {
            key: 'subject',
            label: 'Request',
            render: (row) => (
              <div>
                <p className="font-medium">{row.subject}</p>
                <p className="text-xs text-muted">
                  {row.number} · {REQUEST_KINDS[row.kind].label}
                  {row.category ? ` · ${categoryLabel(row.kind, row.category)}` : ''}
                </p>
              </div>
            ),
          },
          ...(showPerson
            ? [
                {
                  key: 'person',
                  label: 'Employee',
                  render: (row) => (
                    <span>
                      {row.employeeName}{' '}
                      <span className="text-xs text-muted">{row.employeeId}</span>
                    </span>
                  ),
                },
              ]
            : []),
          {
            key: 'amount',
            label: 'Amount',
            className: 'text-right',
            render: (row) => (
              <span className="tabular-nums">
                {row.amountPaise === null ? '—' : formatRupees(row.amountPaise)}
              </span>
            ),
          },
          {
            key: 'sent',
            label: 'Sent',
            mobile: false,
            render: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <Badge tone={REQUEST_STATUS_TONE[row.status]}>
                {requestStatusLabel(row.kind, row.status)}
              </Badge>
            ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
