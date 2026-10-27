'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useListParams } from '@/lib/useListParams.js';
import { Badge, Button, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { CompletenessBar, PersonCell } from '@/components/shared/Avatar.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';
import {
  ACCOUNT_STATUS,
  ACCOUNT_STATUS_TONE,
  EMPLOYMENT_STATUS,
} from '@/config/employeeOptions.js';

const FILTER_KEYS = ['q', 'status', 'department', 'staffType', 'roleKey', 'file'];

export function EmployeeList({ result, roles, staffTypes, departments }) {
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

  const hasFilters = FILTER_KEYS.some((key) => get(key));
  const filter = (key, label, options, aria) => (
    <Select
      className={compactInputClass}
      value={get(key)}
      onChange={(event) => set({ [key]: event.target.value })}
      options={[{ value: '', label }, ...options]}
      aria-label={aria}
    />
  );

  return (
    <Card className={isPending ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <input
          className={`${compactInputClass} min-w-0 flex-1 sm:max-w-xs`}
          placeholder="Search name, ID, phone, designation"
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
          options={[...ACCOUNT_STATUS.list, { value: 'all', label: 'Everyone' }]}
          aria-label="Sign-in status"
        />
        {filter(
          'file',
          'All files',
          [
            { value: 'incomplete', label: 'Incomplete files' },
            { value: 'complete', label: 'Complete files' },
          ],
          'File',
        )}
        {filter(
          'department',
          'All departments',
          departments.map((value) => ({ value, label: value })),
          'Department',
        )}
        {filter(
          'staffType',
          'All staff types',
          staffTypes.map((value) => ({ value, label: value })),
          'Staff type',
        )}
        {filter('roleKey', 'All roles', roles, 'Role')}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              set(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])));
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
            render: (row) => (
              <PersonCell name={row.name} employeeId={row.employeeId} photoUrl={row.photoUrl} />
            ),
          },
          { key: 'designation', label: 'Designation', render: (row) => row.designation || '—' },
          { key: 'department', label: 'Department', render: (row) => row.department || '—' },
          {
            key: 'role',
            label: 'Role',
            mobile: false,
            render: (row) => roleLabel[row.roleKey] ?? row.roleKey,
          },
          {
            key: 'employment',
            label: 'Employment',
            mobile: false,
            render: (row) =>
              row.employmentStatus ? EMPLOYMENT_STATUS.label(row.employmentStatus) : '—',
          },
          {
            key: 'file',
            label: 'File',
            render: (row) => <CompletenessBar percent={row.completeness?.percent ?? 0} />,
          },
          {
            key: 'status',
            label: 'Sign-in',
            render: (row) => (
              <Badge tone={ACCOUNT_STATUS_TONE[row.status]}>
                {ACCOUNT_STATUS.label(row.status)}
              </Badge>
            ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
