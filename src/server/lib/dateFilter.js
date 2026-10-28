import { resolveDateRange } from '../../lib/dateRanges.js';
import { indiaDay } from './dates.js';

// Turns the date filter of a list (?range=thisMonth or ?range=custom&from=…&to=…) into Mongo
// conditions. Day fields are strings in India time ("2026-10-28"); moments (createdAt …) are
// Dates in UTC, so a day starts at 00:00 India time.

/** The India-time days of the filter, or null for "any time". */
export const dayRange = (query, now = new Date()) => resolveDateRange(query, indiaDay(now));

/** A condition on a day field ({ $gte, $lte }), or undefined for "any time". */
export function dayCondition(query, now) {
  const range = dayRange(query, now);
  if (!range) return undefined;
  return {
    ...(range.from ? { $gte: range.from } : {}),
    ...(range.to ? { $lte: range.to } : {}),
  };
}

/** A condition on a moment field (Date), from 00:00 India time of the first day. */
export function momentCondition(query, now) {
  const range = dayRange(query, now);
  if (!range) return undefined;
  return {
    ...(range.from ? { $gte: new Date(`${range.from}T00:00:00+05:30`) } : {}),
    ...(range.to ? { $lte: new Date(`${range.to}T23:59:59.999+05:30`) } : {}),
  };
}

/** A condition on a month field ("2026-10"): the months the range touches. */
export function monthCondition(query, now) {
  const range = dayRange(query, now);
  if (!range) return undefined;
  return {
    ...(range.from ? { $gte: range.from.slice(0, 7) } : {}),
    ...(range.to ? { $lte: range.to.slice(0, 7) } : {}),
  };
}

/** Records with a start and an end day that overlap the range (leave, reviews). */
export function overlapCondition(query, startField, endField, now) {
  const range = dayRange(query, now);
  if (!range) return {};
  return {
    ...(range.to ? { [startField]: { $lte: range.to } } : {}),
    ...(range.from ? { [endField]: { $gte: range.from } } : {}),
  };
}
