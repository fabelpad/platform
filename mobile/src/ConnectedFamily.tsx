import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { Store, Scene, Ending } from './types';
import type { BillingPeriod } from '../../lib/billing/types';
import type { FamilySnapshot } from '../../lib/familyValidation';
import { effectiveReadingLevel } from './readingLevels';
import { personalizeStoryText } from '../../src/storyPersonalization';
import { cloneConnectedFamily } from './connected-contract';
import { cacheConnectedRelease, cachedConnectedRelease, clearConnectedProgress, clearProtectedContent, connectedConfig, ConnectedError, connectedRequest, connectedRequestId, disconnectFamily, familySession, flushConnectedProgress, importLocalProfiles, loadConnectedAccount, loadConnectedFamily, loadConnectedRelease, loadPlayTrialOffers, loadPlayLicenseProofOffers, purchasePlayLicenseProofOffer, purchasePlayOffer, purchasePlayTrialOffer, queryConfiguredPlayOffers, readConnectedProgress, resolveConnectedProgress, restorePlayLicenseProof, restorePlayPurchases, saveConnectedProgress, sendParentCode, verifyParentCode, type ConnectedFamilyState, type PlayOffer } from './connected';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const message = (error: unknown) => error instanceof Error ? error.message : 'De gezinsomgeving is tijdelijk niet bereikbaar.';
function Action({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: 0.4 }]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return <View style={s.check}><Switch value={checked} onValueChange={onChange} accessibilityLabel={label} /><Text style={s.body}>{label}</Text></View>;
}
type Account = Awaited<ReturnType<typeof loadConnectedAccount>>;
export function ConnectedParentArea({ store }: { store: Store }) {
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [sent, setSent] = useState(false);
  const [account, setAccount] = useState<Account | null>(null), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]), [consent, setConsent] = useState(false);
  const [offers, setOffers] = useState<PlayOffer[]>([]), [trialOffers, setTrialOffers] = useState<PlayOffer[]>([]), [proofOffers, setProofOffers] = useState<Awaited<ReturnType<typeof loadPlayLicenseProofOffers>>>(null);
  const [chosen, setChosen] = useState<{ offer: PlayOffer; period: BillingPeriod; quote: Record<string, unknown>; trial: boolean; proofRevision?: number } | null>(null), [licenseTester, setLicenseTester] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false), [acceptRecurring, setAcceptRecurring] = useState(false), [parentDeclaration, setParentDeclaration] = useState(false);
  const active = useRef(true);
  async function run(action: () => Promise<void>) { setBusy(true); setStatus(''); try { await action(); } catch (error) { if (active.current) setStatus(message(error)); } finally { if (active.current) setBusy(false); } }
  async function refresh() {
    const next = await loadConnectedAccount(); if (!active.current) return; setAccount(next);
    const offer = record(next.billing.offer) ? next.billing.offer : {};
    const play = record(offer.play) ? offer.play : record(offer.settings) && record(offer.settings.play) ? offer.settings.play : {};
    const gate = record(offer.gates) && record(offer.gates.playEnabled) ? offer.gates.playEnabled : {};
    if (play.effective === true || gate.effective === true) {
      setOffers(record(offer.prices) ? await queryConfiguredPlayOffers(play, offer.prices) : []);
    } else setOffers([]);
    setTrialOffers(await loadPlayTrialOffers());
    setProofOffers(await loadPlayLicenseProofOffers());
  }
  useEffect(() => {
    active.current = true;
    void familySession().then(value => { if (value) return refresh(); }).catch(error => setStatus(message(error)));
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void familySession().then(value => { if (value) return refresh(); }).catch(error => setStatus(message(error))); });
    return () => { active.current = false; listener.remove(); };
  }, []);
  function open(path: string) { void Linking.openURL(`${connectedConfig.origin}${path}`).catch(() => setStatus('Deze pagina kon niet worden geopend.')); }
  const lifecycle = account?.lifecycle, entitlement = record(account?.billing.entitlement) ? account!.billing.entitlement : {};
  const subscriptions = Array.isArray(account?.billing.subscriptions) ? account!.billing.subscriptions.filter(record) : [];
  return <View style={s.card}>
    <Text style={s.heading}>Je gezin verbinden</Text>
    <Text style={s.body}>De dertien meegeleverde verhalen en je lokale profielen blijven op dit apparaat beschikbaar. Met een geverifieerd ouderaccount kun je daarnaast de online gezinsbibliotheek gebruiken.</Text>
    {!account ? <>
      <TextInput accessibilityLabel="E-mailadres van de ouder" autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} placeholder="E-mailadres" style={s.input} />
      <Action label="Stuur mijn inlogcode" disabled={busy || !email.trim()} onPress={() => void run(async () => { await sendParentCode(email); setSent(true); setStatus('Als dit bestaande ouderaccount beschikbaar is, ontvang je een code via e-mail.'); })} />
      {sent && <><TextInput accessibilityLabel="Zescijferige inlogcode" keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={setCode} style={s.input} /><Action label="Inloggen als ouder" disabled={busy || code.length !== 6} onPress={() => void run(async () => { await verifyParentCode(email, code); setCode(''); await refresh(); })} /></>}
      <Action label="Nieuw ouderaccount maken" disabled={busy} onPress={() => open('/inloggen?intent=register')} />
      <Text style={s.small}>Je registreert op de beveiligde Fabelpad-website. Bevestig je e-mailadres en de ouderonboarding; daarna kun je hier inloggen. Kinderen hebben geen eigen e-mailadres nodig.</Text>
    </> : <>
      <Text style={s.body}>Aangemeld als {account.session.email}.</Text>
      {lifecycle?.state === 'active' && lifecycle.acceptedTermsVersion === lifecycle.termsVersion ? <>
        <Text style={s.heading}>Gezinstoegang</Text>
        <Text style={s.body}>{entitlement.fullLibrary === true ? 'Je gezin heeft toegang tot de volledige online bibliotheek.' : 'Je gezin gebruikt Fabelpad Ontdek met een volledig verhaal en twee voorproefjes.'}{typeof entitlement.validUntil === 'string' ? ` Geldig tot ${new Date(entitlement.validUntil).toLocaleDateString('nl-NL')}.` : ''}</Text>
        <Action label="Gezinsstatus opnieuw controleren" disabled={busy} onPress={() => void run(refresh)} />
        <Text style={s.heading}>Lokale kinderprofielen importeren</Text>
        <Text style={s.body}>Kies zelf welke profielen, geboortedata en leesvoortgang online worden opgeslagen en gedeeld binnen je gezin. De lokale gegevens worden bewaard. Bestaande gezinsprofielen worden niet overschreven.</Text>
        {store.profiles.filter(profile => profile.isPersonal !== false).map(profile => <Check key={profile.id} label={`${profile.name}${profile.birthDate ? '' : ' · voeg eerst lokaal een geboortedatum toe'}`} checked={selected.includes(profile.id)} onChange={checked => { setSelected(value => checked ? [...value, profile.id] : value.filter(id => id !== profile.id)); setConsent(false); }} />)}
        <Check label="Ik ben de ouder of wettelijke verzorger en geef afzonderlijk toestemming voor de online opslag van ieder gekozen kinderprofiel." checked={consent} onChange={setConsent} />
        <Action label="Gekozen profielen importeren" disabled={busy || !consent || !selected.length} onPress={() => void run(async () => { await importLocalProfiles(store, selected, consent); setSelected([]); setConsent(false); setStatus('De gekozen profielen zijn nu beschikbaar in de gezinsbibliotheek.'); })} />
        <Text style={s.heading}>Abonnement via Google Play</Text>
        {entitlement.activePaidContract === true ? <Text style={s.body}>Je gezin heeft al een betaald abonnement. Je bestaande gezinstoegang werkt ook in deze app.</Text> : offers.length ? <>
          {offers.map(offer => <Action key={`${offer.productId}:${offer.basePlanId}`} disabled={busy} label={`${offer.billingPeriod === 'P1Y' ? 'Jaar' : 'Maand'} bekijken · ${offer.formattedPrice}`} onPress={() => void run(async () => {
            const period: BillingPeriod = offer.billingPeriod === 'P1Y' ? 'year' : 'month';
            const quote = await connectedRequest('/api/billing/quote', { period });
            setChosen({ offer, period, quote, trial: false }); setAcceptTerms(false); setAcceptRecurring(false);
          })} />)}
        </> : <Text style={s.body}>Nieuwe abonnementen tijdelijk niet beschikbaar.</Text>}
        {trialOffers.length > 0 && <View style={s.agreement}>
          <Text style={s.heading}>Google Play-licentietest voor beheer</Text>
          <Text style={s.body}>Alleen voor je stagingbeheeraccount en een door Google ingestelde licentietester. Deze afzonderlijke proef controleert aankoop, serverbevestiging en herstel terwijl de betaalschakelaars uit blijven. Controleer in het Google-scherm dat je een testbetaalmiddel gebruikt; een echte aankoop wordt door staging geweigerd en geeft geen gezinsrecht.</Text>
          {trialOffers.map(offer => <Action key={`trial:${offer.productId}:${offer.basePlanId}`} disabled={busy} label={`Beheertest ${offer.billingPeriod === 'P1Y' ? 'jaar' : 'maand'} bekijken · ${offer.formattedPrice}`} onPress={() => void run(async () => {
            const period: BillingPeriod = offer.billingPeriod === 'P1Y' ? 'year' : 'month';
            const quote = await connectedRequest('/api/billing/quote', { period });
            setChosen({ offer, period, quote, trial: true }); setAcceptTerms(false); setAcceptRecurring(false);
          })} />)}
        </View>}
        {!!proofOffers?.offers.length && <View style={s.agreement}>
          <Text style={s.heading}>Play-licentietest voor beheer</Text>
          <Text style={s.body}>Deze afgeschermde proef controleert de productieverbinding met een Google Play-testbetaling. Er wordt geen betaald gezinsrecht of financieel aankooprecord aangemaakt en de betaalschakelaars blijven ongewijzigd. Controleer in het Google-scherm dat een testbetaalmiddel wordt getoond. Stop als Google een echte betaling vraagt.</Text>
          <Check label="Ik gebruik een door Google Play geautoriseerd licentietestaccount en controleer het testbetaalmiddel voordat ik bevestig." checked={licenseTester} onChange={setLicenseTester} />
          {proofOffers.offers.map(offer => <Action key={`proof:${offer.productId}:${offer.basePlanId}`} disabled={busy || !licenseTester} label={`Licentietest ${offer.billingPeriod === 'P1Y' ? 'jaar' : 'maand'} bekijken · ${offer.formattedPrice}`} onPress={() => void run(async () => {
            const period: BillingPeriod = offer.billingPeriod === 'P1Y' ? 'year' : 'month', quote = await connectedRequest('/api/billing/quote', { period });
            setChosen({ offer, period, quote, trial: false, proofRevision: proofOffers.credentialRevision }); setAcceptTerms(false); setAcceptRecurring(false);
          })} />)}
          <Action label="Eerdere Play-licentietest controleren" disabled={busy || !licenseTester} onPress={() => void run(async () => { const confirmed = await restorePlayLicenseProof(proofOffers.credentialRevision, licenseTester); await refresh(); setStatus(confirmed ? 'De sandboxaankoop en serverbevestiging zijn als beheerbewijs opgeslagen. Er is geen gezinsrecht toegekend.' : 'Geen geldige, aan dit beheeraccount gekoppelde sandboxaankoop gevonden.'); })} />
        </View>}
        {chosen && <View style={s.agreement}>
            <Text style={s.heading}>{chosen.proofRevision ? 'Bevestig je sandboxlicentietest' : chosen.trial ? 'Bevestig je Play-beheertest' : 'Fabelpad Gezin'}</Text><Text style={s.body}>{chosen.offer.formattedPrice} per {chosen.period === 'year' ? 'jaar' : 'maand'}, inclusief toepasselijke belastingen. {chosen.proofRevision ? 'Deze beheerproef verleent geen gezinsrecht. Google moet je geautoriseerde testbetaalmiddel tonen; testabonnementen kunnen versneld vernieuwen tot je ze in Google Play stopt.' : 'Je krijgt de volledige online bibliotheek voor maximaal vijf kinderprofielen. Google Play verlengt automatisch tot je opzegt. Je houdt toegang tot het einde van de betaalde periode.'}{chosen.trial ? ' Deze stagingproef moet in Google Play als testbetaling worden getoond en opent geen productieabonnement.' : ''}</Text>
            <Action label="Lees de abonnementsvoorwaarden" onPress={() => open('/algemene-voorwaarden')} />
            <Check label="Ik heb de getoonde voorwaarden gelezen en ga ermee akkoord." checked={acceptTerms} onChange={setAcceptTerms} />
            <Check label="Ik geef toestemming voor automatische verlenging en afschrijving via Google Play." checked={acceptRecurring} onChange={setAcceptRecurring} />
            <Action label={`${chosen.proofRevision || chosen.trial ? 'Start bevestigde licentietest' : 'Abonneren'} voor ${chosen.offer.formattedPrice} per ${chosen.period === 'year' ? 'jaar' : 'maand'}`} disabled={busy || !acceptTerms || !acceptRecurring || !!chosen.proofRevision && !licenseTester} onPress={() => void run(async () => {
              const amount = Number(chosen.offer.priceAmountMicros) / 10_000;
              const quoted = Number(chosen.quote.amountCents);
              if (!Number.isSafeInteger(amount) || amount !== quoted) throw new ConnectedError('price_changed', 'De prijs in Google Play wijkt af van het actuele aanbod. De aankoop is niet gestart.');
              const agreement = { expectedRevision: Number(chosen.quote.settingsRevision ?? chosen.quote.revision), expectedAmountCents: quoted, termsVersion: String(chosen.quote.termsVersion), acceptTerms: true as const, acceptRecurring: true as const };
              if (chosen.proofRevision) {
                const outcome = await purchasePlayLicenseProofOffer(chosen.offer, chosen.period, chosen.proofRevision, agreement, licenseTester);
                setChosen(null); await refresh(); setStatus(outcome.confirmed ? 'De sandboxaankoop is bij Google gecontroleerd en bevestigd als beheerbewijs. Er is geen gezinsrecht toegekend.' : outcome.pending ? 'Google verwerkt de sandboxbetaling nog. Gebruik Eerdere Play-licentietest controleren om later opnieuw te controleren.' : 'De licentietest is geannuleerd; er is geen aankoopbewijs opgeslagen.'); return;
              }
              const outcome = await (chosen.trial ? purchasePlayTrialOffer : purchasePlayOffer)(chosen.offer, chosen.period, agreement);
              setChosen(null); await refresh(); setStatus(outcome.cancelled ? 'De aankoop is geannuleerd. Er is geen nieuw gezinsrecht toegekend.' : outcome.pending ? 'Google Play verwerkt de betaling nog. Je krijgt pas toegang nadat de aankoop op de server is bevestigd. Gebruik Aankopen herstellen om opnieuw te controleren.' : 'De aankoopstatus is bij Google gecontroleerd. Je actuele gezinsrecht staat hierboven.');
            })} />
        </View>}
        <Action label="Google Play-aankopen herstellen" disabled={busy} onPress={() => void run(async () => { const count = await restorePlayPurchases(); await refresh(); setStatus(`${count} aankoop${count === 1 ? '' : 'en'} bij Google gecontroleerd.`); })} />
        {subscriptions.map(subscription => <View key={String(subscription.id)} style={s.agreement}><Text style={s.body}>{subscription.provider === 'play' ? 'Google Play' : 'Gezinsabonnement'} · {String(subscription.state ?? subscription.status ?? '')}{typeof subscription.periodEnd === 'string' || typeof subscription.paidUntil === 'string' ? ` · betaald tot ${new Date(String(subscription.periodEnd ?? subscription.paidUntil)).toLocaleDateString('nl-NL')}` : ''}</Text>{subscription.autoRenew === true && <Action label="Automatische verlenging stoppen" disabled={busy} onPress={() => Alert.alert('Abonnement opzeggen?', 'De provider stopt toekomstige verlengingen. Je houdt toegang voor de al betaalde periode.', [{ text: 'Terug', style: 'cancel' }, { text: 'Verlenging stoppen', onPress: () => void run(async () => { await connectedRequest('/api/billing/cancel', { subscriptionId: subscription.id, requestId: await connectedRequestId() }); await refresh(); setStatus('Je opzegging wordt bij de provider verwerkt. Alleen een bevestigde verlengstop wordt als gestopt getoond.'); }) }])} />}</View>)}
      </> : lifecycle?.state === 'onboarding' || lifecycle?.state === 'active' ? <>
        <Text style={s.body}>Bevestig eerst de actuele ouderonboarding voor je online gezinsgegevens gebruikt.</Text>
        <Action label="Lees de algemene voorwaarden" onPress={() => open('/algemene-voorwaarden')} /><Action label="Lees de privacyinformatie" onPress={() => open('/privacy')} />
        <Check label="Ik ben volwassen en handel als ouder of wettelijke verzorger." checked={parentDeclaration} onChange={setParentDeclaration} />
        <Check label="Ik ga akkoord met de actuele algemene voorwaarden." checked={acceptTerms} onChange={setAcceptTerms} />
        <Action label="Ouderonboarding afronden" disabled={busy || !parentDeclaration || !acceptTerms} onPress={() => void run(async () => { await connectedRequest('/api/parent/onboarding', { termsVersion: lifecycle.termsVersion, privacyVersion: lifecycle.privacyVersion, parentDeclaration: true, acceptTerms: true }); await refresh(); })} />
      </> : <Text style={s.body}>Je account wordt verwijderd. Online gezinsgegevens zijn afgeschermd. Herstel via je accountoverzicht binnen de geldende hersteltermijn.</Text>}
      <Action label="Ouderaccount verwijderen of herstellen" onPress={() => open('/account-verwijderen')} />
      <Action label="Uitloggen en downloads en ongedeelde voortgang wissen" disabled={busy} onPress={() => void run(async () => { await disconnectFamily(); setAccount(null); setOffers([]); setTrialOffers([]); setProofOffers(null); setChosen(null); setLicenseTester(false); setStatus('Uitgelogd. Afgeschermde downloads en nog niet gedeelde gezinsvoortgang zijn gewist. Je lokale profielen en dertien verhalen blijven beschikbaar.'); })} />
    </>}
    {busy && <ActivityIndicator color="#24543e" />}{!!status && <Text accessibilityLiveRegion="polite" style={s.status}>{status}</Text>}
    <Text style={s.small}>Omgeving: {connectedConfig.environment === 'production' ? 'productie' : 'stagingtest'}. Betalen gebeurt uitsluitend in dit ouderhoekje via Google Play.</Text>
  </View>;
}

type OnlineRelease = { storyId: string; contentVersion: string; metadata: { title: string }; scenes: Record<string, Scene>; endings: Record<string, Ending>; readingLevels?: Record<string, { scenes: Record<string, Scene>; endings: Record<string, Ending> }> };
export function ConnectedLibrary({ onClose }: { onClose(): void }) {
  const [catalog, setCatalog] = useState<Array<Record<string, unknown>>>([]), [family, setFamily] = useState<FamilySnapshot | null>(null), [revision, setRevision] = useState(0);
  const [childId, setChildId] = useState(''), [release, setRelease] = useState<OnlineRelease | null>(null), [picks, setPicks] = useState<number[]>([]);
  const [releaseExpiresAt, setReleaseExpiresAt] = useState(0);
  const [progressPending, setProgressPending] = useState(false), [progressConflict, setProgressConflict] = useState(false);
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const live = useRef(true), write = useRef(false), selectedChild = useRef(childId);
  selectedChild.current = childId;
  function applyFamilyState(stored: ConnectedFamilyState) {
    setFamily(stored.snapshot); setRevision(stored.revision); setProgressPending(stored.pending); setProgressConflict(stored.conflict);
  }
  useEffect(() => {
    if (!release) return;
    const timer = setTimeout(() => {
      setRelease(null); void clearProtectedContent(); setStatus('De laatst bevestigde geldigheid van dit online verhaal is afgelopen. Maak verbinding en open het verhaal opnieuw om je gezinsrecht te controleren.');
    }, Math.max(0, Math.min(24 * 60 * 60_000, releaseExpiresAt - Date.now())));
    return () => clearTimeout(timer);
  }, [release, releaseExpiresAt]);
  async function refresh() {
    setBusy(true); setStatus('');
    try {
      const account = await loadConnectedAccount();
      if (account.lifecycle.state !== 'active' || account.lifecycle.acceptedTermsVersion !== account.lifecycle.termsVersion) { setRelease(null); setFamily(null); setCatalog([]); setStatus('Rond eerst de actuele ouderonboarding af in het ouderhoekje. Je beveiligde leesvoortgang blijft bewaard.'); return; }
      const [listed, stored] = await Promise.all([connectedRequest('/api/content'), loadConnectedFamily()]);
      if (!live.current) return;
      setCatalog(Array.isArray(listed.stories) ? listed.stories.filter(record) : []); applyFamilyState(stored);
      if (record(stored.snapshot) && record(stored.snapshot.family)) setChildId(String(stored.snapshot.family.activeId));
      if (typeof listed.offlineUntil === 'string') await cacheConnectedRelease('_catalog', { release: { listed, stored }, offlineUntil: listed.offlineUntil });
    } catch (error) {
      if (error instanceof ConnectedError && error.status) { setRelease(null); setFamily(null); setCatalog([]); setStatus(message(error)); }
      else {
        const cached = await cachedConnectedRelease('_catalog').catch(() => null);
        if (cached && record(cached.release) && record(cached.release.listed) && record(cached.release.stored)) {
          const { listed, stored } = cached.release;
          const draft = await readConnectedProgress();
          setCatalog(Array.isArray(listed.stories) ? listed.stories.filter(record) : []);
          if (draft) applyFamilyState(draft); else { setFamily(stored.snapshot as FamilySnapshot | null); setRevision(Number(stored.revision ?? 0)); }
          if (draft?.snapshot) setChildId(draft.snapshot.family.activeId); else if (record(stored.snapshot) && record(stored.snapshot.family)) setChildId(String(stored.snapshot.family.activeId));
          setStatus('Je leest gedownloade verhalen binnen de laatst bevestigde offline geldigheid.');
        } else setStatus('Verbind je gezin in het ouderhoekje en maak verbinding om de online bibliotheek te openen. De meegeleverde verhalen blijven beschikbaar.');
      }
    } finally { if (live.current) setBusy(false); }
  }
  useEffect(() => {
    live.current = true; void refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void loadConnectedAccount().then(value => {
        const entitlement = record(value.billing.entitlement) ? value.billing.entitlement : {};
        const childConsent = value.lifecycle.consents.find(consent => consent.profileId === selectedChild.current);
        if (value.lifecycle.state !== 'active' || value.lifecycle.acceptedTermsVersion !== value.lifecycle.termsVersion || entitlement.fullLibrary !== true || selectedChild.current && (!childConsent || childConsent.withdrawnAt)) {
          setRelease(null); void clearProtectedContent(); setStatus('Je gezinstoegang is opnieuw gecontroleerd. Open een beschikbaar verhaal vanuit de bibliotheek.');
        }
        if (value.lifecycle.state !== 'active' || selectedChild.current && (!childConsent || childConsent.withdrawnAt)) void clearConnectedProgress();
        else if (value.lifecycle.acceptedTermsVersion === value.lifecycle.termsVersion && !write.current) void flushConnectedProgress().then(stored => { if (stored && live.current) applyFamilyState(stored); }).catch(error => setStatus(message(error)));
      }).catch(error => {
        if (error instanceof ConnectedError && error.status) { setRelease(null); setFamily(null); setCatalog([]); setStatus(message(error)); }
      });
    });
    return () => { live.current = false; listener.remove(); };
  }, []);
  const child = family?.family.children.find(value => value.id === childId), level = effectiveReadingLevel(child);
  const reading = release?.readingLevels?.[level] ?? release;
  const passage = picks.length === 5 ? reading?.endings[picks.join('')] : reading?.scenes[picks.join('')];
  async function open(story: Record<string, unknown>) {
    if (!child) { setStatus('Kies eerst een gekoppeld kinderprofiel. Je ouder kan dit in het ouderhoekje importeren.'); return; }
    setBusy(true); setStatus('');
    try {
      const saved = family?.data[child.id]?.[`story-${story.storyId}`];
      const progress = record(saved) ? saved : {};
      const result = await loadConnectedRelease(String(story.storyId), typeof progress.contentVersion === 'string' ? progress.contentVersion : String(story.contentVersion));
      if (!record(result.release) || !record(result.release.scenes) || !record(result.release.endings) || !record(result.release.metadata)) throw new Error('Dit verhaal kon niet worden geopend.');
      const expiry = Date.parse(String(result.offlineUntil ?? ''));
      if (Number.isFinite(expiry) && expiry <= Date.now()) throw new ConnectedError('entitlement_expired', 'Je gezinsrecht moet opnieuw online worden gecontroleerd.');
      setReleaseExpiresAt(Number.isFinite(expiry) ? Math.min(expiry, Date.now() + 24 * 60 * 60_000) : Date.now() + 5 * 60_000);
      setRelease(result.release as unknown as OnlineRelease); setPicks(Array.isArray(progress.picks) ? progress.picks.filter((pick): pick is number => pick === 0 || pick === 1).slice(0, 5) : []);
    } catch (error) { setStatus(message(error)); } finally { setBusy(false); }
  }
  async function choose(index: number) {
    if (!family || !child || !release || write.current) return;
    const nextPicks = [...picks, index]; if (nextPicks.length > 5) return;
    const next = cloneConnectedFamily(family); next.data[child.id] ||= {};
    const previous = next.data[child.id][`story-${release.storyId}`];
    next.data[child.id][`story-${release.storyId}`] = { ...(record(previous) ? previous : {}), picks: nextPicks, updatedAt: Date.now(), storyId: release.storyId, contentVersion: release.contentVersion,
      ...(nextPicks.length === 5 ? { lastCompletedPicks: nextPicks, lastCompletedContentVersion: release.contentVersion } : {}) };
    write.current = true; setBusy(true);
    try {
      const saved = await saveConnectedProgress(revision, family, next);
      applyFamilyState(saved); setPicks(nextPicks);
      if (saved.pending) setStatus(saved.conflict ? 'De online leesroute is ook gewijzigd. Je offline voortgang blijft beveiligd bewaard tot je hieronder een keuze maakt.' : 'Je leesvoortgang is beveiligd op dit apparaat bewaard en wordt bij verbinding gedeeld met je gezin.');
    } catch (error) {
      if (error instanceof ConnectedError && [401,403,410].includes(error.status)) { setRelease(null); setFamily(null); setCatalog([]); setStatus(message(error)); }
      else setStatus(`${message(error)} De laatst bevestigde route blijft zichtbaar; een niet-bewaarde keuze wordt niet stilzwijgend toegepast.`);
    }
    finally { write.current = false; setBusy(false); }
  }
  return <ScrollView contentContainerStyle={s.library}>
    <Action label={release ? 'Terug naar de gezinsbibliotheek' : 'Terug naar de meegeleverde verhalen'} onPress={() => release ? setRelease(null) : onClose()} />
    <Text accessibilityRole="header" style={s.heading}>{release?.metadata.title ?? 'Je gezinsbibliotheek'}</Text>
    {progressConflict && <View style={s.agreement}><Text style={s.body}>Dit gezin heeft online dezelfde leesroute gewijzigd. Je offline kopie is bewaard. Kies bewust welke route je verder wilt gebruiken; andere profielen en instellingen blijven volgens de online gegevens.</Text>
      <Action label="Mijn offline leesroutes gebruiken" disabled={busy} onPress={() => Alert.alert('Offline leesroutes delen?', 'Alleen de verhalen die je offline hebt gelezen vervangen hun online route. Andere gezinsgegevens blijven bewaard.', [{ text: 'Terug', style: 'cancel' }, { text: 'Offline routes gebruiken', onPress: () => { setBusy(true); void resolveConnectedProgress(true).then(stored => { applyFamilyState(stored); setRelease(null); }).catch(error => setStatus(message(error))).finally(() => setBusy(false)); } }])} />
      <Action label="Online leesroutes gebruiken" disabled={busy} onPress={() => Alert.alert('Online leesroutes gebruiken?', 'Je kiest de online route. Daarmee vervang je bewust de nog niet gedeelde offline leesroutes op dit apparaat.', [{ text: 'Bewaren', style: 'cancel' }, { text: 'Online routes gebruiken', onPress: () => { setBusy(true); void resolveConnectedProgress(false).then(stored => { applyFamilyState(stored); setRelease(null); }).catch(error => setStatus(message(error))).finally(() => setBusy(false)); } }])} />
    </View>}
    {progressPending && !progressConflict && <Text style={s.small}>Leesvoortgang veilig op dit apparaat bewaard; delen met je gezin volgt zodra verbinding mogelijk is.</Text>}
    {release ? passage ? <>
      <Text style={s.small}>{child?.name} · {picks.length === 5 ? 'Verhaal compleet' : `Deel ${picks.length + 1}`}</Text>
      <Text accessibilityRole="header" style={s.heading}>{personalizeStoryText(passage.title, child?.name ?? 'Avonturier')}</Text>
      {personalizeStoryText(passage.text, child?.name ?? 'Avonturier').split(/\n\s*\n/u).map((paragraph, index) => <Text key={index} style={s.reader}>{paragraph}</Text>)}
      {'choices' in passage ? passage.choices.map((choice, index) => <Action key={index} label={personalizeStoryText(choice.label, child?.name ?? 'Avonturier')} disabled={busy} onPress={() => void choose(index)} />) : <Text style={s.body}>{(passage as Ending).keepsake}</Text>}
    </> : <Text style={s.body}>Dit gratis voorproefje is uit. Je gekozen volledige gratis verhaal en de meegeleverde verhalen blijven beschikbaar.</Text> : <>
      <Text style={s.body}>Kies je gekoppelde gezinsprofiel. Je gezinsrecht wordt op de server gecontroleerd.</Text>
      {family?.family.children.map(value => <Action key={value.id} label={`${value.id === childId ? '✓ ' : ''}${value.name}`} onPress={() => setChildId(value.id)} />)}
      {!family?.family.children.length && <Text style={s.body}>Je ouder kan in het ouderhoekje zelf lokale profielen importeren en toestemming geven voor online opslag.</Text>}
      {catalog.map(story => <View key={String(story.storyId)} style={s.card}><Text style={s.heading}>{record(story.metadata) ? String(story.metadata.title) : String(story.storyId)}</Text><Text style={s.body}>{record(story.metadata) ? String(story.metadata.description ?? '') : ''}</Text><Action label="Lees dit verhaal" disabled={busy || !child} onPress={() => void open(story)} /></View>)}
      <Action label="Bibliotheek opnieuw laden" disabled={busy} onPress={() => void refresh()} />
    </>}
    {busy && <ActivityIndicator color="#24543e" />}{!!status && <Text accessibilityLiveRegion="polite" style={s.status}>{status}</Text>}
  </ScrollView>;
}
const s = StyleSheet.create({
  library: { padding: 22, gap: 16, paddingBottom: 40 }, card: { padding: 22, gap: 12, borderRadius: 22, backgroundColor: '#f0f2e3', borderColor: '#dfe5cf', borderWidth: 1 },
  heading: { fontSize: 23, lineHeight: 30, fontWeight: '800', color: '#244d36' }, body: { fontSize: 15, lineHeight: 24, color: '#52634f', flex: 1 }, small: { fontSize: 12, lineHeight: 20, color: '#52634f' },
  button: { minHeight: 50, padding: 15, borderRadius: 16, backgroundColor: '#24543e', justifyContent: 'center' }, buttonText: { textAlign: 'center', color: '#fffbee', fontSize: 15, fontWeight: '800' },
  input: { minHeight: 50, padding: 15, borderColor: '#bbcbae', borderWidth: 1, backgroundColor: '#fffef8', borderRadius: 15, fontSize: 16, color: '#244d36' }, check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  agreement: { padding: 15, gap: 12, backgroundColor: '#fffbee', borderRadius: 16 }, status: { fontSize: 14, lineHeight: 23, color: '#675828' }, reader: { fontSize: 20, lineHeight: 33, color: '#364a36', marginVertical: 7 },
});
