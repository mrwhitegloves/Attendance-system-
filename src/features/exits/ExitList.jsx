'use client';

import { useRouter } from 'next/navigation';
import { useListParams } from '@/lib/useListParams.js';
import { formatDay } from '@/lib/format.js';
import { EXIT_STATUS, EXIT_TYPES } from '@/config/exitOptions.js';
import { Badge, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter.jsx';

/** Exits in scope, soonest last working day first. */
export function ExitList({ result }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <DateRangeFilter label="Last working day" />
        <Select
          className={compactInputClass}
          value={get('status', 'notice')}
          onChange={(event) =>
            set({ status: event.target.value === 'notice' ? '' : event.target.value })
          }
          options={[
            ...Object.entries(EXIT_STATUS).map(([value, item]) => ({ value, label: item.label })),
            { value: 'all', label: 'All' },
          ]}
          aria-label="Status"
        />
      </div>
      <DataTable
        rows={result.items}
        onRowClick={(row) => router.push(`/employees/${row.userId}/exit`)}
        empty={{ title: 'Nobody here' }}
        columns={[
          {
            key: 'person',
            label: 'Employee',
            render: (row) => (
              <div>
                <p className="font-medium">{row.employeeName}</p>
                <p className="text-xs text-muted">
                  {row.employeeId} · {EXIT_TYPES[row.type]}
                </p>
              </div>
            ),
          },
          {
            key: 'last',
            label: 'Last working day',
            render: (row) => (
              <span className={row.overdue ? 'font-medium text-danger' : ''}>
                {formatDay(row.lastWorkingDay)}
              </span>
            ),
          },
          {
            key: 'progress',
            label: 'Done',
            mobile: false,
            render: (row) => (
              <span className="tabular-nums">
                {row.progress.done} / {row.progress.total}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <Badge tone={row.overdue ? 'danger' : EXIT_STATUS[row.status].tone}>
                {row.overdue ? 'Past last day' : EXIT_STATUS[row.status].label}
              </Badge>
            ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
