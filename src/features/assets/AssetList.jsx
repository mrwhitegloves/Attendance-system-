'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useListParams } from '@/lib/useListParams.js';
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_STATUS_TONE,
  assetCategoryOptions,
  assetStatusOptions,
} from '@/config/assetOptions.js';
import { Badge, Button, Card, StatTile } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';
import { AssetFormDialog } from './AssetFormDialog.jsx';

/** Every asset in scope, with filters in the address; HR adds new ones here. */
export function AssetList({ result, counts, canManage, showPerson }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [search, setSearch] = useState(get('q'));
  const [adding, setAdding] = useState(false);

  return (
    <>
      {counts && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {['in_stock', 'assigned', 'under_repair', 'lost'].map((status) => (
            <StatTile
              key={status}
              label={ASSET_STATUSES[status]}
              value={counts[status] ?? 0}
              tone={ASSET_STATUS_TONE[status]}
              href={`/assets?status=${status}`}
            />
          ))}
        </div>
      )}
      <Card className={isPending ? 'opacity-60' : ''}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              set({ q: search.trim() });
            }}
            className="min-w-0 flex-1 sm:max-w-xs"
          >
            <input
              className={`${compactInputClass} w-full`}
              placeholder={showPerson ? 'Search code, name, serial, employee' : 'Search'}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search"
            />
          </form>
          <Select
            className={compactInputClass}
            value={get('category')}
            onChange={(event) => set({ category: event.target.value })}
            options={[{ value: '', label: 'All kinds' }, ...assetCategoryOptions]}
            aria-label="Kind"
          />
          {showPerson && (
            <Select
              className={compactInputClass}
              value={get('status')}
              onChange={(event) => set({ status: event.target.value })}
              options={[{ value: '', label: 'Any status' }, ...assetStatusOptions]}
              aria-label="Status"
            />
          )}
          {canManage && (
            <Button size="sm" className="ml-auto" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add asset
            </Button>
          )}
        </div>
        <DataTable
          rows={result.items}
          onRowClick={(row) => router.push(`/assets/${row._id}`)}
          empty={{ title: showPerson ? 'No assets here' : 'You have no company assets' }}
          columns={[
            {
              key: 'name',
              label: 'Asset',
              render: (row) => (
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted">
                    {row.code} · {ASSET_CATEGORIES[row.category]}
                    {row.serialNumber ? ` · ${row.serialNumber}` : ''}
                  </p>
                </div>
              ),
            },
            ...(showPerson
              ? [
                  {
                    key: 'with',
                    label: 'With',
                    render: (row) =>
                      row.employeeName ? (
                        <span>
                          {row.employeeName}{' '}
                          <span className="text-xs text-muted">{row.employeeId}</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      ),
                  },
                ]
              : []),
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge tone={ASSET_STATUS_TONE[row.status]}>{ASSET_STATUSES[row.status]}</Badge>
              ),
            },
          ]}
        />
        <Pagination page={result.page} pages={result.pages} total={result.total} />
      </Card>
      {canManage && (
        <AssetFormDialog
          open={adding}
          onClose={() => setAdding(false)}
          onSaved={(asset) => router.push(`/assets/${asset._id}`)}
        />
      )}
    </>
  );
}
