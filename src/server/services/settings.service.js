import { AppSetting } from '../models/letter.model.js';
import { requirePermission } from '../permissions/can.js';
import { BRANDING } from '../../config/branding.js';
import { BRANDS, brandKeyOf } from '../../config/brands.js';
import { createAppError } from '../lib/errors.js';
import { decodeImageDataUrl } from '../lib/images.js';
import { isStorageConfigured, putFile, signedUrl } from '../infra/storage.js';
import { recordAudit, diffFields } from './audit.service.js';

// Company details printed on letters and salary slips (Settings → Company): the one legal
// company (name, short name, CIN, GST, address) and the words of its two brands.

const COMPANY_FIELDS = [
  'name',
  'shortName',
  'cin',
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

const BRAND_FIELDS = ['name', 'website', 'email', 'tagline'];

const DEFAULTS = {
  name: BRANDING.companyName,
  // "White Gloves Technology Pvt. Ltd." in sentences of letters.
  shortName: '',
  cin: '',
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
  brands: {},
};

/** The words of every brand, the saved ones over the defaults. */
function withBrands(company) {
  return {
    ...company,
    brands: Object.fromEntries(
      Object.entries(BRANDS).map(([key, brand]) => [
        key,
        { ...brand.defaults, ...(company.brands?.[key] ?? {}) },
      ]),
    ),
  };
}

/** The brand of a person (employee or candidate) with its logo, from the company details. */
export function brandFor(company, person) {
  const key = brandKeyOf(person);
  return { key, ...BRANDS[key], ...company.brands[key] };
}

/** The company details; with `withStamp`, also a short-lived link to the stamp image. */
export async function getCompany({ withStamp = false } = {}) {
  const row = await AppSetting.findOne({ key: 'company' }).lean();
  const company = withBrands({ ...DEFAULTS, ...(row?.value ?? {}) });
  if (withStamp) company.stampUrl = company.stampKey ? await signedUrl(company.stampKey) : null;
  return company;
}

export async function updateCompany(actor, input, { ip } = {}) {
  requirePermission(actor, 'settings.manage');
  const before = await getCompany();
  const value = {
    ...before,
    ...input,
    brands: Object.fromEntries(
      Object.keys(BRANDS).map((key) => [
        key,
        { ...before.brands[key], ...(input.brands?.[key] ?? {}) },
      ]),
    ),
  };
  await AppSetting.updateOne({ key: 'company' }, { $set: { value } }, { upsert: true });
  const changes = diffFields(before, input, COMPANY_FIELDS);
  for (const key of Object.keys(input.brands ?? {})) {
    for (const field of BRAND_FIELDS) {
      const from = before.brands[key]?.[field];
      const to = input.brands[key][field];
      if (to !== undefined && to !== from) changes[`${key}.${field}`] = { from, to };
    }
  }
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
