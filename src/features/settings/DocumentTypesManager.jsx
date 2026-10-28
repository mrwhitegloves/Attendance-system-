'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Badge, Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

const FLAGS = [
  ['required', 'Required'],
  ['hasExpiry', 'Has expiry'],
  ['needsSignature', 'Needs signature'],
];

/** Add document types and change their flags. */
export function DocumentTypesManager({ types, categories }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', category: 'employment' });
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
    if (await run(() => apiFetch('/api/document-types', { method: 'POST', body: form }))) {
      setForm({ ...form, name: '' });
    }
  };
  const change = (type, changes) =>
    run(() => apiFetch(`/api/document-types/${type._id}`, { method: 'PATCH', body: changes }));

  return (
    <Card>
      <form onSubmit={add} className="flex flex-wrap gap-2 border-b border-border p-3">
        <input
          className={`${compactInputClass} min-w-0 flex-1 sm:max-w-xs`}
          placeholder="New document type"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          maxLength={80}
          required
          aria-label="New document type"
        />
        <Select
          className={compactInputClass}
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          options={categories}
          aria-label="Group"
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
      {categories.map((category) => {
        const inGroup = types.filter((type) => type.category === category.value);
        if (!inGroup.length) return null;
        return (
          <div key={category.value}>
            <p className="bg-raised px-4 py-1.5 text-xs font-semibold text-muted">
              {category.label}
            </p>
            <ul className="divide-y divide-border">
              {inGroup.map((type) => (
                <li
                  key={type._id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span
                    className={`flex items-center gap-2 ${type.active ? '' : 'text-muted line-through'}`}
                  >
                    {type.name}
                    {!type.active && <Badge>Switched off</Badge>}
                  </span>
                  <span className="flex flex-wrap items-center gap-3">
                    {FLAGS.map(([flag, label]) => (
                      <label key={flag} className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={type[flag]}
                          disabled={busy}
                          onChange={(event) => change(type, { [flag]: event.target.checked })}
                        />
                        {label}
                      </label>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => change(type, { active: !type.active })}
                    >
                      {type.active ? 'Switch off' : 'Switch on'}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Card>
  );
}
