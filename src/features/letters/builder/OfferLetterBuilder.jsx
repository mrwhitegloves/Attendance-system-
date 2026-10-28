'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { brandOptions } from '@/config/brands.js';
import { Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { Field, compactInputClass, inputClass, Select } from '@/components/shared/form.jsx';

const OfferPreview = dynamic(() => import('./OfferPreview.jsx'), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted">Loading the preview…</p>,
});

const SECTION_KINDS = [
  { value: 'table', label: 'Table (label and value)' },
  { value: 'bullets', label: 'Points' },
  { value: 'paragraphs', label: 'Paragraphs' },
  { value: 'terms', label: 'Terms (bold title and text)' },
];

const emptySection = (type) =>
  ({
    table: { type, title: 'New section', rows: [{ label: '', value: '' }] },
    bullets: { type, title: 'New section', items: [''] },
    paragraphs: { type, title: 'New section', paragraphs: [''] },
    terms: { type, title: 'New section', items: [{ title: '', text: '' }] },
  })[type];

const move = (list, from, to) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function TextArea({ value, onChange, rows = 3, ...props }) {
  return (
    <textarea
      className={`${inputClass} leading-relaxed`}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  );
}

function ListControls({ index, count, onMove, onRemove, label }) {
  return (
    <span className="flex shrink-0 gap-0.5">
      <button
        type="button"
        className="rounded p-1 text-muted hover:bg-raised disabled:opacity-30"
        onClick={() => onMove(index - 1)}
        disabled={index === 0}
        aria-label={`Move ${label} up`}
      >
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        className="rounded p-1 text-muted hover:bg-raised disabled:opacity-30"
        onClick={() => onMove(index + 1)}
        disabled={index === count - 1}
        aria-label={`Move ${label} down`}
      >
        <ArrowDown size={14} />
      </button>
      <button
        type="button"
        className="rounded p-1 text-muted hover:bg-raised hover:text-danger"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        <Trash2 size={14} />
      </button>
    </span>
  );
}

/** The editor of one section, by its kind. */
function SectionEditor({ section, number, onChange }) {
  const set = (key, value) => onChange({ ...section, [key]: value });
  const listKey = { table: 'rows', bullets: 'items', paragraphs: 'paragraphs', terms: 'items' }[
    section.type
  ];
  const items = section[listKey];
  const setItem = (index, value) =>
    set(
      listKey,
      items.map((item, at) => (at === index ? value : item)),
    );
  const addItem = () =>
    set(listKey, [
      ...items,
      {
        table: { label: '', value: '' },
        bullets: '',
        paragraphs: '',
        terms: { title: '', text: '' },
      }[section.type],
    ]);

  return (
    <div className="space-y-2">
      <Field
        label={`Section ${String(number).padStart(2, '0')} title`}
        htmlFor={`section-${number}-title`}
      >
        <input
          id={`section-${number}-title`}
          className={inputClass}
          value={section.title}
          onChange={(event) => set('title', event.target.value)}
          maxLength={80}
        />
      </Field>
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2 rounded-lg border border-border p-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            {section.type === 'table' && (
              <div className="grid gap-1.5 sm:grid-cols-[2fr_3fr]">
                <input
                  className={compactInputClass}
                  placeholder="Label (e.g. Job Title)"
                  value={item.label}
                  onChange={(event) => setItem(index, { ...item, label: event.target.value })}
                  maxLength={80}
                  aria-label={`Section ${number} row ${index + 1} label`}
                />
                <input
                  className={compactInputClass}
                  placeholder="Value"
                  value={item.value}
                  onChange={(event) => setItem(index, { ...item, value: event.target.value })}
                  maxLength={500}
                  aria-label={`Section ${number} row ${index + 1} value`}
                />
              </div>
            )}
            {(section.type === 'bullets' || section.type === 'paragraphs') && (
              <TextArea
                value={item}
                onChange={(value) => setItem(index, value)}
                rows={section.type === 'bullets' ? 2 : 4}
                maxLength={section.type === 'bullets' ? 600 : 3000}
                aria-label={`Section ${number} ${section.type === 'bullets' ? 'point' : 'paragraph'} ${index + 1}`}
              />
            )}
            {section.type === 'terms' && (
              <>
                <input
                  className={`${compactInputClass} w-full font-semibold`}
                  placeholder="Title (e.g. Leave Policy)"
                  value={item.title}
                  onChange={(event) => setItem(index, { ...item, title: event.target.value })}
                  maxLength={120}
                  aria-label={`Section ${number} term ${index + 1} title`}
                />
                <TextArea
                  value={item.text}
                  onChange={(value) => setItem(index, { ...item, text: value })}
                  maxLength={3000}
                  aria-label={`Section ${number} term ${index + 1} text`}
                />
              </>
            )}
          </div>
          <ListControls
            index={index}
            count={items.length}
            label={`item ${index + 1}`}
            onMove={(to) => set(listKey, move(items, index, to))}
            onRemove={() =>
              set(
                listKey,
                items.filter((_, at) => at !== index),
              )
            }
          />
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={addItem}>
        <Plus size={14} />{' '}
        {
          {
            table: 'Add row',
            bullets: 'Add point',
            paragraphs: 'Add paragraph',
            terms: 'Add term',
          }[section.type]
        }
      </Button>
    </div>
  );
}

/** The offer letter screen: every part of the format as inputs, and the live preview. */
export function OfferLetterBuilder({ letter, person, company, brands, stampDataUrl }) {
  const router = useRouter();
  const [content, setContent] = useState(letter.content);
  const [brandKey, setBrandKey] = useState(letter.brandKey || 'mwg');
  const [newKind, setNewKind] = useState('paragraphs');
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (changes) => {
    setContent((current) => ({ ...current, ...changes }));
    setDirty(true);
    setMessage('');
  };
  const updateNested = (key, changes) => update({ [key]: { ...content[key], ...changes } });
  const setSection = (index, section) =>
    update({ sections: content.sections.map((item, at) => (at === index ? section : item)) });

  const save = async (close) => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/letters/${letter._id}/content`, {
        method: 'PUT',
        body: { content, brandKey },
      });
      setDirty(false);
      if (close) {
        router.push(`/letters/${letter._id}`);
      } else {
        setMessage('Saved.');
        router.refresh();
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const input = (key, label, props = {}) => (
    <Field label={label} htmlFor={`offer-${key}`}>
      <input
        id={`offer-${key}`}
        className={inputClass}
        value={content[key]}
        onChange={(event) => update({ [key]: event.target.value })}
        {...props}
      />
    </Field>
  );

  const back = person.candidateId ? `/recruitment/${person.candidateId}` : `/letters/${letter._id}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={back}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"
          >
            <ArrowLeft size={15} /> {person.name}
          </Link>
          <h1 className="text-xl font-semibold">Offer letter v{letter.version} (draft)</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {message && <span className="text-sm text-success">{message}</span>}
          {dirty && <span className="text-sm text-warning">Not saved</span>}
          <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
            <Save size={15} /> Save
          </Button>
          <Button onClick={() => save(true)} disabled={busy}>
            Save and close
          </Button>
        </div>
      </div>
      {error && (
        <div className="mb-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4 xl:max-h-[calc(100vh-170px)] xl:overflow-y-auto xl:pr-1">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Letter</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company (logo and header)" htmlFor="offer-brand">
                <Select
                  id="offer-brand"
                  value={brandKey}
                  onChange={(event) => {
                    setBrandKey(event.target.value);
                    setDirty(true);
                  }}
                  options={brandOptions}
                />
              </Field>
              {input('date', 'Date', { type: 'date', required: true })}
              {input('toName', 'To (name)', { maxLength: 120 })}
              {input('toAddress', 'Address under the name', { maxLength: 300 })}
            </div>
            {input('subject', 'Subject', { maxLength: 200 })}
            {input('salutation', 'Dear … (name after "Dear")', { maxLength: 120 })}
            <Field
              label="Opening paragraph"
              htmlFor="offer-intro"
              hint="Put **two stars** around words to make them bold."
            >
              <TextArea
                id="offer-intro"
                value={content.intro}
                onChange={(value) => update({ intro: value })}
                rows={5}
                maxLength={3000}
              />
            </Field>
          </Card>

          {content.sections.map((section, index) => (
            <Card key={index} className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                  {String(index + 1).padStart(2, '0')} ·{' '}
                  {SECTION_KINDS.find((kind) => kind.value === section.type)?.label}
                </p>
                <ListControls
                  index={index}
                  count={content.sections.length}
                  label={`section ${index + 1}`}
                  onMove={(to) => update({ sections: move(content.sections, index, to) })}
                  onRemove={() =>
                    update({ sections: content.sections.filter((_, at) => at !== index) })
                  }
                />
              </div>
              <SectionEditor
                section={section}
                number={index + 1}
                onChange={(next) => setSection(index, next)}
              />
            </Card>
          ))}

          <Card className="flex flex-wrap items-end gap-2 p-4">
            <Field label="Add a section" htmlFor="offer-new-section">
              <Select
                id="offer-new-section"
                className={compactInputClass}
                value={newKind}
                onChange={(event) => setNewKind(event.target.value)}
                options={SECTION_KINDS}
              />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => update({ sections: [...content.sections, emptySection(newKind)] })}
              disabled={content.sections.length >= 12}
            >
              <Plus size={14} /> Add section
            </Button>
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Closing</h2>
            {content.closing.map((paragraph, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1">
                  <TextArea
                    value={paragraph}
                    onChange={(value) =>
                      update({
                        closing: content.closing.map((item, at) => (at === index ? value : item)),
                      })
                    }
                    maxLength={3000}
                    aria-label={`Closing paragraph ${index + 1}`}
                  />
                </div>
                <ListControls
                  index={index}
                  count={content.closing.length}
                  label={`closing paragraph ${index + 1}`}
                  onMove={(to) => update({ closing: move(content.closing, index, to) })}
                  onRemove={() =>
                    update({ closing: content.closing.filter((_, at) => at !== index) })
                  }
                />
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ closing: [...content.closing, ''] })}
            >
              <Plus size={14} /> Add paragraph
            </Button>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['greeting', 'Greeting'],
                ['forLine', 'For … (company line)'],
                ['name', 'Signed by (name)'],
                ['title', 'Their designation'],
              ].map(([key, label]) => (
                <Field key={key} label={label} htmlFor={`offer-sign-${key}`}>
                  <input
                    id={`offer-sign-${key}`}
                    className={inputClass}
                    value={content.signOff[key]}
                    onChange={(event) => updateNested('signOff', { [key]: event.target.value })}
                    maxLength={150}
                  />
                </Field>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={content.signOff.showStamp}
                onChange={(event) => updateNested('signOff', { showStamp: event.target.checked })}
              />
              Print the company stamp (Settings → Company)
              {!stampDataUrl && <span className="text-xs text-warning">· none uploaded yet</span>}
            </label>
          </Card>

          <Card className="space-y-3 p-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={content.acceptance.show}
                onChange={(event) => updateNested('acceptance', { show: event.target.checked })}
              />
              Acceptance of offer (signed by the candidate)
            </label>
            {content.acceptance.show && (
              <>
                <TextArea
                  value={content.acceptance.text}
                  onChange={(value) => updateNested('acceptance', { text: value })}
                  maxLength={3000}
                  aria-label="Acceptance text"
                />
                <Field label="Name under the signature" htmlFor="offer-accept-name">
                  <input
                    id="offer-accept-name"
                    className={inputClass}
                    value={content.acceptance.name}
                    onChange={(event) => updateNested('acceptance', { name: event.target.value })}
                    maxLength={120}
                  />
                </Field>
              </>
            )}
          </Card>
        </div>

        <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-170px)]">
          <OfferPreview
            content={content}
            company={company}
            brand={brands[brandKey]}
            stampDataUrl={stampDataUrl}
          />
        </div>
      </div>
    </div>
  );
}
