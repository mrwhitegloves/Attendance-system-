'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Badge } from '@/components/shared/ui.jsx';
import { formatDayName, statusTone } from '@/lib/format.js';

/** A punch time with its photo; a click opens the photo, place and map link. */
export function PunchCell({ record }) {
  const [open, setOpen] = useState(false);
  if (!record) return <span className="text-muted">—</span>;
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-md text-left hover:text-brand"
      >
        {record.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={record.photoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
        ) : (
          <span className="h-8 w-8 rounded-md bg-raised" />
        )}
        <span className="tabular-nums">{record.time}</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${record.userName} · ${formatDayName(record.date)}`}
      >
        <div className="space-y-3 text-sm" onClick={(event) => event.stopPropagation()}>
          {record.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={record.photoUrl}
              alt={`Photo of ${record.userName}`}
              className="w-full rounded-lg"
            />
          ) : (
            <p className="rounded-lg bg-raised p-6 text-center text-muted">No photo</p>
          )}
          <p className="flex items-center gap-2">
            <Badge tone={statusTone(record.status)}>{record.status}</Badge>
            <span className="tabular-nums">{record.time}</span>
          </p>
          <p className="flex items-start gap-1.5 text-muted">
            <MapPin size={14} className="mt-0.5 shrink-0" /> {record.location}
          </p>
          {record.lat !== null && record.lon !== null && (
            <a
              className="text-brand underline"
              href={`https://www.google.com/maps?q=${record.lat},${record.lon}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          )}
          {record.remark && <p className="text-xs text-muted">{record.remark}</p>}
        </div>
      </Dialog>
    </>
  );
}
