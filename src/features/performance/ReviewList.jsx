'use client';

import { useRouter } from 'next/navigation';
import { useListParams } from '@/lib/useListParams.js';
import { formatDay } from '@/lib/format.js';
import {
  PLAN_OUTCOMES,
  RATINGS,
  REVIEW_KINDS,
  REVIEW_STATUS,
  reviewKindOptions,
} from '@/config/performanceOptions.js';
import { Badge, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter.jsx';

/** Reviews and improvement plans, newest period first. */
export function ReviewList({ result, showPerson }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <DateRangeFilter label="Review period" />
        <Select
          className={compactInputClass}
          value={get('kind')}
          onChange={(event) => set({ kind: event.target.value })}
          options={[{ value: '', label: 'Reviews and plans' }, ...reviewKindOptions]}
          aria-label="Kind"
        />
        <Select
          className={compactInputClass}
          value={get('status')}
          onChange={(event) => set({ status: event.target.value })}
          options={[
            { value: '', label: 'Any status' },
            ...Object.entries(REVIEW_STATUS).map(([value, item]) => ({ value, label: item.label })),
          ]}
          aria-label="Status"
        />
      </div>
      <DataTable
        rows={result.items}
        onRowClick={(row) => router.push(`/performance/${row._id}`)}
        empty={{ title: 'No reviews yet' }}
        columns={[
          ...(showPerson
            ? [
                {
                  key: 'person',
                  label: 'Employee',
                  render: (row) => (
                    <div>
                      <p className="font-medium">{row.employeeName}</p>
                      <p className="text-xs text-muted">{row.employeeId}</p>
                    </div>
                  ),
                },
              ]
            : []),
          {
            key: 'period',
            label: 'Period',
            render: (row) => (
              <div>
                <p className={showPerson ? '' : 'font-medium'}>
                  {formatDay(row.periodStart)} to {formatDay(row.periodEnd)}
                </p>
                <p className="text-xs text-muted">
                  {REVIEW_KINDS[row.kind]} · by {row.reviewerName}
                </p>
              </div>
            ),
          },
          {
            key: 'result',
            label: 'Result',
            render: (row) =>
              row.kind === 'improvement_plan' ? (
                <span>{row.outcome ? PLAN_OUTCOMES[row.outcome] : '—'}</span>
              ) : (
                <span>{row.rating ? `${row.rating} · ${RATINGS[row.rating]}` : '—'}</span>
              ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <Badge tone={REVIEW_STATUS[row.status].tone}>{REVIEW_STATUS[row.status].label}</Badge>
            ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
