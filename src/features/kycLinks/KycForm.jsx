'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { ACCEPTED_UPLOADS, readUploadFile, shrinkImage } from '@/lib/readFile.js';
import { BLOOD_GROUPS, GENDER } from '@/config/employeeOptions.js';
import { Button, Card, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';
import { flattenDraft, readLocalDraft, useDraftSaver } from './useDraft.js';

const EMPTY = {
  phone: '',
  dateOfBirth: '',
  gender: '',
  bloodGroup: '',
  personalEmail: '',
  currentAddress: '',
  permanentAddress: '',
  'emergencyContact.name': '',
  'emergencyContact.relation': '',
  'emergencyContact.phone': '',
  'pan.number': '',
  'pan.nameOnPan': '',
  aadhaarLast4: '',
  'bank.accountHolderName': '',
  'bank.bankName': '',
  'bank.ifsc': '',
  'bank.accountNumber': '',
  accountNumberAgain: '',
  sameAddress: false,
  experienceType: '',
  'previousCompany.name': '',
  'previousCompany.hrName': '',
  'previousCompany.hrPhone': '',
  'previousCompany.hrEmail': '',
  'previousCompany.reportingManager': '',
  lastDrawnSalary: '',
};

// Form-only keys that are not sent.
const NOT_SENT = ['accountNumberAgain', 'sameAddress'];
const PREVIOUS = ['previousCompany', 'lastDrawnSalary'];

/** "a.b" keys → nested objects, as the server expects. */
function toBody(form) {
  const body = {};
  for (const [key, value] of Object.entries(form)) {
    if (NOT_SENT.includes(key)) continue;
    const [group, field] = key.split('.');
    // A fresher has no previous company.
    if (form.experienceType !== 'experienced' && PREVIOUS.includes(group)) continue;
    const clean = String(value ?? '').trim();
    if (field) body[group] = { ...body[group], [field]: clean };
    else body[key] = clean;
  }
  if (form.sameAddress) body.permanentAddress = body.currentAddress;
  return body;
}

/** The employee's KYC form, opened from the link HR sent (no sign-in). */
export function KycForm({ token, data }) {
  // The saved draft (server), then — after the page is shown — this device's newer copy.
  const [form, setForm] = useState(() => ({ ...EMPTY, ...flattenDraft(data.draft) }));
  const [uploads, setUploads] = useState(data.uploads);
  const [uploading, setUploading] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const draft = useDraftSaver(token, form, { enabled: !done });

  useEffect(() => {
    const local = readLocalDraft(token, data.draftRev ?? 0);
    if (local) setForm((current) => ({ ...current, ...local }));
  }, [token, data.draftRev]);

  const sameAddress = Boolean(form.sameAddress);
  const experienced = form.experienceType === 'experienced';
  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const upload = (field) => async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(field);
    setError('');
    try {
      const dataUrl = field === 'photo' ? await shrinkImage(file, 800) : await readUploadFile(file);
      const result = await apiFetch(`/api/public/kyc/${token}/files`, {
        method: 'POST',
        body: { field, file: dataUrl, fileName: file.name },
      });
      setUploads((current) => ({ ...current, [field]: result.fileName }));
      if (field === 'photo') setPhotoPreview(dataUrl);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setUploading('');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form['bank.accountNumber'] !== form.accountNumberAgain) {
      setError('The two bank account numbers are not the same.');
      return;
    }
    setBusy(true);
    try {
      const body = toBody(form);
      await apiFetch(`/api/public/kyc/${token}`, { method: 'POST', body });
      draft.clear();
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  if (done) return <Thanks name={data.name} />;

  const text = (key, label, props = {}) => (
    <Field label={label} htmlFor={key}>
      <input
        id={key}
        className={inputClass}
        value={form[key]}
        onChange={update(key)}
        required={props.required ?? true}
        {...props}
      />
    </Field>
  );

  const fileField = (field, label, { image = false, required = true } = {}) => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="font-medium">
          {label}
          {required && <span className="text-danger"> *</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {uploads[field] ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 size={13} /> {uploads[field]}
            </span>
          ) : image ? (
            'A clear photo'
          ) : (
            'PDF or photo, at most 3 MB'
          )}
        </p>
      </div>
      <label
        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-raised ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        {uploading === field ? <Spinner /> : <Upload size={15} />}
        {uploads[field] ? 'Change' : 'Upload'}
        <input
          type="file"
          accept={image ? 'image/jpeg,image/png,image/webp' : ACCEPTED_UPLOADS}
          className="hidden"
          onChange={upload(field)}
        />
      </label>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {data.rejectReason && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-danger">
            <AlertTriangle size={18} /> HR sent your form back
          </p>
          <p className="mt-1">{data.rejectReason}</p>
          <p className="mt-1 text-xs text-muted">
            Your answers and files are still here. Correct them and send the form again.
          </p>
        </div>
      )}
      <DraftStatus status={draft.status} />
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">Your photo</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-xs text-muted">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Your photo" className="h-full w-full object-cover" />
            ) : uploads.photo ? (
              <CheckCircle2 className="text-success" />
            ) : (
              'No photo'
            )}
          </div>
          <div className="flex-1">{fileField('photo', 'Profile photo', { image: true })}</div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Personal details</legend>
          {text('phone', 'Mobile number', { type: 'tel', inputMode: 'tel' })}
          {text('dateOfBirth', 'Date of birth', { type: 'date' })}
          <Field label="Gender" htmlFor="gender">
            <Select
              id="gender"
              required
              value={form.gender}
              onChange={update('gender')}
              options={[{ value: '', label: 'Choose…' }, ...GENDER.list]}
            />
          </Field>
          <Field label="Blood group (optional)" htmlFor="bloodGroup">
            <Select
              id="bloodGroup"
              value={form.bloodGroup}
              onChange={update('bloodGroup')}
              options={[
                { value: '', label: 'Choose…' },
                ...BLOOD_GROUPS.map((group) => ({ value: group, label: group })),
              ]}
            />
          </Field>
          {text('personalEmail', 'Personal email (optional)', { type: 'email', required: false })}
          <div className="hidden sm:block" />
          <Field label="Current address" htmlFor="currentAddress">
            <textarea
              id="currentAddress"
              required
              rows={3}
              maxLength={300}
              className={`${inputClass} h-auto py-2`}
              value={form.currentAddress}
              onChange={update('currentAddress')}
            />
          </Field>
          <Field label="Permanent address" htmlFor="permanentAddress">
            <textarea
              id="permanentAddress"
              required={!sameAddress}
              disabled={sameAddress}
              rows={3}
              maxLength={300}
              className={`${inputClass} h-auto py-2 disabled:opacity-60`}
              value={sameAddress ? form.currentAddress : form.permanentAddress}
              onChange={update('permanentAddress')}
            />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={sameAddress}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sameAddress: event.target.checked }))
                }
              />
              Same as the current address
            </label>
          </Field>
        </fieldset>
      </Card>

      <Card className="p-4 sm:p-5">
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-3 text-sm font-semibold">Emergency contact</legend>
          {text('emergencyContact.name', 'Name')}
          {text('emergencyContact.relation', 'Relation', { placeholder: 'Father, wife …' })}
          {text('emergencyContact.phone', 'Phone', { type: 'tel', inputMode: 'tel' })}
        </fieldset>
      </Card>

      <Card className="p-4 sm:p-5">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">PAN card</legend>
          {text('pan.number', 'PAN number', {
            placeholder: 'ABCDE1234F',
            maxLength: 10,
            autoCapitalize: 'characters',
          })}
          {text('pan.nameOnPan', 'Name as printed on the PAN')}
          <div className="sm:col-span-2">
            {fileField('panProof', 'Photo or PDF of the PAN card')}
          </div>
        </fieldset>
      </Card>

      <Card className="p-4 sm:p-5">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Aadhaar card</legend>
          {text('aadhaarLast4', 'Last 4 digits of your Aadhaar', {
            inputMode: 'numeric',
            maxLength: 4,
            pattern: '\\d{4}',
          })}
          <p className="self-end text-xs text-muted">
            For your safety we keep only the last 4 digits of the number.
          </p>
          <div className="sm:col-span-2">
            {fileField('aadhaarProof', 'Photo or PDF of the Aadhaar card')}
          </div>
        </fieldset>
      </Card>

      <Card className="p-4 sm:p-5">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Bank account (for your salary)</legend>
          {text('bank.accountHolderName', 'Account holder name')}
          {text('bank.bankName', 'Bank name')}
          {text('bank.accountNumber', 'Account number', { inputMode: 'numeric' })}
          {text('accountNumberAgain', 'Account number again', { inputMode: 'numeric' })}
          {text('bank.ifsc', 'IFSC code', {
            placeholder: 'SBIN0001234',
            maxLength: 11,
            autoCapitalize: 'characters',
          })}
          <div className="sm:col-span-2">
            {fileField('bankProof', 'Cancelled cheque or first page of the passbook')}
          </div>
        </fieldset>
      </Card>

      <Card className="p-4 sm:p-5">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">
            Your work experience <span className="text-danger">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['fresher', 'Fresher', 'This is my first job.'],
              ['experienced', 'Experienced', 'I worked in another company before.'],
            ].map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${form.experienceType === value ? 'border-brand bg-brand/5' : 'border-border'}`}
              >
                <input
                  type="radio"
                  name="experienceType"
                  value={value}
                  required
                  checked={form.experienceType === value}
                  onChange={update('experienceType')}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      {experienced && (
        <>
          <Card className="p-4 sm:p-5">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">Previous company details</legend>
              {text('previousCompany.name', 'Previous company name')}
              {text('previousCompany.hrName', "Previous company HR's name")}
              {text('previousCompany.hrPhone', "Previous company HR's contact number", {
                type: 'tel',
                inputMode: 'tel',
              })}
              {text('previousCompany.hrEmail', "Previous company HR's email ID", { type: 'email' })}
              {text('previousCompany.reportingManager', 'Reporting manager name (optional)', {
                required: false,
              })}
            </fieldset>
          </Card>

          <Card className="p-4 sm:p-5">
            <fieldset className="grid gap-4">
              <legend className="mb-3 text-sm font-semibold">Previous company salary</legend>
              {text('lastDrawnSalary', 'Last drawn monthly salary (₹)', {
                type: 'number',
                inputMode: 'decimal',
                min: 1,
                step: '0.01',
              })}
              <p className="text-xs text-muted">
                Salary slip or salary bank statement of your latest 3 months (photo or PDF).
              </p>
              {fileField('salarySlip1', 'Latest month')}
              {fileField('salarySlip2', 'Month before')}
              {fileField('salarySlip3', 'Third month')}
            </fieldset>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold">Previous company employment document</h2>
            {fileField(
              'experienceDoc',
              'Experience certificate, joining letter or offer letter of the previous company',
            )}
          </Card>
        </>
      )}

      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-semibold">White Gloves Technology documents</h2>
        <p className="mb-3 text-xs text-muted">
          Your offer letter from White Gloves Technology, signed by you (photo or PDF).
        </p>
        {fileField('signedOfferLetter', 'Signed offer letter')}
      </Card>

      {data.documents.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-1 text-sm font-semibold">Documents (if you have them)</h2>
          <p className="mb-3 text-xs text-muted">PDF or photo, at most 3 MB each.</p>
          <div className="space-y-2">
            {data.documents.map((doc) => (
              <div key={doc.field}>{fileField(doc.field, doc.name, { required: false })}</div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required className="mt-1" />
          <span>I confirm that these details are correct and are my own.</span>
        </label>
        <div className="mt-4 space-y-3">
          <ErrorText>{error}</ErrorText>
          <Button type="submit" size="lg" className="w-full" disabled={busy || Boolean(uploading)}>
            {busy && <Spinner />} Submit my details
          </Button>
          <p className="text-center text-xs text-muted">
            Your answers are saved while you type. After you send the form, HR checks it.
          </p>
        </div>
      </Card>
    </form>
  );
}

/** Shows whether the answers are saved (on the server, or only on this device). */
function DraftStatus({ status }) {
  if (status === 'idle') return null;
  return (
    <p
      className={`sticky top-2 z-10 ml-auto flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs shadow-sm ${status === 'offline' ? 'bg-warning/15 text-warning' : 'bg-surface text-muted'}`}
      aria-live="polite"
    >
      {status === 'saving' && (
        <>
          <Spinner className="h-3 w-3" /> Saving…
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 size={13} className="text-success" /> Your answers are saved
        </>
      )}
      {status === 'offline' && (
        <>
          <CloudOff size={13} /> No internet: saved on this phone, will be sent
        </>
      )}
    </p>
  );
}

export function Thanks({ name }) {
  return (
    <Card className="p-6 text-center">
      <CheckCircle2 className="mx-auto mb-3 text-success" size={40} />
      <h2 className="text-lg font-semibold">Thank you{name ? `, ${name}` : ''}!</h2>
      <p className="mt-1 text-sm text-muted">
        Your details were sent to HR for checking. You can close this page.
      </p>
    </Card>
  );
}
