import { amsterdamDate } from '../../src/profileReading';

export const PARENT_SESSION_MS = 5 * 60 * 1000;

/** A local parental gate, not identity verification. The answer is never persisted. */
export function parentYearAllowsAccess(value: string, today = amsterdamDate()): boolean {
  const age = Number(today.slice(0, 4)) - Number(value);
  return /^\d{4}$/.test(value) && age >= 19 && age <= 120;
}

export function parentSessionIsActive(expiresAt: number, now = Date.now()): boolean {
  return Number.isFinite(expiresAt) && expiresAt > now;
}
