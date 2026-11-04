const locks = new Set<symbol>();
let originalOverflow = '';

/** Overlapping exit animations must not restore each other's body scroll state. */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  const token = Symbol('fabelpad-modal');
  if (locks.size === 0) originalOverflow = document.body.style.overflow;
  locks.add(token);
  document.body.style.overflow = 'hidden';
  return () => {
    if (!locks.delete(token)) return;
    if (locks.size === 0) document.body.style.overflow = originalOverflow;
  };
}
