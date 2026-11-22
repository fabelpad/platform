# Fabelpad — actuele status staging en production

Controledatum: **22 november 2026**. Releasebron: **`c1a9829c6580b835b9845dd672c9d89127f60c64`** op `main` van `fabelpad/platform`. De eigenaar heeft wijzigingen en uitrol in beide Fabelpad-omgevingen toegestaan. Dit document onderscheidt geteste broncode, providerinrichting, kandidaatbouw en daadwerkelijke ingebruikname. Historische bewijsbestanden blijven momentopnamen van hun eigen controle.

**Huidige uitkomst:** de schone lokale webbuild van de exacte release-SHA en alle 36 browsertests slagen. Beide verplichte CI-controles op dezelfde SHA zijn geslaagd. Beide kandidaten zijn op dg-vps-08 gebouwd, onafhankelijk gecontroleerd en geactiveerd op uitsluitend hun eigen loopbackpoort. Beide services zijn actief en starten mee bij een hostherstart. De gezamenlijke release-/rechtenaudit en 22 veilige runtimecontroles per omgeving slagen. Geen publieke Fabelpad-route is toegevoegd. De publieke routes staan uit. Eerst volgt privacyafronding, daarna gecontroleerde staging-HTTPS voor echte acceptatie en vervolgens gecontroleerde production-HTTPS met haar eigen acceptatie.

## Latere eigenaarbevestiging en privacyactualisering

Na de onderstaande release bevestigde de eigenaar: **back-ups maximaal 180 dagen**, **Stackmail**, **gewone supportmail maximaal 12 maanden na afsluiting**, de **verwerkers-/doorgifteafspraken** en **overgenomen Supabase Auth-templates**. Deze informatievragen zijn daarmee beantwoord en worden niet opnieuw gesteld. Zie het [eigenaarbewijs](deploy-evidence/privacy-owner-confirmation-2026-11-22.json) en het [wijzigingsoverzicht](PRIVACY-AANVULLING-180-DAGEN.md).

Privacyversie **`2026-11-22.1`** is in de bron voorbereid met een additieve catalogusmigratie en een gerichte bewaaraanpassing voor minimale wisbewijzen. De historische downloads/aanvaardingen blijven intact. Dit verandert de hieronder bewezen live app-SHA niet vanzelf. Nieuwe lokale/CI-/doelbuilds en eventuele uitrol moeten als afzonderlijke resultaten worden vastgelegd. Echte Auth-/mailbezorging, mailboxopschoning en herstelcontrole blijven uitvoeringsproeven; de eigenaarbevestiging vervangt die niet. Een herstelpunt zonder volledige actuele wis-/intrekkingsdekking mag niet voor gebruikers worden geopend.

## Build- en releasematrix

| Controle of resultaat | Bron / bewijs | Uitkomst en grens |
| --- | --- | --- |
| Integratiebranch en release-SHA | `main`, `c1a9829c6580b835b9845dd672c9d89127f60c64` | Op GitHub aanwezig; push is geen deployment |
| Schone lokale webbuild | `c1a9829c6580b835b9845dd672c9d89127f60c64`; `pnpm install --frozen-lockfile` en `bash scripts/local-build.sh` | Geslaagd met geïsoleerde lokale configuratie; geen doelbuild |
| Browseracceptatie met synthetische gegevens | Alle 36 tests op de geïsoleerde productiebuild van de release-SHA | Geslaagd in 23,5 seconden; geen echte OTP-, Google- of inboxacceptatie |
| Verplichte webcontrole `verify` | [GitHub-run 45055273294](https://github.com/fabelpad/platform/actions/runs/45055273294), release-SHA | **SUCCESS** |
| Verplichte `Native Android-controles` | [GitHub-run 45055273282](https://github.com/fabelpad/platform/actions/runs/45055273282), release-SHA | **SUCCESS**; geen Play-upload |
| Hostadapteraudit | Beide eigen doelen, 22 november 2026 **18:17 UTC**, twaalf modules per doel | **PASS**; geen kandidaatbouw of appstart |
| Kandidaat staging | [Run 45057052139](https://github.com/fabelpad/platform/actions/runs/45057052139), exacte release-SHA | **SUCCESS**; kandidaat- en rechtenaudit **PASS** om 18:50 UTC |
| Kandidaat production | [Run 45057304416](https://github.com/fabelpad/platform/actions/runs/45057304416), configuratie `auth-legal-20261122-prd` | **SUCCESS**; gezamenlijke kandidaat-/rechtenaudit **PASS** om 18:52 UTC |
| Loopbackactivering staging | [Run 45057551364](https://github.com/fabelpad/platform/actions/runs/45057551364) | **SUCCESS**, 18:53:37 UTC; gezamenlijke releaseaudit en loopbackhealth PASS |
| Loopbackactivering production | [Run 45057814826](https://github.com/fabelpad/platform/actions/runs/45057814826) | **SUCCESS**, 18:56:52 UTC; gezamenlijke releaseaudit en loopbackhealth PASS |
| Veilige runtimecontrole | Beide eigen loopbackpoorten, 18:57 UTC | **22/22 PASS per omgeving**; OAuth-initiatie gecontroleerd, geen aanmelding afgerond |
| Publieke HTTPS | Caddy-voorbereiding buiten actieve configuratie | Niet geactiveerd; nieuwe privacyversie en uitvoeringsacceptatie nog vrij te geven |

De lokale build en de 36 browsertests zijn opnieuw uitgevoerd op een schone `git archive` van exact de huidige release-SHA. De eerdere 34-testbuild is hiermee historisch; de nieuwe release bevat ook de servergestuurde verwijderdatum vóór bevestiging, met een atomische controle bij het verlopen van de getoonde minuut. Zie [het volledige validatierapport](VALIDATIE-GOOGLE-PRIVACY-2026-11-22.md).

## Vastgestelde inrichting

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment; uitsluitend vier afgesproken variabelen | `staging` | `production` |
| Supabase-account / project | **fabelpad** / `tlwfpivafcokcjyjwgmq` | **Duindorpdoet** / `aptprpkosqctwrzeetgs` |
| App-origin voor de eigen doelconfiguratie | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Publieke Supabase Auth-settings | E-mail en Google aan; Auto Confirm uit | E-mail en Google aan; Auto Confirm uit |
| SMTP volgens eigenaar | Supabase Custom SMTP via Resend; OTP met zes cijfers | Supabase Custom SMTP via Resend; OTP met zes cijfers |
| Vijf nieuwe migraties | Exacte SQL-hashes toegepast en gecontroleerd | Dezelfde vijf exacte SQL-hashes toegepast en gecontroleerd |
| Edge Functions | `email-admin` v3, `auth-email` v3, `account-maintenance` v2 | Dezelfde versies |
| Auth-mailroute | Bestaande SMTP behouden; geen Send Email Hook geactiveerd | Dezelfde route |
| Onderhoudstaak | Minuutcron actief; projectgebonden HMAC en eenmalige nonce | Dezelfde route, eigen sleutel en projectbinding |
| Onderhoudsproef | HTTP200; `completed:0`, `deferred:0` | HTTP200; `completed:0`, `deferred:0` |
| Automatische wissing na 90 dagen | Uit; eerst stagingrapport, waarschuwingen en overgangscontrole | Uit |
| Gebruikers / beheerders / gezinnen bij laatste livecontrole | 0 / 0 / 0 | 0 / 0 / 0 |
| Eerste beheerder | Bootstrap voor `info@dgwebservices.nl`; echte bevestiging en serveronboarding vereist | Dezelfde mailbox, eigen identiteit in dit project |
| Broncontent | 13 verhalen behouden | 13 verhalen behouden |
| Resend API voor applicatieservicemails | Nog geen Vault-API-configuratie; eigen API-key ontbreekt | Dezelfde open stap, afzonderlijke configuratie |
| Runner met repositoryscope `fabelpad/platform` | ID **21**, online; `fabelpad-vps08-staging` | ID **22**, online; `fabelpad-vps08-production` |
| Root-owned adapters | Twaalf modules; eigen adapters na werkmapcorrectie bijgewerkt; stagingkandidaataudit PASS | Dezelfde adapterbundel; gezamenlijke kandidaataudit PASS om 18:52 UTC |
| Eigen logretentie | Actieve timer om 00, 06, 12 en 18 uur; 29 dagen, journalbestand maximaal 12 uur | Dezelfde instellingen in eigen namespace |
| Appservice / loopbackpoort | Actief en boot-enabled; uitsluitend `127.0.0.1:4188` | Actief en boot-enabled; uitsluitend `127.0.0.1:4189` |
| Doelkandidaat / actieve release | `c1a9829c6580b835b9845dd672c9d89127f60c64-45057052139-1` / dezelfde release actief | `c1a9829c6580b835b9845dd672c9d89127f60c64-45057304416-1` / dezelfde release actief |
| Caddy-voorbereiding | Gevalideerd, buiten actieve configuratie | Gevalideerd, buiten actieve configuratie |

De publieke Auth-settings zijn afzonderlijk gecontroleerd op **22 november 2026, 17:50:30 UTC** (`2026-11-22T17:50:30.645511+00:00`). Het bijbehorende v2-bewijs staat per doel in de eigen `email-readiness.json`, `root:root 0600`. Dit bindt omgeving, origin en Supabase-project en verklaart de eigenaarbevestiging over SMTP/OTP; het bewijst geen interactieve aanmelding of mailboxbezorging. Ongesigneerde beheer- en workerprobes worden met HTTP401 geweigerd zonder gebruikersmail te versturen.

De vijf nieuwe migraties zijn `20261122172905_parent_account_lifecycle.sql`, `20261122174433_lifecycle_worker_schedule.sql`, `20261122175306_signed_lifecycle_worker_requests.sql`, `20261122175654_private_pg_net_extension.sql` en `20261122182638_account_deletion_deadline_preview.sql`. Het [livecontrolebewijs](deploy-evidence/google-legal-lifecycle-2026-11-22.json) bevat de eerdere migratie- en juridische documenthashes en de grenzen van de schedulerproef. De vijfde migratie is daarna afzonderlijk op beide doelen toegepast en in de migratiehistorie exact gecontroleerd: SHA-256 `465155f8d009f0ddddd8eda0dfe356b903862c47739b1e7c08628d0c3a32b9cc`. Functierechten, nul Auth-gebruikers, actieve cron en uitgeschakelde 90-dagenwissing zijn opnieuw gecontroleerd. Het bewijs bevat ook de latere Edge-updates v3/v3/v2 en de uitgevoerde rechtenaudit.

`pg_net` staat in `extensions`. De security advisors melden **0 WARN/ERROR** en 13 verklaarde INFO-meldingen voor bewust direct afgeschermde private tabellen. De HMAC-sleutel staat niet in de netwerkqueue. De geslaagde lege onderhoudsproef bewijst de scheduler- en authenticatieroute; er zijn geen gebruikersgegevens gewist en geen berichten afgeleverd.

## Doelbouw, adaptercorrectie en logretentie

De eerste stagingbouw [45056659715](https://github.com/fabelpad/platform/actions/runs/45056659715) mislukte door een door de runner overgeërfde werkmap. De beperkte hostadapter start het eigen proces nu expliciet vanuit de eigen werkmap. De twaalf eigen adaptermodules zijn voor beide doelen bijgewerkt vanuit rootbundel `/root/fabelpad-adapters-63600acaf8038166`. De infrastructuurregressie omvat **89 Node-tests en 19 Python-tests**, alle geslaagd. Deze twee adapter-/testwijzigingen en de loghelper zijn host-/werkomgevingswijzigingen voor een afzonderlijke ops-/documentatiecommit; zij maken geen deel uit van de apprelease `c1a9829…`. De schone appbuild op die SHA bevat nog steeds **87 releasetests**, naast de overige controles en 36 browsertests.

De geslaagde stagingbouw gebruikt configuratie `auth-legal-20261122-stg`. Het kandidaatmanifest is verzegeld op `2026-11-22T18:48:53.439Z`; de onafhankelijke audit om **18:50 UTC** bevestigt SHA, omgeving, configuratie- en artefactdigest, root-eigendom en gescheiden lees-/schrijfrechten. De appservice bleef inactief en er was geen `current`-verwijzing. Het volledige lokale bewijs staat in `/tmp/fabelpad-staging-candidate-audit-20261122.json`. Deze audit verifieerde bestaande service- en configuratiebaselines zonder credentialbestanden te lezen of configuratiewaarden te loggen.

De productiebouw is eveneens geslaagd, met kandidaat `c1a9829c6580b835b9845dd672c9d89127f60c64-45057304416-1` en configuratie `auth-legal-20261122-prd`, verzegeld op `2026-11-22T18:51:43.290Z`. De gezamenlijke audit om **18:52 UTC** controleerde beide kandidaten opnieuw en slaagde zonder failures of warnings: `/tmp/fabelpad-both-candidate-audit-20261122.json`. Alle bestaande service-/configuratiebaselines bleven gelijk; beide apps waren toen nog inactief. De anonieme liveproef op `preview_account_deletion` en de bewaakte `request_account_deletion` gaf in beide projecten HTTP401 / SQLSTATE42501: `/tmp/fabelpad-live-rpc-anonymous-20261122.json`. Dit bewijst weigering zonder sessie, geen geslaagde ouderaanvraag.

De eigen loghelper slaagt voor **zes selftests** en echte `systemd-analyze verify` voor beide service-/timerparen. Beide eigen retentietimers zijn actief met schema `*-*-* 00,06,12,18:00:00`, `AccuracySec=1min`, 29-dagenretentie en maximaal 12 uur per journalbestand. Een ontbrekende namespace wordt overgeslagen; alleen het eigen namespacejournal wordt geroteerd/opgeruimd. Het lokale hostbewijs staat in `/tmp/fabelpad-log-retention-20261122.json`. Dit heeft geen appservice gestart en geen gedeelde logging gewijzigd. Dit bewijs bepaalt geen back-up- of supportmailretentie.

## Geactiveerde loopbackreleases

De stagingactivering **45057551364** slaagt om **18:53:37 UTC**; productionactivering **45057814826** om **18:56:52 UTC**. De gezamenlijke [release-/rechtenaudit](deploy-evidence/loopback-release-2026-11-22.json) van **18:57:08–18:57:13 UTC** bevestigt voor beide doelen een actieve boot-enabled service, de juiste `current`-verwijzing, verzegelde app-/runtimeconfiguratie, volledige artefactdigest en de bedoelde lees-/schrijfrechten. Er zijn geen failures of warnings; de zes bestaande servicebaselines en gecontroleerde configuraties zijn gelijk gebleven. Er is bij geen van beide doelen een vorige gezonde release; er is geen live rollback uitgevoerd.

De [veilige runtimecontrole](deploy-evidence/loopback-smoke-2026-11-22.json) om **18:57 UTC** slaagt voor **22/22 controles per omgeving**: uitsluitend eigen IPv4-loopbackbinding, health op exact de app-SHA, private/no-store sessieantwoorden, weigering van anonieme ouder-/verwijderroutes, acht juridische routes zonder login, exacte document- en manifesthashes en het Google-icoon. Google OAuth-initiatie verwijst naar het eigen Supabase-project en de juiste callback, met PKCE-S256 en HttpOnly/Secure/SameSite=Lax cookies. Een cross-origin poging wordt geweigerd. De redirect is niet gevolgd; code- en cookiewaarden zijn alleen in geheugen onderzocht en niet bewaard.

Beide `/api/health`-antwoorden geven HTTP200, `ok:true`, de juiste omgeving en exact de release-SHA. Hun scope blijft **`process-liveness-only`**, backend **`configured-unverified`**. Dit is geen voltooide Google-login, OTP-/mailbezorging, echte account-/gezinsflow, databaseacceptatie of publieke HTTPS-acceptatie. De publieke Caddy-routing blijft uit.

## Twee afzonderlijke mailroutes

**Auth-mail:** de ingerichte **Supabase Custom SMTP via Resend** blijft de route voor e-mail-OTP en andere Supabase Auth-mails. Activeer hiervoor **geen Send Email Hook**. Een gedeployde `auth-email`-functie neemt SMTP niet over zolang geen hook is ingeschakeld.

De 31 bestanden onder `supabase/email-templates/` bevatten 13 staging-HTML-templates, 13 productie-HTML-templates, vier synthetische previews en een manifest. **Beheer → E-mailtemplates** kan van een bewerkte Auth-template de veilige HTML en het onderwerp leveren. Neem beide per project handmatig over in **Supabase Authentication → Email Templates**. De editor synchroniseert niet automatisch naar het Supabase Dashboard.

**Applicatieservicemails:** waarschuwingen en verwijderbevestigingen gebruiken de duurzame outbox en afzonderlijk de **Resend API**. Koppel na de echte eerste beheerderaanmelding per omgeving via **Beheer → E-mail** een beperkte API-key in het eigen Vault. Werkende SMTP levert deze API-key niet aan de app. Zonder die koppeling blijft servicemail onvoltooid; claim geen werkende waarschuwings- of bevestigingsbezorging. Test afzender, reply-to, tracking, servicebericht en outboxafhandeling afzonderlijk. Een API-ontvangstbewijs bewijst nog geen inboxbezorging.

Er blijven uitsluitend `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in ieder GitHub environment. Sleutels, tokens, OTP’s, wachtwoorden en echte mailinhoud horen niet in deze variabelen, documentatie of testuitvoer.

## Open gates en volgorde

| Stap | Wat klaarstaat | Nog nodig |
| --- | --- | --- |
| 1. CI-vrijgave | Exacte main-SHA; schone lokale build, 36 browsertests en beide verplichte CI-controles geslaagd | Afgerond voor deze SHA; een andere SHA opnieuw controleren |
| 2. Doelkandidaten | Beide kandidaten gebouwd; gezamenlijke kandidaat-/rechtenaudit PASS | Afgerond voor deze twee kandidaat-ID’s |
| 3. Feitelijke privacy vóór publieke activatie | Juridische routes, versies/downloads, DPIA en gegevensstroominventaris | Eigenaargegevens bevestigd: 180 dagen back-ups, Stackmail, supportmail 12 maanden en verwerkers-/doorgifteafspraken. De nieuwe versie `2026-11-22.1` testen en uitrollen; providerlogcriteria, mailbox- en hersteluitvoering apart verifiëren |
| 4. Eerste aanmelding en beheer | Zescijferige OTP, Google-knop, serveronboarding en beheerderbootstrap | Interactieve OTP-/Google-aanmelding per omgeving; eerste beheerder, voorwaarden en ouder-/profieltoestemming met toegestane testgegevens controleren |
| 5. Applicatiemail | Vault-beheer, template-editor en outbox | Eigen Resend API-key per omgeving, verzending en echte ontvangst controleren; scheduler-200 alleen is daarvoor onvoldoende |
| 6. Inactiviteitsbeleid | Uitvoerbare worker en minuutcron | Eerst stagingrapport, werkende waarschuwingen en overgangscontrole; 90-dagenwissing staat tot die afronding uit |
| 7. App en HTTPS | Beide loopbackreleases actief; gezamenlijke releaseaudit en 22/22 veilige runtimecontroles per omgeving geslaagd | Eerst privacyfeiten en bijpassende versie afronden; daarna eigen staging-HTTPS voor gecontroleerde auth-/beheer-/mailacceptatie; production-HTTPS vervolgens gecontroleerd met eigen acceptatie. Geen breed online kindgebruik vóór die acceptatie |

De privacygate volgt uit de bijlage en is inhoudelijk: toestemming voor uitrol en geslaagde CI vervangen ontbrekende providerfeiten niet. Publiceer de online account-/kindfuncties pas wanneer de openbare privacyinformatie klopt. Gebruik synthetische gegevens voor resterende proeven. Een gratis lokale leesroute en voorbereiding van een kandidaat kunnen onafhankelijk doorgaan. Er is geen betaalroute of abonnement geactiveerd.

De resterende route kent geen cirkel: **(1)** bevestig provider-/retentiefeiten en werk de bijpassende juridische versie af; **(2)** activeer daarna de eigen staging-HTTPS-route gecontroleerd, valideer DNS/TLS/health en voer met toegestane testgegevens de echte OTP-/Google-, beheerder- en API-mailproeven uit; **(3)** geef vervolgens production-HTTPS gecontroleerd vrij en voer daar de eigen acceptatie uit vóór breed gebruik of open verwerking van kindgegevens. Een volledige Google-callbackproef vereist de juiste bereikbare HTTPS-origin; die is niet vóór het openen van staging als afgerond vereist of beweerd. Eventuele afgeschermde Edge-bootstrapconfiguratie voor de API is een afzonderlijke optionele beheerroute.

## Releasebewijs en resterende bewijsvelden

Beide bouwruns, kandidaatmetadata en loopbackactiveringen zijn bewezen. De overgebleven acceptatievelden zijn **nog niet uitgevoerd**. Vervang die uitsluitend door echte resultaten. Loopbackactivering en publieke openstelling blijven afzonderlijke stappen.

| Vast te leggen bewijs | Staging | Production |
| --- | --- | --- |
| Kandidaatworkflow | `fabelpad-dg-vps-08-staging-candidate.yml` | `fabelpad-dg-vps-08-production-candidate.yml` |
| Kandidaatbouwrun-ID | [45057052139](https://github.com/fabelpad/platform/actions/runs/45057052139) | [45057304416](https://github.com/fabelpad/platform/actions/runs/45057304416) |
| Kandidaatbouwresultaat | **SUCCESS**, audit PASS | **SUCCESS**, audit PASS |
| Kandidaat-ID uit manifest | `c1a9829c6580b835b9845dd672c9d89127f60c64-45057052139-1` | `c1a9829c6580b835b9845dd672c9d89127f60c64-45057304416-1` |
| Onveranderlijke configuratie-ID | `auth-legal-20261122-stg` | `auth-legal-20261122-prd` |
| Artefactdigest uit manifest | `a5cbb3c1e74e4373d9d57373ad9691867028509adcbf09f262ecd08c1a8aa956` | `d0861cf393ce33e8402817fda7400cc117b30039557f942c0cbd59eb7b8f8141` |
| Activatieworkflow | `fabelpad-dg-vps-08-staging-activate.yml` | `fabelpad-dg-vps-08-production-activate.yml` |
| Activatierun-ID en resultaat | [45057551364](https://github.com/fabelpad/platform/actions/runs/45057551364) / **SUCCESS** | [45057814826](https://github.com/fabelpad/platform/actions/runs/45057814826) / **SUCCESS** |
| Actieve SHA en runtimeconfiguratie | `c1a9829c6580b835b9845dd672c9d89127f60c64` / `auth-legal-20261122-stg` | `c1a9829c6580b835b9845dd672c9d89127f60c64` / `auth-legal-20261122-prd` |
| Loopbackhealth, audit 18:57 UTC | HTTP200, juiste staging-SHA; [bewijs](deploy-evidence/loopback-release-2026-11-22.json) | HTTP200, juiste production-SHA; [bewijs](deploy-evidence/loopback-release-2026-11-22.json) |
| Publieke HTTPS-health | Niet uitgevoerd; Caddy-routing uit | Niet uitgevoerd; Caddy-routing uit |
| Interactieve OTP-/Google-/beheeracceptatie | `<STAGING_AUTH_ACCEPTANCE_EVIDENCE>` | `<PRODUCTION_AUTH_ACCEPTANCE_EVIDENCE>` |

De exacte bouw-, activatie-, verificatie- en rollbackcommando’s staan in [DG-VPS-08-TWEE-OMGEVINGEN.md](DG-VPS-08-TWEE-OMGEVINGEN.md). Voor de actuele online runner-/Edge-/schedulerstatus geldt deze statuspagina; oudere tekst over offline runners of een nog niet ingerichte scheduler is historisch. Bewaar na uitvoering nieuw bewijs naast het eerdere bewijs.

## Onderliggende controles

- [Volledig build- en validatierapport](VALIDATIE-GOOGLE-PRIVACY-2026-11-22.md), [loopbackrelease-/rechtenaudit](deploy-evidence/loopback-release-2026-11-22.json) en [veilige runtimecontrole](deploy-evidence/loopback-smoke-2026-11-22.json).
- [Gegevensstromen](PRIVACY-DATASTROMEN.md), [DPIA](PRIVACY-DPIA-2026-11-22.md) en [AVG-supportprocedure](PRIVACY-SUPPORT-RUNBOOK.md).
- [Lifecycle-contract en worker](LIFECYCLE-IMPLEMENTATIE.md), [onafhankelijke review](REVIEW-PRIVACY-LIFECYCLE-2026-11-22.md).
- [E-mailbeheer](EMAIL-BEHEER.md) en [template-exports](EMAIL-TEMPLATES.md).
- Historische momentopnamen: [eerste Supabase-inrichting](deploy-evidence/supabase-2026-11-22.json), [mailbeheer](deploy-evidence/email-admin-2026-11-22.json), [hostvoorbereiding](deploy-evidence/dg-vps-08-2026-11-22.json) en [nieuwere lifecycle-/hostcontrole](deploy-evidence/google-legal-lifecycle-2026-11-22.json).

De native Android-bron is ongewijzigd en blijft een afzonderlijke lokale, gratis leesapp zonder cloudaccounts. De nieuwe native CI is een vereiste broncontrole; er is geen nieuwe Android-upload of Play-publicatie uitgevoerd.
