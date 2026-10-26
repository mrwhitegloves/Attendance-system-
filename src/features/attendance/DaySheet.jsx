'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useListParams } from '@/lib/useListParams.js';
import { formatDayName, formatMinutes, statusTone } from '@/lib/format.js';
import { Badge, Card, StatTile } from '@/components/shared/ui.jsx';
import { DataTable } from '@/components/shared/DataTable.jsx';
import { PersonCell } from '@/components/shared/Avatar.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';
import { PunchCell } from './PunchCell.jsx';

const STATUS_FILTERS = ['', 'Present', 'Late', 'Leave', 'Absent', 'No punch'];

function shiftDay(day, by) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + by);
  return date.toISOString().slice(0, 10);
}

/** One day for everyone in scope: tiles, then a row per person. */
export function DaySheet({ sheet, today }) {
  const router = useRouter();
  const { set, isPending } = useListParams();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const text = search.trim().toLowerCase();
    return sheet.rows.filter(
      (row) =>
        (!status ||
          row.status === status ||
          (status === 'No punch' && row.status === 'Leave pending')) &&
        (!text ||
          row.user.name.toLowerCase().includes(text) ||
          row.user.employeeId.toLowerCase().includes(text)),
    );
  }, [sheet.rows, status, search]);

  const goTo = (date) => set({ date: date === today ? '' : date });

  return (
    <div className={`space-y-4 ${isPending ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-border bg-surface p-2"
          onClick={() => goTo(shiftDay(sheet.date, -1))}
          aria-label="Previous day"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="date"
          className={compactInputClass}
          value={sheet.date}
          max={today}
          onChange={(event) => event.target.value && goTo(event.target.value)}
          aria-label="Day"
        />
        <button
          type="button"
          className="rounded-lg border border-border bg-surface p-2 disabled:opacity-40"
          disabled={sheet.date >= today}
          onClick={() => goTo(shiftDay(sheet.date, 1))}
          aria-label="Next day"
        >
          <ChevronRight size={16} />
        </button>
        <span className="text-sm text-muted">{formatDayName(sheet.date)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="People" value={sheet.summary.people} />
        <StatTile label="Present" value={sheet.summary.present} tone="success" />
        <StatTile label="Late" value={sheet.summary.late} tone="warning" />
        <StatTile label="On leave" value={sheet.summary.leave} tone="info" />
        <StatTile label="Absent" value={sheet.summary.absent} tone="danger" />
        <StatTile label="No punch yet" value={sheet.summary.noPunch} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <input
            className={`${compactInputClass} min-w-0 flex-1 sm:max-w-xs`}
            placeholder="Search name or ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search"
          />
          <Select
            className={compactInputClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={STATUS_FILTERS.map((value) => ({ value, label: value || 'All statuses' }))}
            aria-label="Status"
          />
        </div>
        <DataTable
          rows={rows}
          rowKey={(row) => row.user._id}
          onRowClick={(row) =>
            router.push(`/employees/${row.user._id}/attendance?month=${sheet.date.slice(0, 7)}`)
          }
          empty={{ title: 'Nobody matches these filters' }}
          columns={[
            {
              key: 'person',
              label: 'Employee',
              render: (row) => (
                <PersonCell
                  name={row.user.name}
                  employeeId={row.user.employeeId}
                  sub={row.user.department}
                />
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
            },
            {
              key: 'shift',
              label: 'Expected in',
              render: (row) => row.user.expectedInTime,
              mobile: false,
            },
            { key: 'in', label: 'Punch in', render: (row) => <PunchCell record={row.punchIn} /> },
            {
              key: 'out',
              label: 'Punch out',
              render: (row) => <PunchCell record={row.punchOut} />,
            },
            { key: 'hours', label: 'Worked', render: (row) => formatMinutes(row.minutesWorked) },
          ]}
        />
      </Card>
    </div>
  );
}
