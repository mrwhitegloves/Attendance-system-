import { withApi, parse } from '@/server/api.js';
import { kycItemParam, kycReviewBody } from '@/server/validation/schemas.js';
import { reviewKycItem } from '@/server/services/kyc.service.js';

// POST /api/users/:id/kyc/:item/review — verify or reject (never by the person who entered it).
export const POST = withApi(
  { permission: 'kyc.verify', body: kycReviewBody },
  ({ user, params, body, ip }) =>
    reviewKycItem(user, params.id, parse(kycItemParam, params.item), body, { ip }),
);
