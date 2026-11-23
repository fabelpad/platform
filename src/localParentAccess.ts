const KEY = 'fabelpad-local-parent-access-until';
const DURATION = 10 * 60 * 1000;
let sessionUntil = 0;

/** A short local parent gate protects profile management on this device.
 * This is not an online identity check and never authorizes another family.
 */
export function hasLocalParentAccess(): boolean {
  try { const saved = Number(window.sessionStorage.getItem(KEY)); if (Number.isFinite(saved)) sessionUntil = Math.max(sessionUntil, saved); } catch { /* A blocked store keeps this tab's session usable. */ }
  return sessionUntil > Date.now();
}
export function grantLocalParentAccess(): void {
  sessionUntil = Date.now() + DURATION;
  try { window.sessionStorage.setItem(KEY, String(sessionUntil)); } catch { /* The in-memory gate still works in this tab. */ }
}
