// Words, dates and numbers as the screens show them. India time everywhere.

const TIME_ZONE = 'Asia/Kolkata';

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY_NAME = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: TIME_ZONE,
});
const DAY_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "2026-10-26" → "26 Oct 2026". */
export const formatDay = (day) => (day ? DATE.format(new Date(`${day}T00:00:00Z`)) : '—');
/** "2026-10-26" → "Mon, 26 Oct". */
export const formatDayName = (day) => (day ? DAY_NAME.format(new Date(`${day}T00:00:00Z`)) : '—');
/** "2026-10" → "October 2026". */
export const formatMonth = (month) => MONTH.format(new Date(`${month}-01T00:00:00Z`));
/** A Date or ISO text → "26 Oct 2026, 9:41 am". */
export const formatDateTime = (value) => (value ? DATE_TIME.format(new Date(value)) : '—');
/** Today in India: "2026-10-26". */
export const todayKey = () => DAY_KEY.format(new Date());

/** 545 → "9h 05m". */
export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** "2026-10" ± months. */
export function shiftMonth(month, by) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

/** Colour family of an attendance or leave status (a Badge tone). */
export function statusTone(status) {
  return (
    {
      Present: 'success',
      'Checked In': 'success',
      'Checked Out': 'info',
      Late: 'warning',
      Leave: 'info',
      'Leave pending': 'warning',
      Absent: 'danger',
      'No punch': 'neutral',
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
      cancelled: 'neutral',
      active: 'success',
      inactive: 'neutral',
    }[status] ?? 'neutral'
  );
}

export const capitalize = (text) => (text ? text[0].toUpperCase() + text.slice(1) : '');

const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
/** 3180000 paise → "₹31,800". */
export const formatRupees = (paise) =>
  paise === null || paise === undefined ? '—' : `₹${RUPEES.format(paise / 100)}`;
