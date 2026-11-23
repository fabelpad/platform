'use client';
import { useEffect, useState } from 'react';
import AdminShell, { ADMIN_LINKS } from './AdminShell';
import { readAccountSession, type AccountSession } from './AccountPage';
import { worlds } from './worlds';
import { EMAIL_TEMPLATE_IDS } from '../lib/email/settings';

export default function AdminDashboard() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal }).then(readAccountSession).then(value => { if (!controller.signal.aborted) setSession(value); }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setChecked(true); });
    return () => controller.abort();
  }, []);
  const allowed = !!session?.admin && !!session.parent && (!session.lifecycle || session.lifecycle.state === 'active');
  return <AdminShell><header className="admin-page-heading"><div><span className="admin-eyebrow">Fabelpad Studio</span><h1>Goed overzicht. Ruimte voor verhalen.</h1><p>Van een eerste concept tot een zorgvuldig afgehandeld verzoek: kies waar je aan wilt werken.</p></div></header>{!checked ? <p role="status">Beheerrechten controleren…</p> : !allowed ? <p className="notice">Voor platformbeheer heb je een actief ouderaccount met beheerrechten nodig. <a href="/inloggen?next=%2Fstudio%2Foverzicht">Inloggen als beheerder</a></p> : <><div className="admin-metadata" aria-label="Catalogus"><span>{worlds.length} verhalen in de catalogus</span><span>5 delen · 31 paden per verhaal</span><span>{EMAIL_TEMPLATE_IDS.length} e-mailtemplates</span></div><div className="admin-dashboard-grid">{ADMIN_LINKS.filter(link => link.href !== '/studio/overzicht').map(link => <a className="admin-dashboard-card" href={link.href} key={link.href}><link.icon size={23} aria-hidden="true" /><h2>{link.label}</h2><p>{link.description}</p><span>Open {link.label.toLocaleLowerCase('nl-NL')} →</span></a>)}</div><section className="admin-card"><h2>Actuele gegevens bij de bron</h2><p>Open een beheeronderdeel voor de actuele serverstatus. Deze cockpit toont catalogusgegevens; aantallen betalingen, verzonden e-mails en privacyzaken worden hier niet opgeteld.</p><a href="/gezin">Naar de ouderomgeving →</a></section></>}</AdminShell>;
}
