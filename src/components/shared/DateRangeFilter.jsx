'use client';

import { useListParams } from '@/lib/useListParams.js';
import { DATE_RANGES } from '@/lib/dateRanges.js';
import { compactInputClass, Select } from './form.jsx';

/**
 * The one date filter of every list: Any time, Today … Last financial year, Custom range.
 * Kept in the address (?range=…&from=…&to=…); the server does the filtering.
 */
export function DateRangeFilter({ label = 'Date' }) {
  const { get, set } = useListParams();
  // Old addresses with only from/to show as a custom range.
  const range = get('range') || (get('from') || get('to') ? 'custom' : '');
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Select
        className={compactInputClass}
        value={range}
        onChange={(event) =>
          set({
            range: event.target.value,
            ...(event.target.value === 'custom' ? {} : { from: '', to: '' }),
          })
        }
        options={DATE_RANGES}
        aria-label={label}
      />
      {range === 'custom' && (
        <>
          <input
            type="date"
            className={compactInputClass}
            value={get('from')}
            onChange={(event) => set({ range: 'custom', from: event.target.value })}
            aria-label={`${label} from`}
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            className={compactInputClass}
            value={get('to')}
            onChange={(event) => set({ range: 'custom', to: event.target.value })}
            aria-label={`${label} to`}
          />
        </>
      )}
    </span>
  );
}
