'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { useListParams } from '@/lib/useListParams.js';
import { formatMonth, formatRupees, shiftMonth, todayKey } from '@/lib/format.js';
import { Badge, Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { PersonCell } from '@/components/shared/Avatar.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

/** Salary slips as a table. With `userId`, one employee's slips and a "new slip" button. */
export function PayslipList({ result, userId, canCreate, showFilters = true, showPerson = true }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [month, setMonth] = useState(shiftMonth(todayKey().slice(0, 7), -1));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const { payslip } = await apiFetch(`/api/users/${userId}/payslips`, {
        method: 'POST',
        body: { month },
      });
      router.push(`/payslips/${payslip._id}`);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      {(showFilters || canCreate) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {showFilters && (
            <>
              <input
                type="month"
                className={compactInputClass}
                value={get('month')}
                onChange={(event) => set({ month: event.target.value })}
                aria-label="Month"
              />
              <Select
                className={compactInputClass}
                value={get('status')}
                onChange={(event) => set({ status: event.target.value })}
                options={[
                  { value: '', label: 'Draft and final' },
                  { value: 'draft', label: 'Drafts' },
                  { value: 'final', label: 'Final' },
                ]}
                aria-label="Status"
              />
            </>
          )}
          {canCreate && (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <input
                type="month"
                className={compactInputClass}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                aria-label="Month of the new slip"
              />
              <Button size="sm" onClick={create} disabled={busy || !month}>
                <Plus size={15} /> New salary slip
              </Button>
            </span>
          )}
          {error && (
            <div className="w-full">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </div>
      )}
      <DataTable
        rows={result.items}
        onRowClick={(row) => router.push(`/payslips/${row._id}`)}
        empty={{ title: 'No salary slips yet' }}
        columns={[
          ...(showPerson
            ? [
                {
                  key: 'person',
                  label: 'Employee',
                  render: (row) => (
                    <PersonCell name={row.employee.name} employeeId={row.employee.code} />
                  ),
                },
              ]
            : []),
          {
            key: 'month',
            label: 'Month',
            render: (row) => <span className="font-medium">{formatMonth(row.month)}</span>,
          },
          { key: 'net', label: 'Net payable', render: (row) => formatRupees(row.totals.net) },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <Badge tone={row.status === 'final' ? 'success' : 'warning'}>
                {row.status === 'final' ? 'Final' : 'Draft'}
              </Badge>
            ),
          },
          {
            key: 'days',
            label: 'Full / half days',
            mobile: false,
            render: (row) => `${row.attendance.fullDays} / ${row.attendance.halfDays}`,
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
