import { withApi } from '@/server/api.js';
import { salaryImportBody } from '@/server/validation/schemas.js';
import { importSalaries, sampleSheet } from '@/server/services/salaryImport.service.js';
import { csvResponse } from '@/server/lib/csv.js';

// GET /api/salary/import — the sample sheet. POST — propose the salaries of an Excel sheet
// (each one waits for approval like any salary proposal).
export const GET = withApi({ permission: 'salary.manage' }, () =>
  csvResponse('salary-sheet-sample.csv', sampleSheet()),
);

export const POST = withApi(
  { permission: 'salary.manage', body: salaryImportBody },
  ({ user, body, ip }) => importSalaries(user, body, { ip }),
);
