'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, ChevronRight, FileText, Headphones, LayoutDashboard, LockKeyhole, Mail, Menu, ShieldCheck, Wallet, X } from 'lucide-react';
import { lockBodyScroll } from './modalScroll';
import './admin.css';

export const ADMIN_LINKS = [
  { href: '/studio/overzicht', label: 'Cockpit', icon: LayoutDashboard, description: 'Alle beheeronderdelen op één plek.' },
  { href: '/studio/betalingen', label: 'Abonnementen & betalingen', icon: Wallet, description: 'Betaalinstellingen, abonnementen en kortingscodes.' },
  { href: '/studio', label: 'Verhalen', icon: BookOpen, description: 'Concepten schrijven, controleren en publiceren.' },
  { href: '/studio/voorlezen', label: 'Voorlezen', icon: Headphones, description: 'Vertelstemmen, OpenAI-koppeling en voorleesaudio beheren.' },
  { href: '/studio/premium', label: 'Online verhalen', icon: LockKeyhole, description: 'Premiumpublicaties en toegang beheren.' },
  { href: '/studio/email', label: 'E-mailinstellingen', icon: Mail, description: 'Resend, afzender, domein en echte testmail.' },
  { href: '/studio/email/templates', label: 'E-mailtemplates', icon: FileText, description: 'Accountmails en serviceberichten bewerken.' },
  { href: '/studio/privacy', label: 'Privacyverzoeken', icon: ShieldCheck, description: 'Ontvangst, verificatie en uitvoering van verzoeken.' },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const active = [...ADMIN_LINKS].sort((a, b) => b.href.length - a.href.length).find(link => pathname === link.href || link.href !== '/studio' && pathname.startsWith(`${link.href}/`));
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const release = lockBodyScroll();
    const workspace = content.current;
    if (workspace) workspace.inert = true;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : toggle.current;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') || []);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    const desktop = window.matchMedia('(min-width: 1000px)');
    const resize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', resize);
    return () => { release(); if (workspace) workspace.inert = false; document.removeEventListener('keydown', keyboard); desktop.removeEventListener('change', resize); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  function navigation(mobile = false) {
    return <><a className="admin-brand" href="/studio/overzicht"><img src="/brand/logo.webp" alt="Fabelpad" /><span>Studio</span></a><nav className="admin-navigation" aria-label={mobile ? 'Mobiele beheeronderdelen' : 'Beheeronderdelen'}>{ADMIN_LINKS.map(link => <a key={link.href} href={link.href} aria-current={active?.href === link.href ? 'page' : undefined} onClick={() => setOpen(false)}><link.icon size={20} aria-hidden="true" /><span>{link.label}</span></a>)}</nav><div className="admin-sidebar-footer"><a href="/gezin"><BookOpen size={18} aria-hidden="true" />Naar mijn gezin</a><a href="/profiel/account">Mijn account</a></div></>;
  }
  return <div className="admin-shell"><a className="admin-skip" href="#admin-workspace">Naar de inhoud</a><aside className="admin-sidebar" aria-label="Fabelpad Studio">{navigation()}</aside><div className="admin-workspace" ref={content}><header className="admin-topbar"><button ref={toggle} type="button" className="admin-menu-button" aria-label="Beheermenu openen" aria-haspopup="dialog" aria-expanded={open} aria-controls="admin-mobile-menu" onClick={() => setOpen(true)}><Menu size={22} aria-hidden="true" /></button><div className="admin-breadcrumb"><span>Platformbeheer</span><ChevronRight size={16} aria-hidden="true" /><strong>{active?.label || 'Studio'}</strong></div><a className="admin-return" href="/gezin">Mijn gezin →</a></header><main id="admin-workspace" tabIndex={-1} className="admin-main">{children}</main><footer className="admin-footer">Fabelpad Studio · <a href="/support">Hulp</a> · <a href="/privacy">Privacy</a></footer></div>{open && <div className="admin-drawer-backdrop" onClick={() => setOpen(false)}><aside ref={dialog} id="admin-mobile-menu" className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-menu-title" onClick={event => event.stopPropagation()}><div className="admin-drawer-heading"><strong id="admin-menu-title">Platformbeheer</strong><button type="button" aria-label="Beheermenu sluiten" onClick={() => setOpen(false)}><X size={22} aria-hidden="true" /></button></div>{navigation(true)}</aside></div>}</div>;
}
