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

/** "09:41 AM" → 581 (the text times of old records). */
export function twelveHourToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}

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
