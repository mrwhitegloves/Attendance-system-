'use client';

import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { useListParams } from '@/lib/useListParams.js';
import { todayKey } from '@/lib/format.js';
import { ButtonLink, Card } from '@/components/shared/ui.jsx';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter.jsx';
import { compactInputClass } from '@/components/shared/form.jsx';

/** Every report the person may download; one date filter and one month for all of them. */
export function ReportsScreen({ reports }) {
  const searchParams = useSearchParams();
  const { get, set } = useListParams();
  const month = get('month') || todayKey().slice(0, 7);
  const dates = new URLSearchParams(
    ['range', 'from', 'to']
      .filter((key) => searchParams.get(key))
      .map((key) => [key, searchParams.get(key)]),
  ).toString();

  const href = (report) =>
    report.dates === 'month'
      ? `/api/reports/${report.key}?month=${month}`
      : report.dates === 'range' && dates
        ? `/api/reports/${report.key}?${dates}`
        : `/api/reports/${report.key}`;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <span className="text-sm font-medium">Dates</span>
        <DateRangeFilter label="Report dates" />
        <span className="text-sm font-medium">Month</span>
        <input
          type="month"
          className={compactInputClass}
          value={month}
          onChange={(event) => set({ month: event.target.value })}
          aria-label="Report month"
        />
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.key} className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{report.title}</p>
              <p className="text-sm text-muted">{report.description}</p>
              <p className="mt-1 text-xs text-muted">
                {report.dates === 'month'
                  ? 'Uses the month above.'
                  : report.dates === 'range'
                    ? 'Uses the dates above.'
                    : 'As of today.'}
              </p>
            </div>
            <ButtonLink size="sm" variant="secondary" href={href(report)}>
              <Download size={14} /> CSV
            </ButtonLink>
          </Card>
        ))}
      </div>
    </div>
  );
}
