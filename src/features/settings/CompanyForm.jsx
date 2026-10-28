'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';
import { BRANDS } from '@/config/brands.js';

const FIELDS = [
  ['name', 'Legal company name (full)', 'White Gloves Technology Private Limited'],
  ['shortName', 'Short legal name (in letter sentences)', 'White Gloves Technology Pvt. Ltd.'],
  ['cin', 'CIN', 'U50400JH2021PTC017561'],
  ['gstNumber', 'GST registration number', '20AADCW1091R1Z3'],
  ['signatoryName', 'Who signs offer letters (name)', 'Muskan'],
  ['signatoryTitle', 'Their designation', 'Human Resources, White Gloves Technology Pvt. Ltd.'],
  ['phone', 'Phone', ''],
  ['email', 'Email', ''],
];

const BRAND_FIELDS = [
  ['name', 'Name (letter header and slip)'],
  ['website', 'Website'],
  ['email', 'Email (letter footer)'],
  ['tagline', 'Tagline (salary slip)'],
];

/** Shrinks a stamp picture to at most 600 px, keeping it a PNG (transparent background stays). */
function shrinkStamp(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 600 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('This file is not a picture.'));
    image.src = URL.createObjectURL(file);
  });
}

export function CompanyForm({ company }) {
  const router = useRouter();
  const stampInput = useRef(null);
  const [form, setForm] = useState(company);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = Object.fromEntries(
        [...FIELDS.map(([key]) => key), 'address'].map((key) => [key, form[key] ?? '']),
      );
      body.brands = Object.fromEntries(
        Object.keys(BRANDS).map((key) => [
          key,
          Object.fromEntries(
            BRAND_FIELDS.map(([field]) => [field, form.brands?.[key]?.[field] ?? '']),
          ),
        ]),
      );
      await apiFetch('/api/settings/company', { method: 'PATCH', body });
      setMessage('Saved.');
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadStamp = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/settings/company/stamp', {
        method: 'POST',
        body: { photo: await shrinkStamp(file) },
      });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card className="p-4 sm:p-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label, placeholder]) => (
            <Field key={key} label={label} htmlFor={`company-${key}`}>
              <input
                id={`company-${key}`}
                className={inputClass}
                placeholder={placeholder}
                value={form[key] ?? ''}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </Field>
          ))}
          <div className="sm:col-span-2">
            <Field label="Address" htmlFor="company-address">
              <textarea
                id="company-address"
                rows={3}
                className={`${inputClass} h-auto py-2`}
                value={form.address ?? ''}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </Field>
          </div>
          {Object.entries(BRANDS).map(([key, brand]) => (
            <fieldset
              key={key}
              className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2 sm:grid-cols-2"
            >
              <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.letterLogo} alt="" className="h-5 w-auto" />
                {brand.label}
              </legend>
              {BRAND_FIELDS.map(([field, label]) => (
                <Field key={field} label={label} htmlFor={`brand-${key}-${field}`}>
                  <input
                    id={`brand-${key}-${field}`}
                    className={inputClass}
                    value={form.brands?.[key]?.[field] ?? ''}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        brands: {
                          ...form.brands,
                          [key]: { ...form.brands?.[key], [field]: event.target.value },
                        },
                      })
                    }
                  />
                </Field>
              ))}
            </fieldset>
          ))}
          <div className="flex items-center justify-end gap-3 sm:col-span-2">
            {message && <span className="text-sm text-success">{message}</span>}
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </div>
        </form>
      </Card>
      <Card className="h-fit">
        <CardHeader
          title="Signatory stamp"
          subtitle="Printed on salary slips and offer letters (round stamp with signature)."
        />
        <div className="space-y-3 p-4">
          {company.stampUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.stampUrl}
              alt="Company stamp"
              className="mx-auto h-40 w-40 object-contain"
            />
          ) : (
            <p className="rounded-lg bg-raised p-6 text-center text-sm text-muted">No stamp yet</p>
          )}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => stampInput.current?.click()}
            disabled={busy}
          >
            <Upload size={15} /> {company.stampUrl ? 'Change stamp' : 'Upload stamp'}
          </Button>
          <input
            ref={stampInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={uploadStamp}
          />
        </div>
      </Card>
    </div>
  );
}
