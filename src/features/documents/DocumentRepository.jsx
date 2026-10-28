'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useListParams } from '@/lib/useListParams.js';
import { formatDateTime, formatDay } from '@/lib/format.js';
import { REVIEW_STATUS, SIGNATURE_STATUS } from '@/config/reviewStatus.js';
import { Badge, Button, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { PersonCell } from '@/components/shared/Avatar.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

const FILTERS = ['q', 'status', 'category', 'typeId', 'expiring'];

/** The central document list with filters in the address. */
export function DocumentRepository({ result, types, categories }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [search, setSearch] = useState(get('q'));
  useEffect(() => {
    if (search === get('q')) return undefined;
    const timer = setTimeout(() => set({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, get, set]);
  const hasFilters = FILTERS.some((key) => get(key));
  const select = (key, label, options) => (
    <Select
      className={compactInputClass}
      value={get(key)}
      onChange={(event) => set({ [key]: event.target.value })}
      options={[{ value: '', label }, ...options]}
      aria-label={label}
    />
  );

  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <input
          className={`${compactInputClass} min-w-0 flex-1 sm:max-w-xs`}
          placeholder="Search employee name or ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search"
        />
        {select(
          'status',
          'All statuses',
          Object.entries(REVIEW_STATUS)
            .filter(([value]) => value !== 'missing')
            .map(([value, status]) => ({ value, label: status.label })),
        )}
        {select('category', 'All groups', categories)}
        {select('typeId', 'All types', types)}
        {select('expiring', 'Any expiry', [{ value: 'soon', label: 'Expiring in 30 days' }])}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              set(Object.fromEntries(FILTERS.map((key) => [key, ''])));
            }}
          >
            Clear
          </Button>
        )}
      </div>
      <DataTable
        rows={result.items}
        onRowClick={(row) => row.user && router.push(`/employees/${row.user._id}/documents`)}
        empty={{
          title: 'No documents found',
          text: hasFilters
            ? 'Try other filters.'
            : 'Upload documents on an employee’s Documents tab.',
        }}
        columns={[
          {
            key: 'person',
            label: 'Employee',
            render: (row) =>
              row.user ? <PersonCell name={row.user.name} employeeId={row.user.employeeId} /> : '—',
          },
          { key: 'type', label: 'Document', render: (row) => row.type?.name ?? '—' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className="flex flex-wrap gap-1">
                <Badge tone={REVIEW_STATUS[row.status].tone}>
                  {REVIEW_STATUS[row.status].label}
                </Badge>
                {SIGNATURE_STATUS[row.signature] && (
                  <Badge tone={SIGNATURE_STATUS[row.signature].tone}>
                    {SIGNATURE_STATUS[row.signature].label}
                  </Badge>
                )}
              </span>
            ),
          },
          {
            key: 'expiry',
            label: 'Expires',
            render: (row) => (row.expiresOn ? formatDay(row.expiresOn) : '—'),
          },
          { key: 'versions', label: 'Versions', mobile: false, render: (row) => row.versions },
          {
            key: 'latest',
            label: 'Latest file',
            mobile: false,
            render: (row) =>
              row.latest ? (
                <a
                  href={row.latest.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="text-brand underline"
                >
                  {row.latest.fileName}
                </a>
              ) : (
                '—'
              ),
          },
          {
            key: 'updated',
            label: 'Uploaded',
            mobile: false,
            render: (row) => (
              <span className="text-xs text-muted">{formatDateTime(row.latest?.uploadedAt)}</span>
            ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
