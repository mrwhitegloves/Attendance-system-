import { withApi } from '@/server/api.js';
import { createKycLinkBody, listKycLinksQuery } from '@/server/validation/schemas.js';
import {
  createKycLink,
  createKycLinkForNewPerson,
  listKycLinks,
} from '@/server/services/kycLinks.service.js';

// GET /api/kyc-links — every link. POST — a link for an employee ({ userId }) or for a new
// person ({ name, phone }: an inactive employee is made).
export const GET = withApi(
  { permission: 'users.manage', query: listKycLinksQuery },
  ({ user, query }) => listKycLinks(user, query),
);

export const POST = withApi(
  { permission: 'users.manage', body: createKycLinkBody },
  async ({ user, body, ip }) => ({
    link: body.userId
      ? await createKycLink(user, body.userId, { ip })
      : await createKycLinkForNewPerson(user, body, { ip }),
  }),
);
