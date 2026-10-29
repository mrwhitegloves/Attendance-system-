// India time helpers. We store real Dates (UTC); days and clock times are read in India time.

export const TIME_ZONE = 'Asia/Kolkata';

const DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});
const HOUR_MINUTE = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** The India-time day of a moment: "2026-10-26". */
export const indiaDay = (date = new Date()) => DAY.format(date);

/** The India-time clock of a moment, as the old records store it: "09:41 AM". */
export const indiaClock = (date = new Date()) => CLOCK.format(date);

/** Minutes since India midnight: 09:41 → 581. */
export function indiaMinutes(date = new Date()) {
  const [hours, minutes] = HOUR_MINUTE.format(date).split(':').map(Number);
  return (hours % 24) * 60 + minutes;
}

/** "09:30" → 570. */
export function clockToMinutes(value) {
  const [hours, minutes] = String(value || '')
    .split(':')
    .map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

/**
 * The text time of a record → minutes since midnight. Old records use both "09:41 AM" and
 * "19:09" (also with seconds, or "am"/"p.m."). Anything else → null.
 */
export function textTimeToMinutes(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap])?\.?\s*(m\.?)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  if (match[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (match[3].toLowerCase() === 'p' ? 12 : 0);
  } else if (hours > 23) return null;
  return hours * 60 + minutes;
}

/** Days of a month: "2026-09" → 30. */
export const daysInMonth = (month) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

/** Every day from start to end, both included: ["2026-10-01", …]. */
export function daysBetween(start, end) {
  const days = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last && days.length < 400) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** "2026-10" → { first: "2026-10-01", last: "2026-10-31" }. */
export function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, '0')}` };
}
