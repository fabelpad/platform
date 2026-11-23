'use client';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Download, Menu, Settings, Users, X } from 'lucide-react';

export type LocalParentTab = 'family' | 'downloads' | 'settings';
const destinations = [
  { id: 'family' as const, label: 'Mijn gezin', Icon: Users },
  { id: 'downloads' as const, label: 'Voor onderweg', Icon: Download },
  { id: 'settings' as const, label: 'Instellingen', Icon: Settings },
];

export default function LocalParentHeader({ active, onNavigate, onOpenApp }: { active: LocalParentTab; onNavigate: (tab: LocalParentTab) => void; onOpenApp: () => void }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('button,a')?.focus());
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); toggle.current?.focus(); } };
    const desktop = window.matchMedia('(min-width: 761px)');
    const resize = () => { if (desktop.matches) { const focused = menu.current?.contains(document.activeElement) || document.activeElement === toggle.current; setOpen(false); if (focused) container.current?.querySelector<HTMLElement>('.pd-primary-nav [aria-current="page"]')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    desktop.addEventListener('change', resize);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); desktop.removeEventListener('change', resize); };
  }, [open]);
  function choose(tab: LocalParentTab) { setOpen(false); onNavigate(tab); if (open) toggle.current?.focus(); }
  const links = destinations.map(({ id, label, Icon }) => <button key={id} type="button" aria-current={active === id ? 'page' : undefined} onClick={() => choose(id)}><Icon size={20} aria-hidden="true" />{label}</button>);
  return <header className="pd-header" ref={container}><div className="pd-header-inner">
    <button type="button" className="pd-brand" onClick={onOpenApp} aria-label="Fabelpad, naar de verhalen"><img src="/brand/logo.webp" alt="Fabelpad" width="154" height="62" /></button>
    <nav className="pd-primary-nav" aria-label="Ouderomgeving">{links}</nav>
    <div className="pd-header-actions"><button type="button" className="pd-header-icon" onClick={onOpenApp} aria-label="Terug naar de verhalen"><BookOpen size={23} aria-hidden="true" /></button><button ref={toggle} type="button" className="pd-header-icon pd-menu-toggle" aria-label={open ? 'Menu sluiten' : 'Menu'} aria-expanded={open} aria-controls="local-parent-menu" onClick={() => setOpen(value => !value)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button></div>
    {open && <nav id="local-parent-menu" className="pd-menu" aria-label="Mobiele ouderomgeving" ref={menu}>{links}<a href="/support" onClick={() => setOpen(false)}>Hulp</a><a href="/inloggen" onClick={() => setOpen(false)}>Inloggen als ouder</a></nav>}
  </div></header>;
}
