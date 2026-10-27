'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 font-medium text-white"
    >
      <Printer size={15} /> Print / Save as PDF
    </button>
  );
}
