import { withApi, parse, readJson } from '@/server/api.js';
import { kycDetailsBody, kycItemParam } from '@/server/validation/schemas.js';
import { updateKycItem } from '@/server/services/kyc.service.js';

// PATCH /api/users/:id/kyc/:item — enter or change the details of pan | aadhaar | bank.
export const PATCH = withApi(
  { permission: 'kyc.manage' },
  async ({ request, user, params, ip }) => {
    const item = parse(kycItemParam, params.item);
    const body = parse(kycDetailsBody[item], await readJson(request));
    return updateKycItem(user, params.id, item, body, { ip });
  },
);
