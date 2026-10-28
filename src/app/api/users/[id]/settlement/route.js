import { withApi } from '@/server/api.js';
import { prepareSettlementBody, saveSettlementBody } from '@/server/validation/schemas.js';
import {
  getSettlement,
  prepareSettlement,
  saveSettlement,
} from '@/server/services/settlement.service.js';

// GET /api/users/:id/settlement — the full and final of the employee's exit.
// POST — prepare it with the suggested lines. PUT — change the lines of the draft.
export const GET = withApi({ permission: 'exits.view' }, ({ user, params }) =>
  getSettlement(user, params.id),
);

export const POST = withApi(
  { permission: 'exits.manage', body: prepareSettlementBody },
  ({ user, params, body, ip }) => prepareSettlement(user, params.id, body, { ip }),
);

export const PUT = withApi(
  { permission: 'exits.manage', body: saveSettlementBody },
  ({ user, params, body, ip }) => saveSettlement(user, params.id, body, { ip }),
);
