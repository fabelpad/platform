# Verificatie Resend-beheer en 17 templates

Datum: **22 november 2026**. Broncommit: **`511e39464544ca2c567181d8f19bbc6d66ed1fd6`**. Een latere bewijscommit wijzigt uitsluitend documentatie.

## Schone lokale build

Bron met `git archive` uit de genoemde commit gekopieerd naar `/tmp/fabelpad-resend-admin-clean-20261122-lQpErs`. Geen ontwikkel-`.env`, bestaande `.next`, `node_modules` of ongecommitteerde bestanden overgenomen. Installatie met `pnpm install --frozen-lockfile` geslaagd.

- Node **24.18.0**, pnpm **11.25.0**, Next.js **16.3.4**; ongewijzigd gecommitte lockbestand.
- Volledige `bash scripts/local-build.sh` geslaagd: preflight, configuratie, TypeScript, content, backend, e-mail, deploy, native runtimecontracten en Next-productiebouw.
- Backend: echte PostgreSQL-grants/RLS/RPC/CAS/bootstrap in PGlite en **25 Auth/SSR-SDK-scenario's** met een synthetische provider.
- E-mail: **58 Node-tests**, aparte PostgreSQL/Vault-contractsuite en **17 Python-configuratietests**. Dekkingsgrenzen: echte provideracceptatie, mailboxbezorging en Vault-cryptografie worden niet nagebootst als bewezen werking.
- Releasevoorbereiding: **86 Node-tests** en **19 Python-hostinstallatie-/upgradetests** geslaagd.
- Native runtimecontract: 13 verhalen, 403 scènes en 416 eindes; geen native productwijziging of Play-upload.
- Output `.next`; start `pnpm start --port 3017` op loopback. Health, beide beheerpagina's en privacy HTTP200; ongeconfigureerde beheer-API HTTP503, zonder verzending.
- **Alle 18 Playwright-tests geslaagd (13,4 seconden)** tegen de gebouwde app. Daarvan 9 nieuwe tests voor beheerrechten, beide pagina's, 17 templates, synthetische preview, sleutel wissen na succes/fout, conflicten, gescheiden wijzigingen samenvoegen, trackingfout en telefoonlayout. Alle Auth/Resend/API-antwoorden hiervoor zijn synthetisch.
- Beide Edge-entrypoints geslaagd onder **Deno 2.9.8**. De bestaande 31 HTML-/manifest-/previewexports blijven exact reproduceerbaar.

Lokale logs: `/tmp/fabelpad-resend-admin-20261122-install.log`, `/tmp/fabelpad-resend-admin-20261122-build.log`, `/tmp/fabelpad-resend-admin-20261122-browser.log`. De tijdelijke loopbackserver is na controle gestopt.

## Afzonderlijke staging- en productionbuild

Daarna zijn uit dezelfde exacte commit twee nieuwe Git-archives gemaakt in afzonderlijke werkmappen onder `/tmp/fabelpad-email-admin-target-builds-20261122-vmUeSU`. Beide gebruikten de eigen bestaande vier GitHub-environmentwaarden, uitsluitend in het procesgeheugen en zonder ze af te drukken of als secretbestand op te slaan. Geen Auth-enablevlag of ontbrekend readinessbewijs is als voltooid ingevuld.

Beide doelen: `pnpm install --frozen-lockfile`, `check:config --target <doel> --no-env-files` en `pnpm build` **geslaagd** met dezelfde Node/pnpm/Next-versies. Geïsoleerde loopbackstarts hadden HTTP200 op `/api/health`, met exacte bron-SHA en de juiste omgeving. De health meldt expliciet `configured-unverified` en bewijst alleen process-liveness. Staging gebruikte vrije poort 44143, production 43409; beide servers zijn gestopt en beide poorten daarna vrij gecontroleerd.

De niet-geheime uitvoerresultaten en logpaden staan lokaal in `/tmp/fabelpad-email-admin-target-builds-20261122-vmUeSU/results.json`. Dit zijn **lokale builds met de twee doelconfiguraties**, geen builds of releases op dg-vps-08 en geen OTP-/bezorgbewijs.

## Toegepast op beide Supabase-projecten

Projecten zijn vóór wijzigingen opnieuw gelezen: staging **fabelpad / `tlwfpivafcokcjyjwgmq`**, production **Duindorpdoet / `aptprpkosqctwrzeetgs`**. Migratie `20261122150754_admin_email_settings.sql`, SHA-256 **`6fe26fa91f58074511d2e1896898253a38a52e34a0096d9455bc713c5ce0c585`**, eerst op staging toegepast en geverifieerd, daarna op productie. De door MCP gekozen historietimestamp is uitsluitend na een exacte opgeslagen SQL-hashvergelijking aan de lokale CLI-migratieversie gelijkgemaakt; statements en bestaande migraties zijn behouden.

Beide projecten: `email-admin` **v1**, `auth-email` **v2**, status ACTIVE. Beide handlers controleren zelf hun identiteit/toegang; de platform-JWT-check staat daarom bewust uit. De hostingidentiteit wordt gecontroleerd vóór secrets of netwerkgebruik. Ongeconfigureerde openbare POST-proeven geven **503**; er is geen mail verstuurd. De publieke catalogus blijft **HTTP200 met 13 verhalen**. Anonieme toegang tot ontsleutelde verzendconfiguratie wordt geweigerd met **HTTP401**.

Voor/na: Auth-gebruikers 0, beheerders 0, gezinnen 0, drafts 0, bronverhalen 13, Vault-secrets 0. Beide nieuwe private tabellen leeg met RLS; alle zes applicatietabellen hebben RLS. Gewone gebruikers hebben geen directe verzendconfiguratie-/opslagrechten. Security advisors: geen waarschuwingen/fouten; twee verklaarde [INFO-meldingen voor RLS zonder beleid](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) bij de bewust volledig afgeschermde private tabellen. Alleen beperkte functies werken als eigenaar. Niet-geheime bewijzen staan in [email-admin-2026-11-22.json](deploy-evidence/email-admin-2026-11-22.json).

## Nog geen operationele e-mail of appactivatie

Een lokale productiebundel is geen doelkandidaat. Er staat nog **geen kandidaat op dg-vps-08**. Geen `current` gewisseld, appservice gestart, domein gepubliceerd, Play-release uitgevoerd of echte OTP-login geclaimd. Bestaande hostomgevingen zijn in deze toevoeging niet gewijzigd.

Nog nodig: eigen geverifieerd Resend-verzenddomein en API-key, eenmalige Supabase Auth/Hook/bootstrapconfiguratie met passende Management-toegang, echte mailboxontvangst en eerste beheerderslogin. Daarna kunnen Resend en templates via de beheerpagina's worden onderhouden. De vier GitHub-variabelen blijven ongewijzigd; geen extra variabele of servicecredential wordt voor Next vereist. Volg [EMAIL-BEHEER.md](EMAIL-BEHEER.md) en [STAGING-PRODUCTION-STATUS.md](STAGING-PRODUCTION-STATUS.md).
