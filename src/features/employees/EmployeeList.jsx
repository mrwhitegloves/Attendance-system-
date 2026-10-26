'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useListParams } from '@/lib/useListParams.js';
import { capitalize, formatDateTime, statusTone } from '@/lib/format.js';
import { Badge, Button, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { PersonCell } from '@/components/shared/Avatar.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

export function EmployeeList({ result, roles, staffTypes }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [search, setSearch] = useState(get('q'));
  const roleLabel = Object.fromEntries(roles.map((role) => [role.value, role.label]));

  // Search after a short pause in typing.
  useEffect(() => {
    if (search === get('q')) return undefined;
    const timer = setTimeout(() => set({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, get, set]);

  const hasFilters = ['q', 'status', 'staffType', 'roleKey'].some((key) => get(key));

  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <input
          className={`${compactInputClass} min-w-0 flex-1 sm:max-w-xs`}
          placeholder="Search name, ID, phone, email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search"
        />
        <Select
          className={compactInputClass}
          value={get('status', 'active')}
          onChange={(event) =>
            set({ status: event.target.value === 'active' ? '' : event.target.value })
          }
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Switched off' },
            { value: 'all', label: 'Everyone' },
          ]}
          aria-label="Status"
        />
        <Select
          className={compactInputClass}
          value={get('staffType')}
          onChange={(event) => set({ staffType: event.target.value })}
          options={[
            { value: '', label: 'All staff types' },
            ...staffTypes.map((value) => ({ value, label: value })),
          ]}
          aria-label="Staff type"
        />
        <Select
          className={compactInputClass}
          value={get('roleKey')}
          onChange={(event) => set({ roleKey: event.target.value })}
          options={[{ value: '', label: 'All roles' }, ...roles]}
          aria-label="Role"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              set({ q: '', status: '', staffType: '', roleKey: '' });
            }}
          >
            Clear
          </Button>
        )}
      </div>
      <DataTable
        rows={result.items}
        onRowClick={(row) => router.push(`/employees/${row._id}`)}
        empty={{ title: 'No employees found', text: hasFilters ? 'Try other filters.' : undefined }}
        columns={[
          {
            key: 'person',
            label: 'Employee',
            render: (row) => <PersonCell name={row.name} employeeId={row.employeeId} />,
          },
          { key: 'department', label: 'Department', render: (row) => row.department || '—' },
          { key: 'staffType', label: 'Staff type', render: (row) => row.staffType },
          { key: 'role', label: 'Role', render: (row) => roleLabel[row.roleKey] ?? row.roleKey },
          { key: 'phone', label: 'Phone', mobile: false, render: (row) => row.phone || '—' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <Badge tone={statusTone(row.status)}>
                {row.status === 'inactive' ? 'Switched off' : capitalize(row.status)}
              </Badge>
            ),
          },
          {
            key: 'login',
            label: 'Last sign-in',
            mobile: false,
            render: (row) => (
              <span className="text-xs text-muted">{formatDateTime(row.lastLoginAt)}</span>
            ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
