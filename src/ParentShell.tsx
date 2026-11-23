'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpen, CircleHelp, CreditCard, Menu, UserRound, UsersRound, X } from 'lucide-react';
import LegalFooter from './LegalFooter';
import './parent-admin-parent.css';

type Destination = 'family' | 'account' | 'subscription' | 'help';
const destinations = [
  { id: 'family', href: '/gezin?ouders=1', label: 'Mijn gezin', Icon: UsersRound },
  { id: 'account', href: '/profiel/account', label: 'Ouderaccount', Icon: UserRound },
  { id: 'subscription', href: '/profiel/abonnement', label: 'Abonnement', Icon: CreditCard },
  { id: 'help', href: '/support', label: 'Hulp', Icon: CircleHelp },
] as const;

export default function ParentShell({ children, active, storiesHref = '/gezin', onStories }: { children: ReactNode; active?: Destination; storiesHref?: string; onStories?: () => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false); };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); toggle.current?.focus(); }
    };
    const focus = (event: FocusEvent) => { if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false); };
    const desktop = window.matchMedia('(min-width: 860px)');
    const resize = () => { if (desktop.matches) { const inside = navigation.current?.contains(document.activeElement); setOpen(false); if (inside) toggle.current?.blur(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key); document.addEventListener('focusin', focus); desktop.addEventListener('change', resize);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus); desktop.removeEventListener('change', resize); };
  }, [open]);
  const links = destinations.map(({ id, href, label, Icon }) => <a key={id} href={href} aria-current={active === id ? 'page' : undefined} onClick={() => setOpen(false)}><Icon size={19} aria-hidden="true" />{label}</a>);
  return <div className="simple-page fp-parent">
    <a className="fp-parent-skip" href="#parent-content">Naar de inhoud</a>
    <header className="fp-parent-header"><div className="fp-parent-header-inner">
      <a className="fp-parent-brand" href="/gezin?ouders=1" aria-label="Fabelpad, Mijn gezin"><img src="/brand/logo.webp" alt="Fabelpad" width="180" height="72" /></a>
      <nav className="fp-parent-desktop-nav" aria-label="Ouderomgeving">{links}</nav>
      <div className="fp-parent-header-actions" ref={wrapper}>
        <a className="fp-parent-icon" href={storiesHref} aria-label="Terug naar de verhalen" title="Terug naar de verhalen" onClick={event => { if (onStories) { event.preventDefault(); onStories(); } }}><BookOpen size={23} aria-hidden="true" /></a>
        <button className="fp-parent-icon fp-parent-menu-toggle" ref={toggle} type="button" aria-label={open ? 'Menu sluiten' : 'Menu'} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => navigation.current?.querySelector<HTMLAnchorElement>('a')?.focus()); } }}>{open ? <X size={23} aria-hidden="true" /> : <Menu size={23} aria-hidden="true" />}</button>
        <nav id={menuId} ref={navigation} className="fp-parent-mobile-nav" aria-label="Mobiel oudermenu" hidden={!open}>{links}</nav>
      </div>
    </div></header>
    <main id="parent-content" tabIndex={-1}>{children}</main>
    <LegalFooter />
  </div>;
}

export function ParentDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = dialog.current; current?.showModal();
    return () => { current?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog className="fp-parent-dialog" ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) closeRef.current(); }} onClick={event => { if (!busy && event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeRef.current(); } }}><div className="fp-parent-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="fp-parent-icon" aria-label="Dialoog sluiten" disabled={busy} onClick={onClose}><X size={21} aria-hidden="true" /></button></div>{children}</dialog>;
}
