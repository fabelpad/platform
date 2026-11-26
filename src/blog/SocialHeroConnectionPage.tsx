'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Link2, RefreshCw, Unplug } from 'lucide-react';
import AdminShell from '../AdminShell';
import { useAdminIdentity } from '../useAdminIdentity';
import type { SocialHeroConnectionView } from '../../lib/blog/types';
import { blogAdminRequest, blogDate, BlogRequestError } from './adminRequest';
import './blog-admin.css';

const labels: Record<SocialHeroConnectionView['status'], string> = { disconnected: 'Niet gekoppeld', pending: 'Verificatie wordt afgerond', active: 'Gekoppeld', expired: 'Koppelpoging verlopen', revoked: 'Verbinding ingetrokken' };

export default function SocialHeroConnectionPage() {
  const [connection, setConnection] = useState<SocialHeroConnectionView | null>(null);
  const [code, setCode] = useState(''), [allowDraft, setAllowDraft] = useState(true), [allowPublish, setAllowPublish] = useState(true);
  const [pairing, setPairing] = useState(false), [busy, setBusy] = useState(''), [problem, setProblem] = useState(''), [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null), generation = useRef(0);
  const identity = useAdminIdentity(() => { controller.current?.abort(); generation.current++; setConnection(null); setCode(''); setAllowDraft(false); setAllowPublish(false); setBusy(''); setProblem(''); setNotice(''); });
  const session = identity.session;
  function install(view: SocialHeroConnectionView) { const firstConnection = view.status === 'disconnected' && !view.destinationId && !view.connectionId && !view.expiresAt; setConnection(view); setAllowDraft(firstConnection ? true : view.allowDraft); setAllowPublish(firstConnection ? true : view.allowPublish); }
  async function action(kind: 'load' | 'pair' | 'check' | 'policy' | 'disconnect') {
    const operation = identity.capture(); if (!operation || busy) return;
    if (kind === 'pair' && !code.trim()) return;
    if (kind === 'disconnect' && (!connection?.connectionId || !window.confirm('Deze SocialHero-verbinding direct intrekken? De artikelen, revisies en bestemmingskoppelingen blijven bewaard.'))) return;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort; const current = ++generation.current;
    const policy = { connectionId: connection?.connectionId, allowDraft, allowPublish };
    const pair = { code: code.trim(), allowDraft, allowPublish };
    if (kind === 'pair') setCode('');
    setBusy(kind); setProblem(''); setNotice('');
    const isCurrent = () => identity.isCurrent(operation) && generation.current === current && !abort.signal.aborted;
    try {
      const suffix = kind === 'pair' ? '/pair' : kind === 'check' ? '/check' : '';
      const view = await blogAdminRequest<SocialHeroConnectionView>(operation, `/api/admin/blog/connection${suffix}`, { method: kind === 'load' ? 'GET' : kind === 'policy' ? 'PATCH' : kind === 'disconnect' ? 'DELETE' : 'POST', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]), ...(kind === 'load' ? {} : { body: JSON.stringify(kind === 'check' ? {} : kind === 'pair' ? pair : kind === 'disconnect' ? { connectionId: connection?.connectionId } : policy) }) });
      if (!isCurrent()) return;
      if (view) install(view); else {
        const next = await blogAdminRequest<SocialHeroConnectionView>(operation, '/api/admin/blog/connection', { signal: abort.signal });
        if (!isCurrent()) return;
        install(next);
      }
      setPairing(false);
      if (kind === 'pair') setNotice(view?.status === 'active' ? 'De koppeling is gecontroleerd en actief.' : 'De koppelpoging is bewaard. Controleer de verbinding om de verificatie af te ronden.');
      if (kind === 'check') setNotice(view?.status === 'active' ? 'De verbinding is gecontroleerd en actief.' : 'De actuele verbindingsstatus is opgehaald.');
      if (kind === 'policy') setNotice('De rechten zijn opgeslagen en gelden direct voor nieuwe verzoeken.');
      if (kind === 'disconnect') setNotice('De verbinding is ingetrokken. Bestaande artikelen en revisies blijven bewaard.');
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof BlogRequestError && [401, 403, 410].includes(error.status) && error.code !== 'PAIRING_EXPIRED') identity.invalidate();
      else setProblem(error instanceof Error ? error.message : 'De verbinding kon niet worden gecontroleerd. Haal eerst de status op voordat je opnieuw koppelt.');
    } finally { if (isCurrent()) setBusy(''); }
  }
  useEffect(() => {
    if (identity.checked && session?.admin && session.parent && !identity.denied) void action('load');
    return () => { controller.current?.abort(); generation.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.checked, session?.parent?.id, session?.admin]);
  const blocked = identity.denied || !!session && (!session.admin || !session.parent);
  const isNew = !!connection && connection.status === 'disconnected' && !connection.destinationId && !connection.connectionId && !connection.expiresAt;
  const showPairing = !!connection && (pairing || connection.status !== 'active' && connection.status !== 'pending');
  const policyChanged = !!connection && (allowDraft !== connection.allowDraft || allowPublish !== connection.allowPublish);
  const permissions = <div className="blog-connection-permissions"><label className="account-check"><input type="checkbox" checked={allowDraft} disabled={!!busy} onChange={event => { setAllowDraft(event.target.checked); if (!event.target.checked) setAllowPublish(false); }} /><span><strong>SocialHero mag concepten aanmaken en bewerken</strong><small>SocialHero kan afbeeldingen uploaden en artikelen als concept bewaren.</small></span></label><label className="account-check"><input type="checkbox" checked={allowPublish} disabled={!!busy || !allowDraft} onChange={event => setAllowPublish(event.target.checked)} /><span><strong>SocialHero mag automatisch publiceren</strong><small>SocialHero mag artikelen zelfstandig live zetten volgens de campagneplanning en de ingestelde goedkeuringsmodus.</small></span></label>{!allowDraft && <p className="account-legal-note">Automatisch publiceren vereist toegang tot concepten. Daarom staat publiceren ook uit zolang concepten zijn uitgeschakeld.</p>}</div>;
  return <AdminShell><div className="blog-connection-page"><header className="admin-page-heading"><div><span className="admin-eyebrow">Integraties</span><h1>SocialHero</h1><p>Koppel SocialHero aan de blog van deze Fabelpad-omgeving.</p></div><a className="account-secondary" href="/studio/blog">Naar Blog & artikelen</a></header>
    {blocked ? <section className="admin-card"><p role="alert">{identity.error || 'Log in als beheerder om de koppeling te beheren.'}</p><a className="account-primary" href="/inloggen?next=%2Fstudio%2Fintegraties%2Fsocialhero">Inloggen als beheerder</a></section> : <>
    {problem && <p className="account-feedback" role="alert">{problem}</p>}{notice && <p className="account-feedback" role="status">{notice}</p>}
    {!connection ? <section className="admin-card">{problem || identity.error ? <><p>{identity.error}</p><button type="button" className="account-secondary" disabled={!!busy} onClick={() => void action('load')}>Status opnieuw ophalen</button></> : <p role="status">Verbindingsstatus ophalen…</p>}</section> : <>
    <section className="admin-card blog-connection-status"><div className="blog-connection-status-heading">{connection.status === 'active' ? <CheckCircle2 size={25} /> : <Link2 size={25} />}<h2>{labels[connection.status]}</h2></div><dl><div><dt>Website</dt><dd>{connection.site.siteName}</dd></div><div><dt>Omgeving</dt><dd>{connection.site.environment === 'production' ? 'Productie' : connection.site.environment === 'staging' ? 'Staging' : 'Lokaal'}</dd></div><div><dt>Websiteadres</dt><dd>{connection.site.origin}</dd></div><div><dt>Blogadres</dt><dd>{connection.site.blogPath}</dd></div><div><dt>Laatste controle</dt><dd>{blogDate(connection.lastCheckedAt)}</dd></div><div><dt>Actieve rechten</dt><dd>{connection.scopes.length ? connection.scopes.map(scope => ({ read: 'Status lezen', draft: 'Concepten bewerken', publish: 'Publiceren' })[scope] || scope).join(', ') : 'Geen'}</dd></div></dl><div className="account-actions"><button type="button" className="account-secondary" disabled={!!busy} onClick={() => void action(connection.status === 'active' || connection.status === 'pending' ? 'check' : 'load')}><RefreshCw size={16} />{busy === 'check' ? 'Controleren…' : connection.status === 'pending' ? 'Verificatie hervatten' : 'Verbinding controleren'}</button>{connection.status === 'active' && <button type="button" className="account-secondary" disabled={!!busy} onClick={() => { setPairing(value => !value); setCode(''); }}>Opnieuw koppelen</button>}</div>{connection.status === 'pending' && <p className="notice">De koppelpoging is veilig bewaard. Hervat de verificatie; een nieuwe code is pas nodig als de poging is verlopen.{connection.expiresAt && ` Geldig tot ${blogDate(connection.expiresAt)}.`}</p>}</section>
    {showPairing ? <section className="admin-card"><h2>{connection.destinationId ? 'Opnieuw koppelen' : 'Koppelen met één code'}</h2><p>Maak in SocialHero een koppelcode voor <strong>{connection.site.origin}</strong> en deze omgeving. Vul de code hieronder in.</p><form onSubmit={(event: FormEvent) => { event.preventDefault(); void action('pair'); }}>{permissions}{isNew && <p className="account-legal-note">Beide rechten staan voor een nieuwe koppeling aan. Je kunt ze hieronder aanpassen voordat je koppelt.</p>}<label>Koppelcode<input type="text" autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={256} value={code} disabled={!!busy} onChange={event => setCode(event.target.value)} /></label><div className="account-actions"><button type="submit" className="account-primary" disabled={!code.trim() || !!busy}><Link2 size={16} />{busy === 'pair' ? 'Koppelen…' : 'Koppelen'}</button>{pairing && <button type="button" className="account-secondary" disabled={!!busy} onClick={() => { setPairing(false); setCode(''); setAllowDraft(connection.allowDraft); setAllowPublish(connection.allowPublish); }}>Annuleren</button>}</div></form><p className="account-legal-note">Een nieuwe koppeling behoudt bestaande artikelen en bestemmingskoppelingen. Een eerder uitgezette toestemming blijft uit staan.</p></section> : <section className="admin-card"><h2>Toegang van SocialHero</h2>{permissions}<button type="button" className="account-primary" disabled={!policyChanged || !!busy || !connection.connectionId} onClick={() => void action('policy')}>{busy === 'policy' ? 'Rechten opslaan…' : 'Rechten opslaan'}</button><p className="account-legal-note">Aanpassingen gelden direct. SocialHero kan alleen met de actuele rechten schrijven of publiceren.</p></section>}
    {connection.connectionId && connection.status !== 'revoked' && <section className="admin-card"><h2>Koppeling intrekken</h2><p>Stop de toegang van deze verbinding. De blog, revisies en historische koppelingen blijven bewaard.</p><button type="button" className="account-secondary account-danger" disabled={!!busy} onClick={() => void action('disconnect')}><Unplug size={16} />Koppeling intrekken</button></section>}
    </>}
    </>}
  </div></AdminShell>;
}
