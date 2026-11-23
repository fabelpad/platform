'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { lockBodyScroll } from './modalScroll';

export default function LocalParentDialog({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href]') ?? []);
    const frame = requestAnimationFrame(() => (dialog.current?.querySelector<HTMLElement>('input') ?? focusable()[0] ?? dialog.current)?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (!first || !last) { event.preventDefault(); return; }
      if (!dialog.current?.contains(document.activeElement) || !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown); unlock(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="pd-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) close.current(); }}><section ref={dialog} className="pd-profile-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>{children}</section></div>;
}
