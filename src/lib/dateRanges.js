// The date filter of every list (founder, 2026-10-28): the same choices everywhere, turned
// into a range of India-time days ("2026-10-01" … "2026-10-31"). Shared by the screens and the
// server. Weeks start on Monday; the financial year runs April to March; quarters are
// Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec (the same as the financial quarters).

export const DATE_RANGES = [
  { value: '', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'thisQuarter', label: 'This quarter' },
  { value: 'thisFinancialYear', label: 'This financial year' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'lastQuarter', label: 'Last quarter' },
  { value: 'lastFinancialYear', label: 'Last financial year' },
  { value: 'custom', label: 'Custom range' },
];

export const DATE_RANGE_KEYS = DATE_RANGES.map((option) => option.value).filter(Boolean);

const pad = (number) => String(number).padStart(2, '0');
const key = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const utc = (day) => new Date(`${day}T00:00:00Z`);
const addDays = (day, days) => {
  const date = utc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return key(date);
};
const monthStart = (year, month) => key(new Date(Date.UTC(year, month, 1)));
const monthEnd = (year, month) => key(new Date(Date.UTC(year, month + 1, 0)));

/**
 * The days of a range, or null for "any time".
 * @param {{ range?: string, from?: string, to?: string }} choice
 * @param {string} today India-time day "YYYY-MM-DD"
 * @returns {{ from: string|null, to: string|null } | null}
 */
export function resolveDateRange({ range, from, to } = {}, today) {
  // Old addresses with only from/to are a custom range.
  if (range === 'custom' || (!range && (from || to))) {
    if (!from && !to) return null;
    const [start, end] = from && to && from > to ? [to, from] : [from || null, to || null];
    return { from: start, to: end };
  }
  if (!range) return null;
  const date = utc(today);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const quarter = Math.floor(month / 3);
  // The financial year that today falls in starts in April of this year or the last.
  const fyStart = month >= 3 ? year : year - 1;
  switch (range) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'last90':
      return { from: addDays(today, -89), to: today };
    case 'thisWeek': {
      const sinceMonday = (date.getUTCDay() + 6) % 7;
      return { from: addDays(today, -sinceMonday), to: addDays(today, 6 - sinceMonday) };
    }
    case 'thisMonth':
      return { from: monthStart(year, month), to: monthEnd(year, month) };
    case 'lastMonth':
      return { from: monthStart(year, month - 1), to: monthEnd(year, month - 1) };
    case 'thisQuarter':
      return { from: monthStart(year, quarter * 3), to: monthEnd(year, quarter * 3 + 2) };
    case 'lastQuarter':
      return { from: monthStart(year, quarter * 3 - 3), to: monthEnd(year, quarter * 3 - 1) };
    case 'thisFinancialYear':
      return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
    case 'lastFinancialYear':
      return { from: `${fyStart - 1}-04-01`, to: `${fyStart}-03-31` };
    default:
      return null;
  }
}

/** The words of a chosen range ("This month", "1 Oct 2026 – 15 Oct 2026"). */
export function dateRangeLabel(choice, resolved) {
  if (!resolved) return 'Any time';
  if (choice.range && choice.range !== 'custom') {
    return DATE_RANGES.find((option) => option.value === choice.range)?.label ?? '';
  }
  return [resolved.from ?? '…', resolved.to ?? '…'].join(' – ');
}
