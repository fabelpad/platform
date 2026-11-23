'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import AdminShell from './AdminShell';
import { useAdminIdentity, type AdminOperation } from './useAdminIdentity';
import { PRIVACY_EXTENSION_REASONS, PRIVACY_REQUEST_KINDS, type PrivacyCase, type PrivacyCasesResponse, type PrivacyRequestKind } from '../lib/privacyAdmin';
import './privacy-admin.css';

const STATES = { received: 'Ontvangen', verified: 'Geverifieerd', executing: 'Uitvoering loopt', completed: 'Afgerond', declined: 'Afgewezen', extended: 'Termijn verlengd' } as const;
const LOGIN = '/inloggen?next=%2Fstudio%2Fprivacy';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(value)) : 'Nog niet vastgelegd';
class PrivacyRequestError extends Error { constructor(readonly status: number, message: string) { super(message); } }
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10_000), ...options });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object') throw new PrivacyRequestError(response.status, response.status === 401 || response.status === 403 ? 'Je beheersessie is verlopen of je hebt geen toegang. Log opnieuw in als beheerder.' : result?.message || 'De privacyverzoeken zijn nu niet bereikbaar. Probeer het opnieuw.');
  return result as T;
}

type MutationAction = 'bind_subject' | 'verify' | 'extend' | 'execute_erasure' | 'complete' | 'decline';
export default function PrivacyAdminPage() {
  const [offset, setOffset] = useState(0);
  const [subjectParentId, setSubjectParentId] = useState('');
  const [subjectProfileId, setSubjectProfileId] = useState('');
  const [list, setList] = useState<PrivacyCasesResponse | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [reference, setReference] = useState('');
  const [kind, setKind] = useState<PrivacyRequestKind>('access');
  const [scope, setScope] = useState<'parent' | 'child'>('parent');
  const [parentId, setParentId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [receivedAt, setReceivedAt] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'verified_parent' | 'proportionate_support'>('verified_parent');
  const [extensionReason, setExtensionReason] = useState<keyof typeof PRIVACY_EXTENSION_REASONS>('complex_request');
  const [notified, setNotified] = useState(false);
  const [pendingAction, setPendingAction] = useState<MutationAction | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const generation = useRef(0);
  const identity = useAdminIdentity(() => {
    generation.current += 1;
    setList(null); setSelectedId(''); setOffset(0); setSubjectParentId(''); setSubjectProfileId('');
    setReference(''); setParentId(''); setProfileId(''); setReceivedAt(''); setKind('access'); setScope('parent');
    setQuery(''); setStateFilter('all'); setKindFilter('all'); setPendingAction(null); setConfirmed(false); setNotified(false);
    setVerificationMethod('verified_parent'); setExtensionReason('complex_request'); setBusy(false); setNotice(''); setProblem('');
  });
  const { session, checked, denied } = identity;
  const canManage = !!session?.parent && !!session.admin && !denied && (!session.lifecycle || session.lifecycle.state === 'active');
  const visibleCases = list?.cases.filter(item => (stateFilter === 'all' || (stateFilter === 'open' ? !['completed', 'declined'].includes(item.state) : item.state === stateFilter)) && (kindFilter === 'all' || item.kind === kindFilter) && item.reference.toLocaleLowerCase('nl-NL').includes(query.trim().toLocaleLowerCase('nl-NL'))) || [];
  const selected = visibleCases.find(item => item.id === selectedId);
  const closed = !!selected && ['completed', 'declined'].includes(selected.state);
  const erasure = !!selected && ['erasure', 'consent_withdrawal'].includes(selected.kind);
  const expired = !!selected && Date.parse(selected.extendedDueAt || selected.responseDueAt) < Date.now() && !closed;

  async function boundApi<T>(operation: AdminOperation, url: string, options?: RequestInit): Promise<T> {
    if (!identity.isCurrent(operation)) throw new Error('Superseded administration request');
    const headers = new Headers(options?.headers); headers.set('X-Fabelpad-Parent', operation.parentId);
    const result = await api<T>(url, { ...options, headers });
    if (!identity.isCurrent(operation)) throw new Error('Superseded administration request');
    return result;
  }
  function failure(error: unknown) {
    if (error instanceof PrivacyRequestError && (error.status === 401 || error.status === 403)) {
      identity.invalidate('Je beheersessie is verlopen of je hebt geen toegang. Log opnieuw in als beheerder.');
      return;
    }
    setProblem(error instanceof Error ? error.message : 'Dit lukt nu niet. Probeer het opnieuw.');
  }
  async function reload(operation: AdminOperation, select?: string, pageOffset = offset) {
    const current = ++generation.current;
    const next = await boundApi<PrivacyCasesResponse>(operation, `/api/admin/privacy?offset=${pageOffset}`);
    if (current !== generation.current || !identity.isCurrent(operation)) return;
    if (!Array.isArray(next.cases) || !Number.isSafeInteger(next.total) || typeof next.truncated !== 'boolean' || !(next.nextOffset === null || Number.isSafeInteger(next.nextOffset))) throw new Error('De privacyverzoeken hebben een ongeldig antwoord gegeven.');
    setList(next); setOffset(pageOffset); setSelectedId(id => next.cases.some(item => item.id === (select || id)) ? (select || id) : next.cases[0]?.id || '');
  }
  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => {
    const operation = identity.capture(); if (!canManage || !operation) return;
    setBusy(true);
    void reload(operation).catch(error => { if (identity.isCurrent(operation)) failure(error); }).finally(() => { if (identity.isCurrent(operation)) setBusy(false); });
  }, [canManage]);
  useEffect(() => { setPendingAction(null); setConfirmed(false); setNotified(false); }, [selectedId]);
  useEffect(() => { setSelectedId(current => visibleCases.some(item => item.id === current) ? current : visibleCases[0]?.id || ''); }, [list, query, stateFilter, kindFilter]);
  async function refresh() {
    const operation = identity.capture(); if (!operation || busy) return;
    setBusy(true); setProblem(''); setNotice('');
    try { await reload(operation); } catch (error) { if (identity.isCurrent(operation)) failure(error); } finally { if (identity.isCurrent(operation)) setBusy(false); }
  }
  async function changePage(pageOffset: number) {
    const operation = identity.capture(); if (!operation || busy) return;
    setBusy(true); setProblem(''); setNotice('');
    try { await reload(operation, undefined, pageOffset); } catch (error) { if (identity.isCurrent(operation)) failure(error); } finally { if (identity.isCurrent(operation)) setBusy(false); }
  }
  async function register(event: FormEvent) {
    event.preventDefault(); const operation = identity.capture(); if (!operation || !canManage || busy) return;
    const owner = parentId.trim(), child = profileId.trim();
    if (!/^[A-Za-z0-9_-]{6,80}$/u.test(reference.trim()) || owner && !UUID.test(owner) || scope === 'child' && child && !/^[A-Za-z0-9_-]{1,80}$/u.test(child)) { setProblem('Gebruik een dossierkenmerk van 6–80 letters, cijfers, _ of -, en geldige technische account- en profielnummers.'); return; }
    setBusy(true); setProblem(''); setNotice('');
    try {
      const body = { reference: reference.trim(), kind, scope, parentId: owner || null, profileId: scope === 'child' ? child || null : null, ...(receivedAt ? { receivedAt: new Date(receivedAt).toISOString() } : {}) };
      const result = await boundApi<{ id: string }>(operation, '/api/admin/privacy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': operation.parentId }, body: JSON.stringify(body) });
      await reload(operation, result.id, 0); if (!identity.isCurrent(operation)) return; setReference(''); setParentId(''); setProfileId(''); setReceivedAt(''); setNotice('De ontvangst en wettelijke antwoorddatum zijn geregistreerd. Bevestig de ontvangst afzonderlijk via de beveiligde supportmailbox.');
    } catch (error) { if (identity.isCurrent(operation)) failure(error); } finally { if (identity.isCurrent(operation)) setBusy(false); }
  }
  async function act(action: MutationAction) {
    const operation = identity.capture();
    if (!operation || !canManage || busy || !selected || !confirmed || action === 'extend' && !notified) return;
    if (action === 'bind_subject' && (!UUID.test(subjectParentId.trim()) || selected.scope === 'child' && !/^[A-Za-z0-9_-]{1,80}$/u.test(subjectProfileId.trim()))) { setProblem('Gebruik het technische accountnummer en, bij kindbereik, het bijbehorende profielnummer uit de bevoegde administratie.'); return; }
    setBusy(true); setProblem(''); setNotice('');
    try {
      const body = { action, ...(action === 'bind_subject' ? { parentId: subjectParentId.trim(), profileId: selected.scope === 'child' ? subjectProfileId.trim() : null } : {}), ...(action === 'verify' ? { verificationMethod } : {}), ...(action === 'extend' ? { extensionReason: PRIVACY_EXTENSION_REASONS[extensionReason], notificationConfirmed: true } : {}) };
      await boundApi(operation, `/api/admin/privacy/${encodeURIComponent(selected.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Fabelpad-Parent': operation.parentId }, body: JSON.stringify(body) });
      await reload(operation, selected.id); if (!identity.isCurrent(operation)) return; setPendingAction(null); setConfirmed(false); setNotified(false); setNotice(action === 'execute_erasure' ? 'De geverifieerde uitvoering is gestart of afgerond. Alleen de serverstatus bepaalt of alle vereiste stappen daadwerkelijk zijn voltooid.' : 'De zaakstatus is bijgewerkt. Deze pagina verstuurt geen e-mail; informeer de aanvrager via de beveiligde supportmailbox.');
    } catch (error) { if (identity.isCurrent(operation)) failure(error); } finally { if (identity.isCurrent(operation)) setBusy(false); }
  }
  function choose(action: MutationAction) { if (!identity.capture()) return; setPendingAction(action); setConfirmed(false); setNotified(false); if (action === 'bind_subject') { setSubjectParentId(''); setSubjectProfileId(selected?.profileId || ''); } }
  return <AdminShell><span className="admin-eyebrow">Zorgvuldig & beperkt</span><h1>Privacyverzoeken.</h1><p>Beheer de ontvangst, verificatie en uitvoering van AVG-verzoeken. Registreer alleen een dossierkenmerk en technische nummers; bewaar berichtinhoud en contactgegevens in de afgeschermde supportmailbox.</p>{!checked ? <p role="status">Beheerrechten controleren…</p> : !session?.configured ? <p className="notice">De privacybeheeromgeving is nog niet aangesloten.</p> : !session.parent || denied ? <p><a className="account-primary" href={LOGIN}>Inloggen als beheerder</a></p> : !canManage ? <p className="notice">Dit account heeft geen toegang tot de privacyverzoeken. Rond zo nodig eerst je ouderaccount af.</p> : <>
    <p className="notice">De openbare route <a href="/privacyverzoek">Privacyverzoek</a> werkt zonder ouderlogin, ook voor een kind van 12. Deze beheerpagina is geen gekoppelde inbox en verstuurt zelf geen e-mails. Een geldig wisverzoek heeft geen vaste wachttijd van 30 dagen.</p>
    <section className="family-settings"><h2>Ontvangst registreren</h2><form className="privacy-admin-form" onSubmit={register}><fieldset disabled={busy}><label>Dossierkenmerk<input value={reference} onChange={e => setReference(e.target.value)} required minLength={6} maxLength={80} placeholder="Bijvoorbeeld AVG_2026_0001" autoComplete="off" /></label><label>Soort verzoek<select value={kind} onChange={e => { const value = e.target.value as PrivacyRequestKind; setKind(value); if (value === 'consent_withdrawal') setScope('child'); }}>{Object.entries(PRIVACY_REQUEST_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Bereik<select value={scope} onChange={e => setScope(e.target.value as 'parent' | 'child')}><option value="parent" disabled={kind === 'consent_withdrawal'}>Het ouderaccount of eigen correspondentie</option><option value="child">Uitsluitend één kinderprofiel</option></select></label><label>Technisch ouderaccountnummer (optioneel)<input value={parentId} onChange={e => setParentId(e.target.value)} maxLength={36} autoComplete="off" placeholder="UUID, geen e-mailadres" /></label>{scope === 'child' && <label>Technisch profielnummer (optioneel)<input value={profileId} onChange={e => setProfileId(e.target.value)} maxLength={80} autoComplete="off" /></label>}<label>Werkelijke ontvangst in de mailbox (optioneel)<input type="datetime-local" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} /></label><p className="account-legal-note">Leeg laten gebruikt het huidige servermoment. Neem bij vertraagde registratie de werkelijke ontvangstdatum over. Een kalendermaand is niet hetzelfde als 30 dagen. Vermeld geen naam, mailadres of inhoud in het dossierkenmerk.</p><button className="account-primary" type="submit">Registreer ontvangst</button></fieldset></form></section>
    <section className="family-settings"><div className="privacy-admin-heading"><h2>Zaakoverzicht</h2><button className="account-secondary" disabled={busy} onClick={() => void refresh()}>Overzicht vernieuwen</button></div>{list?.truncated && <p role="alert" className="account-feedback">Er zijn {list.total} zaken; per pagina zie je maximaal 100, met open zaken eerst. Gebruik de paginaknoppen voor de overige zaken. Een ontbrekende zaak is niet automatisch afgerond.</p>}{list && <div className="account-actions" aria-label="Zaakpagina’s"><button className="account-secondary" disabled={busy || offset === 0} onClick={() => void changePage(Math.max(0, offset - 100))}>Vorige pagina</button><span>{list.total ? `${offset + 1}–${offset + list.cases.length} van ${list.total}` : '0 zaken'}</span><button className="account-secondary" disabled={busy || list.nextOffset === null || list.nextOffset > 100000} onClick={() => list.nextOffset !== null && void changePage(list.nextOffset)}>Volgende pagina</button></div>}{list && !list.cases.length ? <p>Er zijn nog geen privacyverzoeken geregistreerd.</p> : !list ? <p role="status">Verzoeken ophalen…</p> : <><div className="admin-filter-bar"><label>Zoek dossierkenmerk op deze pagina<input type="search" value={query} maxLength={80} autoComplete="off" onChange={event => setQuery(event.target.value)} /></label><label>Zaakstatus op deze pagina<select value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="all">Alle statussen</option><option value="open">Open zaken</option>{Object.entries(STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Verzoeksoort op deze pagina<select value={kindFilter} onChange={event => setKindFilter(event.target.value)}><option value="all">Alle soorten</option>{Object.entries(PRIVACY_REQUEST_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="admin-case-summary"><span>{visibleCases.length} van {list.cases.length} zaken op deze pagina zichtbaar</span>{(query || stateFilter !== 'all' || kindFilter !== 'all') && <button type="button" className="account-secondary" onClick={() => { setQuery(''); setStateFilter('all'); setKindFilter('all'); }}>Filters wissen</button>}</div>{!visibleCases.length && <p role="status">Geen zaken binnen deze filters. Wis de filters of bekijk een andere pagina; een ontbrekende zaak is niet automatisch afgerond.</p>}<label>Privacyverzoek<select disabled={busy} value={selectedId} onChange={e => setSelectedId(e.target.value)}>{visibleCases.map(item => <option key={item.id} value={item.id}>{item.reference} · {STATES[item.state]} · {date(item.extendedDueAt || item.responseDueAt)}</option>)}</select></label>{selected && <article className="privacy-admin-case"><h3>{selected.reference}</h3><dl><dt>Status</dt><dd>{STATES[selected.state]}</dd><dt>Soort</dt><dd>{PRIVACY_REQUEST_KINDS[selected.kind]}</dd><dt>Bereik</dt><dd>{selected.scope === 'child' ? 'Uitsluitend dit kinderprofiel; andere gezinsleden blijven bestaan' : 'Ouderaccount / eigen gegevens'}</dd><dt>Ontvangen</dt><dd>{date(selected.receivedAt)}</dd><dt>Antwoorddeadline</dt><dd><strong>{date(selected.extendedDueAt || selected.responseDueAt)}</strong>{expired && <span className="privacy-admin-overdue"> — termijn verstreken; direct opvolgen</span>}</dd><dt>Accountnummer</dt><dd><code>{selected.parentId || 'Nog niet gekoppeld of na verwijdering losgekoppeld'}</code></dd>{selected.scope === 'child' && <><dt>Profielnummer</dt><dd><code>{selected.profileId || 'Nog niet gekoppeld'}</code></dd></>}<dt>Verificatie</dt><dd>{selected.verification === 'verified' ? 'Proportioneel geverifieerd' : selected.verification === 'declined' ? 'Niet bevestigd' : 'Nog te verifiëren'}</dd>{selected.completedAt && <><dt>Afgerond</dt><dd>{date(selected.completedAt)}</dd></>}{selected.extensionReason && <><dt>Reden verlenging</dt><dd>{selected.extensionReason}</dd></>}</dl>{!closed && <div className="account-actions">{!selected.parentId && selected.verification === 'pending' && <button className="account-secondary" disabled={busy} onClick={() => choose('bind_subject')}>Betrokkene veilig koppelen</button>}{selected.verification !== 'verified' && <button className="account-secondary" disabled={busy || !selected.parentId} onClick={() => choose('verify')}>Verificatie vastleggen</button>}{selected.verification === 'verified' && erasure && selected.state !== 'executing' && <button className="account-secondary account-danger" disabled={busy} onClick={() => choose('execute_erasure')}>Gegevenswissing uitvoeren</button>}{selected.verification === 'verified' && !erasure && <button className="account-secondary" disabled={busy} onClick={() => choose('complete')}>Afhandeling vastleggen</button>}{!selected.extendedDueAt && <button className="account-secondary" disabled={busy || Date.parse(selected.responseDueAt) < Date.now()} onClick={() => choose('extend')}>Termijn gemotiveerd verlengen</button>}<button className="account-secondary" disabled={busy} onClick={() => choose('decline')}>Afwijzing vastleggen</button></div>}{selected.state === 'executing' && <p role="status">De wistaak loopt. De server rondt deze zaak pas af nadat de vereiste providerstappen met bewijs zijn voltooid. Gebruik Overzicht vernieuwen om de actuele status te bekijken.</p>}{!selected.parentId && !closed && <p>Voor verificatie moet een bevoegde medewerker dit verzoek eerst aan het juiste technische account koppelen. Doe geen aannames over het hele gezin bij een verzoek van één kind.</p>}
    {pendingAction && <section className="privacy-admin-confirm" aria-labelledby="privacy-action-title"><h3 id="privacy-action-title">Deze zaakhandeling bevestigen</h3>{pendingAction === 'bind_subject' && <><p>Zoek de juiste technische nummers in de bevoegde administratie. Het eerder gekozen ouder- of kindbereik blijft vast; koppelen is nog geen verificatie van de aanvrager.</p><label>Te koppelen ouderaccountnummer<input value={subjectParentId} onChange={e => setSubjectParentId(e.target.value)} maxLength={36} autoComplete="off" placeholder="UUID, geen e-mailadres" /></label>{selected.scope === 'child' && <label>Te koppelen profielnummer<input value={subjectProfileId} onChange={e => setSubjectProfileId(e.target.value)} maxLength={80} autoComplete="off" /></label>}</>}{pendingAction === 'verify' && <label>Verificatiemethode<select value={verificationMethod} onChange={e => setVerificationMethod(e.target.value as typeof verificationMethod)}><option value="verified_parent">Bevestigde ouder via beveiligde route</option><option value="proportionate_support">Proportionele servicedeskcontrole, ook voor een eigen 12+-verzoek</option></select></label>}{pendingAction === 'extend' && <><label>Reden voor verlenging<select value={extensionReason} onChange={e => setExtensionReason(e.target.value as typeof extensionReason)}>{Object.entries(PRIVACY_EXTENSION_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="account-check"><input type="checkbox" checked={notified} onChange={e => setNotified(e.target.checked)} /><span>Ik heb de aanvrager binnen de eerste kalendermaand geïnformeerd over deze reden en de nieuwe termijn.</span></label></>}{pendingAction === 'execute_erasure' && <p><strong>{selected.scope === 'child' ? 'Dit wist uitsluitend het genoemde kinderprofiel en de leesgegevens daarvan.' : 'Dit start het definitief wissen van het volledige online gezin zonder de vrijwillige hersteltermijn van 30 dagen.'}</strong> Deze handeling is voor een geverifieerd geldig AVG-verzoek. Informeer de aanvrager over eventuele beperkte wettelijke bewaarexcepties.</p>}{pendingAction === 'decline' && <p>Leg een wettelijke motivering en de communicatie daarover vast in de beveiligde supportzaak. Deze pagina bewaart geen vrije berichttekst. Een afwijzing is geen bewijs dat gegevens zijn gewist.</p>}<label className="account-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>Ik heb de juiste aanvrager, het bereik en de vereiste afhandeling gecontroleerd en bevestig deze handeling.</span></label><div className="account-actions"><button className="account-secondary" disabled={busy} onClick={() => { setPendingAction(null); setConfirmed(false); }}>Annuleren</button><button className="account-primary" disabled={busy || !confirmed || pendingAction === 'extend' && !notified || pendingAction === 'bind_subject' && (!UUID.test(subjectParentId.trim()) || selected.scope === 'child' && !/^[A-Za-z0-9_-]{1,80}$/u.test(subjectProfileId.trim()))} onClick={() => void act(pendingAction)}>Bevestig zaakhandeling</button></div></section>}</article>}</>}</section>
  </>}{notice && <p className="account-feedback" role="status">{notice}</p>}{(problem || identity.error) && <p className="account-feedback" role="alert">{problem || identity.error}</p>}</AdminShell>;
}
