'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useListParams } from '@/lib/useListParams.js';
import { formatDay } from '@/lib/format.js';
import { CANDIDATE_STATUS } from '@/config/recruitmentOptions.js';
import { Badge, Card } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';
import { LETTER_STATUS } from '@/features/letters/labels.js';

/** Candidates with the state of their newest offer letter. */
export function CandidateList({ result }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [search, setSearch] = useState(get('q'));
  return (
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
            placeholder="Search name, phone, email, designation"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search"
          />
        </form>
        <Select
          className={compactInputClass}
          value={get('status', 'open')}
          onChange={(event) =>
            set({ status: event.target.value === 'open' ? '' : event.target.value })
          }
          options={[
            ...Object.entries(CANDIDATE_STATUS).map(([value, item]) => ({
              value,
              label: item.label,
            })),
            { value: 'all', label: 'Everyone' },
          ]}
          aria-label="Status"
        />
      </div>
      <DataTable
        rows={result.items}
        onRowClick={(row) => router.push(`/recruitment/${row._id}`)}
        empty={{ title: 'No candidates here', text: 'Add a candidate to prepare an offer letter.' }}
        columns={[
          {
            key: 'name',
            label: 'Candidate',
            render: (row) => (
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted">
                  {[row.designation, row.department].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ),
          },
          {
            key: 'offer',
            label: 'Offer letter',
            render: (row) =>
              row.offer ? (
                <Badge tone={LETTER_STATUS[row.offer.status].tone}>
                  {LETTER_STATUS[row.offer.status].label}
                  {row.offer.version > 1 ? ` · v${row.offer.version}` : ''}
                </Badge>
              ) : (
                <span className="text-muted">Not started</span>
              ),
          },
          {
            key: 'joining',
            label: 'Joining',
            mobile: false,
            render: (row) => (
              <span className="text-muted">{formatDay(row.expectedJoiningDate)}</span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <Badge tone={CANDIDATE_STATUS[row.status].tone}>
                {CANDIDATE_STATUS[row.status].label}
              </Badge>
            ),
          },
        ]}
      />
      <Pagination page={result.page} pages={result.pages} total={result.total} />
    </Card>
  );
}
