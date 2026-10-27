import { withApi } from '@/server/api.js';
import { holidayBody, holidaysQuery } from '@/server/validation/schemas.js';
import { addHoliday, listHolidays } from '@/server/services/leaveRules.service.js';
import { indiaDay } from '@/server/lib/dates.js';

// GET /api/holidays?year= — holidays of a year (anyone signed in). POST — add one.
export const GET = withApi({ query: holidaysQuery }, async ({ query }) => ({
  items: await listHolidays(query.year ?? Number(indiaDay().slice(0, 4))),
}));

export const POST = withApi(
  { permission: 'settings.manage', body: holidayBody },
  async ({ user, body, ip }) => ({ holiday: await addHoliday(user, body, { ip }) }),
);
