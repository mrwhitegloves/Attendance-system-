import { AppSetting } from '../models/letter.model.js';
import { requirePermission } from '../permissions/can.js';
import { BRANDING } from '../../config/branding.js';
import { createAppError } from '../lib/errors.js';
import { decodeImageDataUrl } from '../lib/images.js';
import { isStorageConfigured, putFile, signedUrl } from '../infra/storage.js';
import { recordAudit, diffFields } from './audit.service.js';

// Company details printed on letters and salary slips (Settings → Company).

const COMPANY_FIELDS = [
  'name',
  'brandName',
  'tagline',
  'address',
  'gstNumber',
  'signatoryName',
  'signatoryTitle',
  'phone',
  'email',
  'website',
];

const DEFAULTS = {
  name: BRANDING.companyName,
  brandName: '',
  tagline: '',
  address: '',
  gstNumber: '',
  signatoryName: '',
  signatoryTitle: '',
  phone: '',
  email: '',
  website: '',
  // S3 key of the "Authorised Signatory" stamp image printed on salary slips.
  stampKey: null,
};

/** The company details; with `withStamp`, also a short-lived link to the stamp image. */
export async function getCompany({ withStamp = false } = {}) {
  const row = await AppSetting.findOne({ key: 'company' }).lean();
  const company = { ...DEFAULTS, ...(row?.value ?? {}) };
  if (withStamp) company.stampUrl = company.stampKey ? await signedUrl(company.stampKey) : null;
  return company;
}

export async function updateCompany(actor, input, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const before = await getCompany();
  const value = { ...before, ...input };
  await AppSetting.updateOne({ key: 'company' }, { $set: { value } }, { upsert: true });
  const changes = diffFields(before, input, COMPANY_FIELDS);
  if (Object.keys(changes).length) {
    await recordAudit(actor, {
      action: 'settings.company',
      entity: 'settings',
      summary: 'Company details changed',
      changes,
      ip,
    });
  }
  return value;
}

/** A new stamp image (the old one stays in S3: nothing is ever deleted there). */
export async function setCompanyStamp(actor, dataUrl, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  if (!isStorageConfigured()) throw createAppError(503, 'File storage is not set up yet.');
  const image = decodeImageDataUrl(dataUrl);
  const stampKey = await putFile(
    `company/stamp-${Date.now()}.${image.extension}`,
    image.bytes,
    image.contentType,
  );
  const before = await getCompany();
  await AppSetting.updateOne(
    { key: 'company' },
    { $set: { value: { ...before, stampKey } } },
    { upsert: true },
  );
  await recordAudit(actor, {
    action: 'settings.stamp',
    entity: 'settings',
    summary: 'Signatory stamp changed',
    ip,
  });
  return getCompany({ withStamp: true });
}
