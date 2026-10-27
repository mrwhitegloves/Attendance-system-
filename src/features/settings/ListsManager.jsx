'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Badge, Button, Card, EmptyState, ErrorText } from '@/components/shared/ui.jsx';
import { compactInputClass } from '@/components/shared/form.jsx';

/** Add, rename and switch on/off the items of one managed list. */
export function ListsManager({ type, label, items }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      router.refresh();
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (await run(() => apiFetch('/api/lookups', { method: 'POST', body: { type, name } })))
      setName('');
  };
  const rename = async () => {
    const ok = await run(() =>
      apiFetch(`/api/lookups/${editing.id}`, { method: 'PATCH', body: { name: editing.name } }),
    );
    if (ok) setEditing(null);
  };
  const toggle = (item) =>
    run(() =>
      apiFetch(`/api/lookups/${item._id}`, { method: 'PATCH', body: { active: !item.active } }),
    );

  return (
    <Card>
      <form onSubmit={add} className="flex flex-wrap gap-2 border-b border-border p-3">
        <input
          className={`${compactInputClass} min-w-0 flex-1 sm:max-w-xs`}
          placeholder={`New ${label.toLowerCase()}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          required
          aria-label={`New ${label.toLowerCase()}`}
        />
        <Button type="submit" size="sm" disabled={busy}>
          <Plus size={15} /> Add
        </Button>
      </form>
      {error && (
        <div className="p-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState title={`No ${label.toLowerCase()}s yet`} text="Add the first one above." />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item._id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              {editing?.id === item._id ? (
                <span className="flex flex-1 items-center gap-2">
                  <input
                    className={`${compactInputClass} min-w-0 flex-1 sm:max-w-xs`}
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    maxLength={60}
                    aria-label="New name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={rename}
                    disabled={busy}
                    className="rounded p-1 text-success"
                    aria-label="Save"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded p-1 text-muted"
                    aria-label="Cancel"
                  >
                    <X size={16} />
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className={item.active ? '' : 'text-muted line-through'}>{item.name}</span>
                  {item.employees !== undefined && (
                    <span className="text-xs text-muted">
                      {item.employees} {item.employees === 1 ? 'employee' : 'employees'}
                    </span>
                  )}
                  {!item.active && <Badge>Switched off</Badge>}
                </span>
              )}
              {editing?.id !== item._id && (
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing({ id: item._id, name: item.name })}
                  >
                    <Pencil size={14} /> Rename
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggle(item)} disabled={busy}>
                    {item.active ? 'Switch off' : 'Switch on'}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
