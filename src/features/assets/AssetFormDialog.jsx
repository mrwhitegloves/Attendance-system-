'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiFetch.js';
import { assetCategoryOptions } from '@/config/assetOptions.js';
import { Button, ErrorText } from '@/components/shared/ui.jsx';
import { Dialog } from '@/components/shared/Dialog.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';

const blank = {
  name: '',
  category: 'laptop',
  serialNumber: '',
  value: '',
  purchasedOn: '',
  note: '',
};

const fromAsset = (asset) => ({
  name: asset.name,
  category: asset.category,
  serialNumber: asset.serialNumber,
  value: asset.valuePaise === null ? '' : String(asset.valuePaise / 100),
  purchasedOn: asset.purchasedOn,
  note: asset.note,
});

/** Add an asset, or edit the details of one (keyed by the asset so it opens fresh). */
export function AssetFormDialog({ open, onClose, onSaved, asset = null }) {
  const [form, setForm] = useState(() => (asset ? fromAsset(asset) : blank));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form, value: form.value === '' ? null : Number(form.value) };
      const result = asset
        ? await apiFetch(`/api/assets/${asset._id}`, { method: 'PATCH', body })
        : await apiFetch('/api/assets', { method: 'POST', body });
      if (!asset) setForm(blank);
      onSaved(result.asset);
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={asset ? `Edit ${asset.code}` : 'Add an asset'}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="asset-name">
            <input
              id="asset-name"
              className={inputClass}
              value={form.name}
              onChange={change('name')}
              required
              minLength={2}
              maxLength={120}
              placeholder="e.g. Dell Latitude 5420"
            />
          </Field>
          <Field label="Kind" htmlFor="asset-category">
            <Select
              id="asset-category"
              value={form.category}
              onChange={change('category')}
              options={assetCategoryOptions}
            />
          </Field>
          <Field label="Serial or number (optional)" htmlFor="asset-serial">
            <input
              id="asset-serial"
              className={inputClass}
              value={form.serialNumber}
              onChange={change('serialNumber')}
              maxLength={80}
            />
          </Field>
          <Field label="Value in ₹ (optional)" htmlFor="asset-value">
            <input
              id="asset-value"
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.value}
              onChange={change('value')}
            />
          </Field>
          <Field label="Bought on (optional)" htmlFor="asset-bought">
            <input
              id="asset-bought"
              type="date"
              className={inputClass}
              value={form.purchasedOn}
              onChange={change('purchasedOn')}
            />
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor="asset-note">
          <textarea
            id="asset-note"
            className={`${inputClass} min-h-16`}
            value={form.note}
            onChange={change('note')}
            maxLength={500}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
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
