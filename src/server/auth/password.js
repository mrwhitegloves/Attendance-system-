import { timingSafeEqual } from 'node:crypto';

// Passwords are stored exactly as typed (founder decision, same as the EngenX CRM).
// This is the ONLY place two passwords are compared. Never log or return a password.

export const MIN_PASSWORD_LENGTH = 8;

export function passwordsMatch(typed, stored) {
  if (typeof typed !== 'string' || typeof stored !== 'string' || !stored) return false;
  const a = Buffer.from(typed);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
