'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Badge, Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';
import { LETTER_KIND_LABELS } from '@/features/letters/labels.js';

/** The list of letter templates with an editor. */
export function TemplatesManager({ templates, placeholders }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null); // a template, or {} for a new one
  const [busy, setBusy] = useState(false);
  const toggle = async (template) => {
    setBusy(true);
    await apiFetch(`/api/letter-templates/${template._id}`, {
      method: 'PATCH',
      body: { active: !template.active },
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  };
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEditing({})}>
          <Plus size={16} /> New template
        </Button>
      </div>
      <Card>
        <ul className="divide-y divide-border">
          {templates.map((template) => (
            <li
              key={template._id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span className={template.active ? '' : 'text-muted line-through'}>
                <span className="font-medium">{template.name}</span>{' '}
                <span className="text-xs text-muted">{LETTER_KIND_LABELS[template.kind]}</span>
                {!template.active && <Badge>Switched off</Badge>}
              </span>
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(template)}>
                  <Pencil size={14} /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggle(template)} disabled={busy}>
                  {template.active ? 'Switch off' : 'Switch on'}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {editing && (
        <TemplateDialog
          template={editing}
          placeholders={placeholders}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}

function TemplateDialog({ template, placeholders, onClose, onSaved }) {
  const isNew = !template._id;
  const [form, setForm] = useState({
    name: template.name ?? '',
    kind: template.kind ?? 'offer',
    subject: template.subject ?? '',
    body: template.body ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch(isNew ? '/api/letter-templates' : `/api/letter-templates/${template._id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: form,
      });
      onClose();
      onSaved();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? 'New template' : `Edit: ${template.name}`}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="tpl-name">
            <input
              id="tpl-name"
              className={inputClass}
              value={form.name}
              onChange={update('name')}
              required
            />
          </Field>
          <Field label="Kind" htmlFor="tpl-kind">
            <Select
              id="tpl-kind"
              value={form.kind}
              onChange={update('kind')}
              options={Object.entries(LETTER_KIND_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Field>
        </div>
        <Field label="Subject" htmlFor="tpl-subject">
          <input
            id="tpl-subject"
            className={inputClass}
            value={form.subject}
            onChange={update('subject')}
          />
        </Field>
        <Field label="Text" htmlFor="tpl-body" hint="A blank line starts a new paragraph.">
          <textarea
            id="tpl-body"
            rows={14}
            className={`${inputClass} h-auto py-2 font-mono text-xs`}
            value={form.body}
            onChange={update('body')}
            required
          />
        </Field>
        <details className="rounded-lg bg-raised p-3 text-xs">
          <summary className="cursor-pointer font-medium">Words that are filled in</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {Object.entries(placeholders).map(([key, label]) => (
              <li key={key}>
                <code className="text-brand">{`{{${key}}}`}</code> {label}
              </li>
            ))}
          </ul>
        </details>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
