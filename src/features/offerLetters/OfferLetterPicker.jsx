'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Badge, Button } from '@/components/shared/ui.jsx';
import { inputClass } from '@/components/shared/form.jsx';
import { LETTER_STATUS } from '@/features/letters/labels.js';

/**
 * Finds a candidate's offer letter that is not linked to an employee yet (search by name or
 * phone). `value` is the chosen row from /api/offer-letters?unlinked=1, or null.
 */
export function OfferLetterPicker({ id, value, onChange }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (value) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const search = new URLSearchParams({
        unlinked: '1',
        ...(query.trim() ? { q: query.trim() } : {}),
      });
      apiFetch(`/api/offer-letters?${search}`, { signal: controller.signal })
        .then((result) => {
          setRows(result.items);
          setError('');
        })
        .catch((failure) => {
          if (failure.name !== 'AbortError') setError(failure.message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-raised px-3 py-2 text-sm">
        <div>
          <p className="font-medium">{value.person.name}</p>
          <p className="text-xs text-muted">
            {value.person.phone} · {LETTER_STATUS[value.status].label}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onChange(null)}>
          <X size={14} /> Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        id={id}
        className={inputClass}
        placeholder="Search the candidate's name or phone"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {rows.length > 0 ? (
        <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {rows.map((row) => (
            <li key={row._id}>
              <button
                type="button"
                onClick={() => onChange(row)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-raised"
              >
                <span>
                  <span className="font-medium">{row.person.name}</span>
                  <span className="text-muted"> · {row.person.phone}</span>
                </span>
                <Badge tone={LETTER_STATUS[row.status].tone}>
                  {LETTER_STATUS[row.status].label}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">No candidate offer letters waiting to be linked.</p>
      )}
    </div>
  );
}
