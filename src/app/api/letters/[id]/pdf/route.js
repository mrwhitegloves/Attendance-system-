import { withApi } from '@/server/api.js';
import { letterPdf } from '@/server/services/pdf.service.js';
import { pdfResponse } from '@/server/lib/pdfResponse.js';

// GET /api/letters/:id/pdf — the offer letter as a PDF file (?download=1 to save it).
export const runtime = 'nodejs';
export const GET = withApi({ permission: 'letters.view' }, async ({ request, user, params }) =>
  pdfResponse(request, await letterPdf(user, params.id)),
);
