'use client';

import { useRouter } from 'next/navigation';
import { useListParams } from '@/lib/useListParams.js';
import { formatDay } from '@/lib/format.js';
import { Badge, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

/** Joining checklists with their progress. */
export function OnboardingList({ result }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Select
          className={compactInputClass}
          value={get('status', 'in_progress')}
          onChange={(event) =>
            set({ status: event.target.value === 'in_progress' ? '' : event.target.value })
          }
          options={[
            { value: 'in_progress', label: 'Not finished' },
            { value: 'completed', label: 'Completed' },
            { value: 'all', label: 'All' },
          ]}
          aria-label="Status"
        />
      </div>
      <DataTable
        rows={result.items}
        onRowClick={(row) => router.push(`/employees/${row.userId}/onboarding`)}
        empty={{ title: 'Nothing here', text: 'A checklist starts when a candidate joins.' }}
        columns={[
          {
            key: 'person',
            label: 'Employee',
            render: (row) => (
              <div>
                <p className="font-medium">{row.person?.name ?? '—'}</p>
                <p className="text-xs text-muted">
                  {[row.person?.employeeId, row.person?.designation].filter(Boolean).join(' · ')}
                </p>
              </div>
            ),
          },
          {
            key: 'joined',
            label: 'Joined',
            mobile: false,
            render: (row) => (
              <span className="text-muted">{formatDay(row.person?.joiningDate)}</span>
            ),
          },
          {
            key: 'progress',
            label: 'Progress',
            render: (row) => (
              <span className="tabular-nums">
                {row.progress.done} / {row.progress.total}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) =>
              row.status === 'completed' ? (
                <Badge tone="success">Completed</Badge>
              ) : row.ready ? (
                <Badge tone="brand">Ready to confirm</Badge>
              ) : (
                <Badge tone="warning">In progress</Badge>
              ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
