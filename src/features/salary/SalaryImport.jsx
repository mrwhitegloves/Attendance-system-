'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { readFileAsDataUrl } from '@/lib/readFile.js';
import { todayKey } from '@/lib/format.js';
import { Badge, Button, ButtonLink, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

/** Upload an Excel sheet of monthly salaries; see what became a proposal and what did not. */
export function SalaryImport() {
  const [file, setFile] = useState(null);
  const [effectiveFrom, setEffectiveFrom] = useState(`${todayKey().slice(0, 7)}-01`);
  const [reason, setReason] = useState('Salary at the start of the HRMS');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(
        await apiFetch('/api/salary/import', {
          method: 'POST',
          body: { file: await readFileAsDataUrl(file), effectiveFrom, reason },
        }),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4 p-4 sm:p-5">
          <p className="text-sm text-muted">
            The first row must have the columns <strong>Employee ID</strong> and{' '}
            <strong>Monthly salary</strong> (in rupees). Other columns are ignored.
          </p>
          <ButtonLink variant="secondary" size="sm" href="/api/salary/import">
            <Download size={14} /> Sample sheet
          </ButtonLink>
          <Field label="Excel file (.xlsx)" htmlFor="salary-file">
            <input
              id="salary-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Salary in force from" htmlFor="salary-from">
              <input
                id="salary-from"
                type="date"
                className={inputClass}
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                required
              />
            </Field>
            <Field label="Reason" htmlFor="salary-reason">
              <input
                id="salary-reason"
                className={inputClass}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={3}
                maxLength={300}
              />
            </Field>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !file}>
              <Upload size={15} /> Import
            </Button>
          </div>
        </form>
      </Card>

      {result && (
        <Card>
          <CardHeader
            title={`${result.proposed} of ${result.results.length} rows proposed`}
            subtitle={
              <>
                The CEO approves them on the{' '}
                <Link href="/salary" className="text-brand underline">
                  Salary
                </Link>{' '}
                screen.
              </>
            }
          />
          <ul className="divide-y divide-border text-sm">
            {result.results.map((row) => (
              <li
                key={row.line}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
              >
                <span>
                  <span className="text-xs text-muted">Row {row.line} · </span>
                  {row.employeeId || '—'}{' '}
                  {row.name && <span className="text-muted">({row.name})</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted">{row.message}</span>
                  <Badge tone={row.ok ? 'success' : 'danger'}>
                    {row.ok ? 'Proposed' : 'Skipped'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
