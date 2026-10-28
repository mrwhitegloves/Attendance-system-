import { withApi } from '@/server/api.js';
import { settlementPdf } from '@/server/services/pdf.service.js';
import { pdfResponse } from '@/server/lib/pdfResponse.js';

// GET /api/users/:id/settlement/pdf — the full and final statement as a PDF.
export const runtime = 'nodejs';
export const GET = withApi({ permission: 'exits.view' }, async ({ request, user, params }) =>
  pdfResponse(request, await settlementPdf(user, params.id)),
);
