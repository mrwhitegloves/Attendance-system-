'use client';

import { useRouter } from 'next/navigation';
import { formatDay, formatRupees } from '@/lib/format.js';
import { Badge, Card, CardHeader, StatTile } from '@/components/shared/ui.jsx';
import { DataTable } from '@/components/shared/DataTable.jsx';
import { PersonCell } from '@/components/shared/Avatar.jsx';

/** Proposals waiting for approval, then everyone's salary in force. */
export function SalaryOverview({ data }) {
  const router = useRouter();
  const open = (row) => router.push(`/employees/${row.user._id}/salary`);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active employees" value={data.totals.people} />
        <StatTile
          label="With an approved salary"
          value={data.totals.withSalary}
          tone={data.totals.withSalary < data.totals.people ? 'warning' : 'success'}
        />
        <StatTile label="Monthly gross (total)" value={formatRupees(data.totals.monthlyGross)} />
        <StatTile
          label="Monthly cost to company"
          value={formatRupees(data.totals.monthlyCtc)}
          tone="brand"
          hint="Payroll exposure"
        />
      </div>
      {data.pending.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader title={`Waiting for approval (${data.pending.length})`} />
          <DataTable
            rows={data.pending}
            onRowClick={open}
            columns={[
              {
                key: 'person',
                label: 'Employee',
                render: (row) => (
                  <PersonCell name={row.user?.name ?? '—'} employeeId={row.user?.employeeId} />
                ),
              },
              { key: 'version', label: 'Version', render: (row) => `v${row.version}` },
              { key: 'from', label: 'From', render: (row) => formatDay(row.effectiveFrom) },
              {
                key: 'ctc',
                label: 'Annual CTC',
                render: (row) => formatRupees(row.totals.annualCtc),
              },
              {
                key: 'reason',
                label: 'Reason',
                className: 'max-w-xs',
                render: (row) => <span className="line-clamp-2 text-xs">{row.reason}</span>,
              },
              {
                key: 'who',
                label: '',
                render: (row) =>
                  row.mine ? (
                    <Badge>Your proposal</Badge>
                  ) : data.canApprove ? (
                    <Badge tone="warning">To approve</Badge>
                  ) : null,
              },
            ]}
          />
        </Card>
      )}
      <Card>
        <CardHeader title="Salary in force" />
        <DataTable
          rows={data.rows}
          rowKey={(row) => row.user._id}
          onRowClick={open}
          columns={[
            {
              key: 'person',
              label: 'Employee',
              render: (row) => (
                <PersonCell
                  name={row.user.name}
                  employeeId={row.user.employeeId}
                  sub={row.user.designation}
                />
              ),
            },
            {
              key: 'gross',
              label: 'Monthly gross',
              render: (row) =>
                row.current ? (
                  formatRupees(row.current.totals.monthlyGross)
                ) : (
                  <Badge tone="warning">Not set</Badge>
                ),
            },
            {
              key: 'ctc',
              label: 'Annual CTC',
              render: (row) => formatRupees(row.current?.totals.annualCtc),
            },
            {
              key: 'from',
              label: 'Since',
              mobile: false,
              render: (row) => (row.current ? formatDay(row.current.effectiveFrom) : '—'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
