# Fabelpad — Google, OTP, privacy en accountlevenscyclus

Gecontroleerd op **22 november 2026**. Releasebron **`c1a9829c6580b835b9845dd672c9d89127f60c64`** staat op `main` van `fabelpad/platform`. De webrelease gebruikt de door de eigenaar bevestigde Supabase Custom SMTP via Resend. Google en e-mail zijn in beide projecten ingeschakeld; de applicatie accepteert precies zes OTP-cijfers. Er is geen Send Email Hook geactiveerd.

**Resultaat bij deze vastlegging:** schone lokale webbuild en alle 36 browsertests op exact de release-SHA geslaagd; beide verplichte CI-controles op die SHA zijn geslaagd. Beide kandidaten zijn gebouwd, onafhankelijk gecontroleerd en geactiveerd op uitsluitend de eigen loopbackpoorten. Beide services zijn actief en boot-enabled; de gezamenlijke releaseaudit en 22/22 veilige runtimecontroles per omgeving slagen. Er is geen publieke Fabelpad-routing toegevoegd. Ontbrekende privacyfeiten blijven een gate vóór publieke activatie.

## Resultatenmatrix

| Onderdeel | Exacte bron of run | Resultaat | Wat dit nog niet bewijst |
| --- | --- | --- | --- |
| Schone lokale build | Bron `c1a9829c6580b835b9845dd672c9d89127f60c64`; `bash scripts/local-build.sh` | Geslaagd | Geen doelbuild of doelconfiguratieacceptatie |
| Browserregressie | Productiebuild met synthetische gegevens; alle 36 tests | Geslaagd in 23,5 seconden | Geen echte mailbox, OAuth-provideracceptatie of live gebruikersflow |
| Main-release | `c1a9829c6580b835b9845dd672c9d89127f60c64` | Op GitHub aanwezig; op beide eigen loopbackreleases actief | Geen publieke openstelling |
| Verplichte web-CI `verify` | [Run 45055273294](https://github.com/fabelpad/platform/actions/runs/45055273294), release-SHA | **SUCCESS** | Geen appactivatie of publieke release |
| Verplichte `Native Android-controles` | [Run 45055273282](https://github.com/fabelpad/platform/actions/runs/45055273282), release-SHA | **SUCCESS** | Geen Play-upload |
| Live Supabase | Beide vaste projecten; vijf nieuwe migraties en Edge-updates | Toegepast en gecontroleerd | Geen interactieve OTP-/Google-acceptatie |
| Onderhoudsproef | Eigen HMAC, nonce en minuutcron per project | HTTP200, `completed:0,deferred:0` | Geen echte verwijdering of mailbezorging |
| Hostaudit | Beide doelen, twaalf modules per doel, **18:17 UTC** | **PASS**; runners 21 en 22 online | Geen kandidaat, appstart of publieke routing |
| Doelkandidaat staging | [Run 45057052139](https://github.com/fabelpad/platform/actions/runs/45057052139) | **SUCCESS**, onafhankelijke audit **PASS** | Geen appactivatie, login of mailacceptatie |
| Doelkandidaat production | [Run 45057304416](https://github.com/fabelpad/platform/actions/runs/45057304416) | **SUCCESS**, gezamenlijke audit **PASS** om 18:52 UTC | Geen appactivatie, login of mailacceptatie |
| Loopbackactivering staging | [Run 45057551364](https://github.com/fabelpad/platform/actions/runs/45057551364) | **SUCCESS**, 18:53:37 UTC; audit/health PASS | Geen publieke openstelling of gebruikersacceptatie |
| Loopbackactivering production | [Run 45057814826](https://github.com/fabelpad/platform/actions/runs/45057814826) | **SUCCESS**, 18:56:52 UTC; audit/health PASS | Geen publieke openstelling of gebruikersacceptatie |
| Veilige runtimecontrole | Beide eigen loopbackpoorten, 18:57 UTC | **22/22 PASS per omgeving** | Geen afgeronde OAuth-/OTP-/mail-/accountflow |
| Publieke routing | Caddy blijft buiten actieve configuratie | Niet geactiveerd | Geen publieke HTTPS-/gebruikersacceptatie |

## Schone lokale build

De lokale buildbron **`c1a9829c6580b835b9845dd672c9d89127f60c64`** is via `git archive` naar een afzonderlijke lege werkmap gekopieerd, gevolgd door `pnpm install --frozen-lockfile`. Toolchain: Node **24.18.0**, pnpm **11.25.0**, Next **16.3.4**. Configuratie: `FABELPAD_DATA_MODE=local`, geen Supabasewaarden of runtimegeheimen. Dit is een echte productiebuild van de webapp met geïsoleerde testconfiguratie, geen doelkandidaat.

`bash scripts/local-build.sh` slaagt volledig: configuratie, TypeScript, alle content-/profiel-/synchronisatiechecks, PostgreSQL/RLS en CAS, 32 Auth-contractscenario’s, 36 ouder-API-scenario’s, 48 AVG-beheer-API-scenario’s, lifecycle- en echte pgcrypto/HMAC-checks, 18 workertests, 59 mailtests, 17 Python-mailconfiguratietests, 87 releasetests, 19 hostinstallatietests, native gedragscontrole en `next build`.

De optimalisatiebuild compileerde met Turbopack en maakte de nieuwe publieke juridische pagina’s, ouderaccount-/herstelpagina, AVG-beheerpagina en afgeschermde API-routes aan. Alle statische bestanden, lokale fonts en het officiële Google-icoon worden met het project geleverd. De normale build voert geen echte mailverzending, live databasemigratie of appactivering uit.

Deze nieuwe schone build beoordeelt exact de huidige release, inclusief de laatste wijziging aan accountverwijdering. Het buildlog staat lokaal op `/tmp/fabelpad-deadline-clean-build-20261122.log`. Eerdere builds op oudere commits zijn historische controles en vervangen deze exacte broncontrole niet. De nieuwe GitHub CI-runs hierboven zijn daarnaast afzonderlijk geslaagd op exact dezelfde SHA.

## Browser en Edge

Alle **36 browsertests slagen** op de geïsoleerd gestarte productiebuild van exact dezelfde release-SHA, in **23,5 seconden**. De volledige run omvat mobiele vormgeving, bestaande lees-/beheerflows, Google/OTP, registratieverklaringen, documentversiewissel, toestemming per profiel, intrekking tijdens een open verhaal, verse authenticatie, expliciet herstel, apparaatgegevens wissen bij bewezen verwijdering, juridische downloads, offline TTS, AVG-beheer en de SMTP-HTML-download.

De twee toegevoegde browserscenario’s controleren dat de ouder vóór bevestiging de serverberekende verwijderdatum tot op de minuut ziet en dat een verlopen of gewijzigde minuut opnieuw expliciet bevestigd moet worden. Een preview die verse authenticatie vereist, laat geen bevestiging of wisaanvraag toe. De server berekent de preview zonder activiteit, voorwaarden, outbox of accountstatus te wijzigen. De bewaakte SQL-aanroep vergelijkt de bevestigde minuut binnen dezelfde transactie; bij een verschil worden ook accountblokkering, outbox en sessie-intrekking teruggedraaid. De PostgreSQL-tests controleren deze terugdraaiing daadwerkelijk.

De eerder aangescherpte toegankelijke testlocators zijn behouden. Alle 36 browsertests zijn samen opnieuw uitgevoerd; log `/tmp/fabelpad-deadline-browser-20261122.log`. De tijdelijke testserver op poort 3017 is daarna gestopt. Er zijn geen echte mailboxen, accounts of externe providers gebruikt in deze browsertests.

De drie Edge-entrypoints zijn met Deno **2.9.8** gecontroleerd. De onderhoudswerker accepteert uitsluitend een projectgebonden HMAC met korte geldigheid en een atomair eenmalige nonce. Geen herbruikbare sleutel staat in de providerqueue; echte SQL-HMAC-uitkomsten zijn lokaal met Node-crypto vergeleken.

## Live Supabase

Beide projecten hebben de vijf nieuwe migraties met gelijkgetrokken, op exacte SQL-hashes gecontroleerde historie:

| Migratie | Staging | Production |
| --- | --- | --- |
| `20261122172905_parent_account_lifecycle.sql` | Toegepast; hash gecontroleerd | Toegepast; dezelfde hash |
| `20261122174433_lifecycle_worker_schedule.sql` | Toegepast; hash gecontroleerd | Toegepast; dezelfde hash |
| `20261122175306_signed_lifecycle_worker_requests.sql` | Toegepast; hash gecontroleerd | Toegepast; dezelfde hash |
| `20261122175654_private_pg_net_extension.sql` | Toegepast; hash gecontroleerd | Toegepast; dezelfde hash |
| `20261122182638_account_deletion_deadline_preview.sql` | Toegepast; hash gecontroleerd | Toegepast; dezelfde hash |

De actieve Edge-versies zijn **`email-admin` v3**, **`auth-email` v3** en **`account-maintenance` v2**, afzonderlijk in staging en production. De bestaande SMTP-inrichting blijft behouden; de aanwezigheid van `auth-email` activeert geen Send Email Hook. Het [lifecyclecontrolebewijs](deploy-evidence/google-legal-lifecycle-2026-11-22.json) bevat de eerdere exacte migratie- en documenthashes, Edge-updates en rechtenaudit. De later toegepaste previewmigratie heeft SHA-256 **`465155f8d009f0ddddd8eda0dfe356b903862c47739b1e7c08628d0c3a32b9cc`**; de opgeslagen migratiehistorie is in beide projecten exact daarmee vergeleken. De functierechten en authenticatievereisten van de nieuwe preview en bewaakte verwijderaanroep zijn gecontroleerd.

Een expliciete onderhoudsaanroep en daaropvolgende cronaanroepen geven in beide projecten HTTP200 met `completed:0,deferred:0`. Dit bewijst de scheduler-/authenticatieroute, geen echte verwijdering of mailbezorging. Bij de laatste livecontrole zijn er nul gebruikers, beheerders, gezinnen en API-mailconfiguraties. Na de vijfde migratie zijn nul Auth-gebruikers, de actieve cron en de uitgeschakelde inactiviteitswissing opnieuw bevestigd. Automatische 90-dagenwissing blijft uit tot een gecontroleerd stagingrapport, werkende waarschuwingen en een beoordeelde overgang.

Ook na de vijfde migratie melden security advisors in beide projecten **0 WARN/ERROR** en 13 verklaarde INFO-meldingen voor private tabellen met bewuste directe toegangsweigering. De providerextensie `pg_net` staat in `extensions`. Toegepaste database- en Edge-wijzigingen betekenen niet dat de webapp al actief is.

## Hostvoorbereiding

Op **dg-vps-08** zijn de beperkte repositoryrunners **21** (staging) en **22** (production) online. De audit van **22 november 2026, 18:17 UTC** is voor beide doelen geslaagd en controleerde twaalf eigen root-owned adaptermodules per doel. De eigen journaldnamespaces en zesuurlijkse retentietimers zijn ingericht; zie de afzonderlijke hostcontrole hieronder. Een v2-configuratiebewijs per doel bindt de gecontroleerde publieke providerinstellingen aan het juiste project en origin, met settingscontroletijd `2026-11-22T17:50:30.645511+00:00`. Het verklaart uitdrukkelijk dat interactieve OTP-/Google-acceptatie nog nodig is.

Bij de gezamenlijke kandidaataudit om **18:52 UTC** waren beide eigen appservices inactief op de loopbackpoorten **4188** en **4189** en ontbraken de `current`-verwijzingen. Beide kandidaten zijn verzegeld en gecontroleerd. Daarna zijn de eigen staging- en productionreleases succesvol op loopback geactiveerd; de gezamenlijke audit en runtimecontrole hieronder bevestigen de nieuwe toestand. De voorbereide Caddy-configuratie is gevalideerd en staat **buiten de actieve configuratie**. Bestaande publieke routing, SSH, Tailscale en Castiq zijn hiermee niet gewijzigd. Een geldige proxysnippet bewijst geen DNS-, TLS- of publieke healthacceptatie.

## Kandidaatbouw en afzonderlijke infrastructuurcontrole

De eerste stagingrun **45056659715** mislukte door de overgeërfde runnerwerkmap. De hostadapter gebruikt nu expliciet de eigen werkmap bij het starten van het beperkte bouwproces. Beide doelen hebben de twaalf eigen modules uit rootbundel `/root/fabelpad-adapters-63600acaf8038166`. De afzonderlijke infrastructuurregressie slaagt voor **89 Node-tests en 19 Python-tests**. Deze twee ops-bron-/testbestanden en de loghelper zijn wijzigingen in de werkomgeving voor een latere ops-/documentatiecommit; zij zijn geen onderdeel van de app-SHA. De hierboven beschreven schone appbuild op `c1a9829…` omvat **87 releasetests**, en blijft afzonderlijk bewezen.

Stagingrun **45057052139** is geslaagd met kandidaat `c1a9829c6580b835b9845dd672c9d89127f60c64-45057052139-1` en configuratie `auth-legal-20261122-stg`. De kandidaat is verzegeld om `2026-11-22T18:48:53.439Z`. Artefact-SHA256: `a5cbb3c1e74e4373d9d57373ad9691867028509adcbf09f262ecd08c1a8aa956`. De onafhankelijke audit **18:50 UTC** bevestigt doelidentiteit, twaalf adapterhashes, configuratiebinding, volledige artefactdigest, root-eigendom, bescherming tegen runner-/buildschrijven en leesrechten voor uitsluitend de bedoelde rollen. De appservice bleef inactief; `current` en `previous` ontbraken. Lokale audit: `/tmp/fabelpad-staging-candidate-audit-20261122.json`, `passed:true`, geen failures of warnings. De bestaande service- en configuratiebaselines bleven gelijk; credentialbestanden zijn niet gelezen en configuratiewaarden zijn niet gelogd.

Productionrun **45057304416** is geslaagd voor dezelfde app-SHA, met kandidaat `c1a9829c6580b835b9845dd672c9d89127f60c64-45057304416-1`, configuratie `auth-legal-20261122-prd` en artefact-SHA256 `d0861cf393ce33e8402817fda7400cc117b30039557f942c0cbd59eb7b8f8141`. De kandidaat is verzegeld op `2026-11-22T18:51:43.290Z`. De gezamenlijke audit om **18:52 UTC** slaagt voor beide kandidaten, met dezelfde volledige manifest-, configuratie-, rechten- en baselinecontroles: `/tmp/fabelpad-both-candidate-audit-20261122.json`, `passed:true`, geen failures of warnings. Beide apps waren toen nog inactief. Daarna zijn de activeringsruns **45057551364** en **45057814826** geslaagd, uitsluitend op loopback; de actuele release- en healthcontrole staat hieronder. Publieke Caddy-routing staat nu uit. Na afronding van de privacyfeiten en juiste documentversie volgt eerst gecontroleerde staging-HTTPS voor de echte auth-/beheer-/mailacceptatie; production-HTTPS volgt gecontroleerd met eigen acceptatie.

De anonieme liveproef op **preview_account_deletion** en de bewaakte **request_account_deletion** is in beide projecten geweigerd met **HTTP401 / SQLSTATE42501**. Bewijs: `/tmp/fabelpad-live-rpc-anonymous-20261122.json`, gecontroleerd om `2026-11-22T18:52:13.652641+00:00`. Dit bevestigt de weigering zonder sessie en bewijst geen geslaagde of uitgevoerde accountverwijdering.

De loghelper heeft **zes geslaagde selftests** en echte `systemd-analyze verify` voor beide service-/timerparen. Het hostbewijs `/tmp/fabelpad-log-retention-20261122.json` bevestigt actieve timers om **00, 06, 12 en 18 uur**, 29-dagenretentie, maximaal 12 uur per journalbestand en een nauwkeurigheid van één minuut. Alleen de eigen namespaces worden geroteerd en opgeruimd; bij ontbreken wordt overgeslagen. De bewaakte timerupdate controleerde eerst de exacte oude bytes. Geen appservice of gedeelde logging is hierdoor gewijzigd. Dit bewijst geen providerback-up- of mailboxretentie.

## Werkelijke activatie en runtimecontrole

Stagingactivering [45057551364](https://github.com/fabelpad/platform/actions/runs/45057551364) is geslaagd om **18:53:37 UTC**; productionactivering [45057814826](https://github.com/fabelpad/platform/actions/runs/45057814826) om **18:56:52 UTC**. Beide eigen services zijn **active/running** en **enabled** voor een hostherstart. Zij luisteren uitsluitend op `127.0.0.1:4188` en `127.0.0.1:4189`.

De gezamenlijke [geactiveerde release-/rechtenaudit](deploy-evidence/loopback-release-2026-11-22.json) liep van **18:57:08 tot 18:57:13 UTC** en is geslaagd zonder failures of warnings. Zij controleerde de beide `current`-verwijzingen naar de verwachte releases, de verzegelde runtimeconfiguratie tegenover bronconfiguratie en manifest, volledige artefact-/configuratiedigests, root-eigendom, de gescheiden lees-/schrijfrechten en de gezonde releasebewijzen. Alle zes bestaande servicebaselines en gecontroleerde configuratiehashes bleven gelijk. Er is bij beide doelen **geen `previous`-release**; een live rollback is niet uitgevoerd.

De [veilige runtimecontrole](deploy-evidence/loopback-smoke-2026-11-22.json), voltooid om **18:57:04 UTC**, slaagt voor **22/22 controles per omgeving**. De controle omvat alleen eigen loopbackbinding, HTTP200-health met juiste omgeving en exacte app-SHA, cachebescherming, anonieme providerstatus, anonieme weigering van ouderstatus/-verwijdering, acht juridische routes zonder login, exacte bytes van beide juridische downloads en manifest, het officiële Google-SVG en veilige OAuth-initiatie.

De OAuth-initiatie gebruikt het eigen Supabase-authorize-endpoint, Google als provider, de juiste publieke callback en PKCE-S256. De verifiercookies hebben **HttpOnly**, **Secure**, **SameSite=Lax** en pad `/`; een cross-origin aanvraag wordt geweigerd. De redirect is **niet gevolgd**. Autorisatie-URL’s, challenges en cookiewaarden zijn alleen in procesgeheugen onderzocht en niet opgeslagen. Er is geen echt account aangemaakt, OTP aangevraagd, e-mail verstuurd of Google-aanmelding voltooid.

Beide healthantwoorden melden `ok:true`, `runtime:nextjs-node`, de juiste omgeving en exact `c1a9829c6580b835b9845dd672c9d89127f60c64`, met scope **`process-liveness-only`** en backend **`configured-unverified`**. Dit is proces-/configuratiebewijs; database-, gezin-, beheer-, mailbox- en volledige loginacceptatie blijven open. De juridische pagina’s zijn zonder login gecontroleerd via loopback; zij zijn daarmee nog niet via internet gepubliceerd. De voorbereide Caddy-snippets staan nog buiten de actieve configuratie.

## Releasebewijs en resterende gebruikersacceptatie

Beide kandidaten, activatieruns en loopbackhealth zijn daadwerkelijk gecontroleerd. De overgebleven placeholders betreffen echte gebruikersacceptatie; vul die uitsluitend na uitvoering in.

| Bewijsveld | Staging | Production |
| --- | --- | --- |
| Kandidaatbouwrun-ID en conclusie | `45057052139` / **SUCCESS, audit PASS** | `45057304416` / **SUCCESS, audit PASS** |
| Kandidaat-ID, configuratie-ID en artefactdigest | `c1a9829c6580b835b9845dd672c9d89127f60c64-45057052139-1` / `auth-legal-20261122-stg` / `a5cbb3c1e74e4373d9d57373ad9691867028509adcbf09f262ecd08c1a8aa956` | `c1a9829c6580b835b9845dd672c9d89127f60c64-45057304416-1` / `auth-legal-20261122-prd` / `d0861cf393ce33e8402817fda7400cc117b30039557f942c0cbd59eb7b8f8141` |
| Activatierun-ID en conclusie | `45057551364` / **SUCCESS** | `45057814826` / **SUCCESS** |
| Actieve SHA / gekoppelde runtimeconfiguratie | `c1a9829c6580b835b9845dd672c9d89127f60c64` / `auth-legal-20261122-stg` | `c1a9829c6580b835b9845dd672c9d89127f60c64` / `auth-legal-20261122-prd` |
| Loopbackhealth, 18:57 UTC | HTTP200, juiste omgeving en SHA; [audit](deploy-evidence/loopback-release-2026-11-22.json) | HTTP200, juiste omgeving en SHA; [audit](deploy-evidence/loopback-release-2026-11-22.json) |
| Publieke HTTPS-health | Niet uitgevoerd; Caddy-routing uit | Niet uitgevoerd; Caddy-routing uit |
| OTP-, Google-, onboarding- en beheeracceptatie | `<STAGING_AUTH_ACCEPTANCE_EVIDENCE>` | `<PRODUCTION_AUTH_ACCEPTANCE_EVIDENCE>` |

De exacte handmatige stappen staan in [DG-VPS-08-TWEE-OMGEVINGEN.md](DG-VPS-08-TWEE-OMGEVINGEN.md). Gebruik de actuele [statuspagina](STAGING-PRODUCTION-STATUS.md) voor de runner-, Edge- en schedulerstatus; eerdere offline-/v1-vermeldingen zijn historische voorbereidingstekst.

## Open punten vóór publieke activatie

De bijlage vereist correcte openbare voorwaarden/privacy vóór publicatie. Daarvoor ontbreken nog bevestigde maximale back-up-/provider-/VPS-termijnen, de feitelijke supportmailleverancier en de toepasselijke verwerkers-/doorgifteafspraken. DNS toont `mx.stackmail.com`; een MX-record bewijst geen contract, reseller, bewaarbeleid of maximale retentie. Een algemeen Free-/Pro-plan bewijst evenmin de werkelijke projectinstellingen, PITR of externe back-ups. De publieke privacytekst moet met de onderbouwde feiten overeenkomen vóór publieke account-/kindverwerking. Een reeds aanvaarde documentversie mag niet stilzwijgend worden overschreven.

De vervolgstappen zijn afhankelijk van de juiste HTTPS-origin: **eerst** provider-/retentiefeiten en de passende privacy-/voorwaardenversie afronden; **daarna** de eigen staging-HTTPS-route gecontroleerd activeren, DNS/TLS/health verifiëren en echte OTP-/Google-callback, eerste beheerder en API-servicemail testen; **vervolgens** production-HTTPS gecontroleerd vrijgeven en de afzonderlijke productieacceptatie uitvoeren. Breed gebruik of open verwerking van kindgegevens begint pas na die acceptatie. Een interactieve Google-callbacktest wordt niet vóór bereikbare staging-HTTPS als vereiste gesteld. Afgeschermde API-bootstrap via Edge-configuratie kan desgewenst onafhankelijk worden voorbereid.

De afzonderlijke **Resend API-key** voor applicatieservicemails ontbreekt nog in het Vault-beheer van beide omgevingen. Voer die na de echte eerste beheerderaanmelding per omgeving via **Beheer → E-mail** in en test afzender, servicebericht, outboxafhandeling en ontvangst. Werkende SMTP levert de API-key niet automatisch aan Vault. Auth-HTML en onderwerp gaan handmatig vanuit de template-editor naar het juiste Supabase Dashboard; er is geen automatische SMTP-templatesynchronisatie.

Interactieve OTP-/Google-login, eerste beheerderonboarding, echte inboxbezorging en een back-upherstelproef zijn niet als geslaagd aangemerkt. Beide vereiste CI-controles zijn geslaagd op de exacte SHA; dat vervangt geen kandidaat-/rechtenaudit of gebruikersacceptatie. Er zijn geen betaalroute, abonnement, incasso of storepublicatie toegevoegd of uitgevoerd. De native Android-bron is ongewijzigd en blijft de afzonderlijke lokale, gratis leesapp zonder cloudaccounts. De geslaagde native CI is een broncontrole; er is geen nieuwe Android-upload of Play-publicatie uitgevoerd.
