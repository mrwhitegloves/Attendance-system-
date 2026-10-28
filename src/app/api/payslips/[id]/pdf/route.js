import { withApi } from '@/server/api.js';
import { payslipPdf } from '@/server/services/pdf.service.js';
import { pdfResponse } from '@/server/lib/pdfResponse.js';

// GET /api/payslips/:id/pdf — the salary slip as a PDF file (?download=1 to save it).
export const runtime = 'nodejs';
export const GET = withApi({ permission: 'payslips.view' }, async ({ request, user, params }) =>
  pdfResponse(request, await payslipPdf(user, params.id)),
);
