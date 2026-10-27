import { AppSetting } from '../models/letter.model.js';
import { requirePermission } from '../permissions/can.js';
import { BRANDING } from '../../config/branding.js';
import { recordAudit, diffFields } from './audit.service.js';

// Company details printed on letters (Settings → Company).

const COMPANY_FIELDS = [
  'name',
  'address',
  'signatoryName',
  'signatoryTitle',
  'phone',
  'email',
  'website',
];

export async function getCompany() {
  const row = await AppSetting.findOne({ key: 'company' }).lean();
  return {
    name: BRANDING.companyName,
    address: '',
    signatoryName: '',
    signatoryTitle: '',
    phone: '',
    email: '',
    website: '',
    ...(row?.value ?? {}),
  };
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
