'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useListParams } from '@/lib/useListParams.js';
import { EmptyState } from './ui.jsx';

/**
 * A table on wide screens and a list of cards on phones.
 * @param {{ columns: { key: string, label: string, render: (row) => any, className?: string, mobile?: boolean }[],
 *   rows: object[], rowKey?: (row) => string, empty?: { title: string, text?: string }, onRowClick?: (row) => void }} props
 */
export function DataTable({ columns, rows, rowKey = (row) => row._id, empty, onRowClick }) {
  if (!rows.length)
    return <EmptyState title={empty?.title ?? 'Nothing here yet'} text={empty?.text} />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-2.5 font-medium ${column.className ?? ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-raised' : ''}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 align-middle ${column.className ?? ''}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`space-y-1.5 px-4 py-3 ${onRowClick ? 'cursor-pointer active:bg-raised' : ''}`}
          >
            {columns
              .filter((column) => column.mobile !== false)
              .map((column, index) => (
                <div
                  key={column.key}
                  className={index === 0 ? '' : 'flex items-center justify-between gap-3 text-sm'}
                >
                  {index > 0 && <span className="text-xs text-muted">{column.label}</span>}
                  <div className={index === 0 ? '' : 'text-right'}>{column.render(row)}</div>
                </div>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Page buttons; the page number lives in the address (?page=). */
export function Pagination({ page, pages, total }) {
  const { set, isPending } = useListParams();
  if (pages <= 1) return <p className="px-4 py-3 text-xs text-muted">{total} total</p>;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <span className="text-xs text-muted">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          className="rounded-md border border-border p-1.5 disabled:opacity-40"
          disabled={page <= 1 || isPending}
          onClick={() => set({ page: page - 1 })}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="rounded-md border border-border p-1.5 disabled:opacity-40"
          disabled={page >= pages || isPending}
          onClick={() => set({ page: page + 1 })}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
