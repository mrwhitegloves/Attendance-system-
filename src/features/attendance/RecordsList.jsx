'use client';

import { useListParams } from '@/lib/useListParams.js';
import { formatDayName, statusTone } from '@/lib/format.js';
import { Badge, Button, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { PersonCell } from '@/components/shared/Avatar.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';
import { PunchCell } from './PunchCell.jsx';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter.jsx';

const STATUSES = ['Checked In', 'Late', 'Checked Out', 'Leave', 'Absent'];

/** Every punch in scope, newest first; filters live in the address. */
export function RecordsList({ result, people, showPerson }) {
  const { get, set, isPending } = useListParams();
  const hasFilters = ['range', 'from', 'to', 'employeeId', 'status'].some((key) => get(key));

  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <DateRangeFilter label="Date" />
        {showPerson && (
          <Select
            className={compactInputClass}
            value={get('employeeId')}
            onChange={(event) => set({ employeeId: event.target.value })}
            options={[
              { value: '', label: 'Everyone' },
              ...people.map((person) => ({
                value: person.employeeId,
                label: `${person.name} (${person.employeeId})`,
              })),
            ]}
            aria-label="Employee"
          />
        )}
        <Select
          className={compactInputClass}
          value={get('status')}
          onChange={(event) => set({ status: event.target.value })}
          options={[
            { value: '', label: 'All statuses' },
            ...STATUSES.map((value) => ({ value, label: value })),
          ]}
          aria-label="Status"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set({ from: '', to: '', employeeId: '', status: '' })}
          >
            Clear
          </Button>
        )}
      </div>
      <DataTable
        rows={result.items}
        empty={{ title: 'No punches found', text: hasFilters ? 'Try other filters.' : undefined }}
        columns={[
          ...(showPerson
            ? [
                {
                  key: 'person',
                  label: 'Employee',
                  render: (row) => <PersonCell name={row.userName} employeeId={row.employeeId} />,
                },
              ]
            : []),
          { key: 'date', label: 'Day', render: (row) => formatDayName(row.date) },
          { key: 'time', label: 'Time', render: (row) => <PunchCell record={row} /> },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
          },
          {
            key: 'location',
            label: 'Place',
            className: 'max-w-xs',
            render: (row) => (
              <span className="line-clamp-2 text-xs text-muted">{row.location}</span>
            ),
            mobile: false,
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
