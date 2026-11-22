# Fabelpad — actuele status staging en production

Actueel [samenvattend releasebewijs](deploy-evidence/privacy180-release-2026-11-22.json): beide CI-runs, beide kandidaatbouwen, beide activeringen en alleen staging-HTTPS.

Controledatum: **22 november 2026**. Vrijgegeven bron: **`538c6b719e372f4dca99cfa2bc824cbf6310f5c1`** op `main` van `fabelpad/platform`. De eigenaar heeft de wijzigingen en uitrol toegestaan. Deze pagina scheidt broncontrole, databasewijzigingen, kandidaatbouw, appactivering en echte gebruikersacceptatie.

**Huidige toestand:** de schone build, alle 37 browsertests en beide verplichte CI-controles slagen op dezelfde SHA. Beide nieuwe kandidaten zijn gebouwd en gecontroleerd. Staging draait de nieuwe app en is via **[staging.fabelpad.nl](https://staging.fabelpad.nl)** bereikbaar voor de eigenaaracceptatie. Ook production draait de nieuwe app, uitsluitend op loopback. De gezamenlijke release-/rechtenaudit slaagt voor beide doelen; de eerdere gezonde app-/configuratiecombinaties zijn behouden. **Production-HTTPS blijft uit** totdat stagingacceptatie en de afzonderlijke productievrijgave zijn afgerond.

## Resultatenmatrix

| Onderdeel | Exact bewijs | Resultaat en grens |
| --- | --- | --- |
| Schone bronbuild | `git archive` van `538c6b719e372f4dca99cfa2bc824cbf6310f5c1`; `pnpm install --frozen-lockfile`; `bash scripts/local-build.sh` | **PASS**; Node 24.18.0, pnpm 11.25.0, Next 16.3.4, geïsoleerde lokale configuratie |
| Browserregressie | Productiebuild van dezelfde SHA, synthetische gegevens | **37/37 PASS**, 24,0 seconden; geen echte aanmelding of mail |
| Verplichte webcontrole `verify` | [45060149261](https://github.com/fabelpad/platform/actions/runs/45060149261) | **SUCCESS** |
| Verplichte `Native Android-controles` | [45060149267](https://github.com/fabelpad/platform/actions/runs/45060149267) | **SUCCESS**, 19:37:55 UTC; native bron ongewijzigd, geen Play-upload |
| Stagingkandidaat | [45061896274](https://github.com/fabelpad/platform/actions/runs/45061896274) | **SUCCESS**; kandidaat-/rechtenaudit PASS, oude gezonde release behouden |
| Productiekandidaat | [45062081153](https://github.com/fabelpad/platform/actions/runs/45062081153) | **SUCCESS**; kandidaat-/rechtenaudit PASS, oude gezonde release behouden |
| Stagingactivering | [45062096570](https://github.com/fabelpad/platform/actions/runs/45062096570) | **SUCCESS**; geactiveerde releaseaudit PASS om 19:41 UTC |
| Productionactivering | [45062262163](https://github.com/fabelpad/platform/actions/runs/45062262163) | **SUCCESS**; gezamenlijke release-/rechtenaudit en loopbackhealth PASS |
| Staging-HTTPS | Eigen route actief sinds 19:41:49 UTC, normale certificaatcontrole, health 200 op exacte SHA | **23/23 PASS** voor publieke, alleen-lezen controles; geen afgeronde OTP-/Google-/mailacceptatie |
| Production-HTTPS | Geen eigen Fabelpad-route geactiveerd | **Uit**; het bestaande/default hostantwoord is geen Fabelpad-productierelease |
| Supabase | [Livebewijs](deploy-evidence/privacy180-supabase-live-2026-11-22.json), staging eerst en daarna production | Beide 10 migraties exact gecontroleerd; 0 WARN/0 ERROR/14 INFO; 0 gebruikers |

## Eigen omgevingen

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Supabase-account / project | **fabelpad** / `tlwfpivafcokcjyjwgmq` | **Duindorpdoet** / `aptprpkosqctwrzeetgs` |
| Canonieke app-origin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Doel / repositoryrunner | `fabelpad-vps08-staging`, ID 21, online | `fabelpad-vps08-production`, ID 22, online |
| Eigen service / poort | `fabelpad-vps08-staging.service`, alleen `127.0.0.1:4188` | `fabelpad-vps08-production.service`, alleen `127.0.0.1:4189` |
| Nieuwe kandidaat | `538c6b719e372f4dca99cfa2bc824cbf6310f5c1-45061896274-1` | `538c6b719e372f4dca99cfa2bc824cbf6310f5c1-45062081153-1` |
| Configuratie-ID | `privacy180-20261122-stg` | `privacy180-20261122-prd` |
| Artefact-SHA-256 | `347d8c18b546721b45250b155eeac85bd4b9ed489e08856989ebff00a4577175` | `2e475b808862cac2792e7372a3ba1c8ff71f2d64dcb1f72a1121234a84d077d2` |
| Nieuwe release actief | Ja; health 200 op `538c6b719e372f4dca99cfa2bc824cbf6310f5c1` | Ja; uitsluitend loopbackhealth 200 op `538c6b719e372f4dca99cfa2bc824cbf6310f5c1` |
| Publieke route | Eigen staging-HTTPS actief; `X-Robots-Tag: noindex, nofollow, noarchive` | Eigen route uit |
| Auth / SMTP | E-mail en Google aan; Auto Confirm uit; bestaande Supabase Custom SMTP via Resend | Dezelfde inrichting, eigen project |
| Edge-versies | `email-admin` v3, `auth-email` v3, `account-maintenance` v2 | Dezelfde versies |
| Eerste beheerder | `info@dgwebservices.nl` na echte bevestiging en serveronboarding | Dezelfde mailbox, afzonderlijke projectidentiteit |
| API-servicemail / inactiviteit | Resend API-koppeling nog in Beheer te testen; automatische 90-dagenwissing **uit** | Dezelfde afzonderlijke open stappen |

Ieder GitHub environment houdt uitsluitend de vier afgesproken publieke variabelen: `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Sleutels, OTP’s, sessies en wachtwoorden blijven buiten broncode, documentatie en GitHub-variabelen. Build-, app- en runnerrechten blijven gescheiden; runtimegeheimen gaan niet naar het buildaccount.

Beide services zijn **active/running** en **boot-enabled**. De [gezamenlijke release-/rechtenaudit](deploy-evidence/privacy180-activated-2026-11-22.json) van 19:44:22–19:44:27 UTC bevestigt juiste `current`-verwijzingen, verzegelde runtimeconfiguratie, artefactdigests en beperkte rollen. Er zijn geen failures of warnings; de zes bestaande servicebaselines en basisconfiguraties zijn gelijk gebleven. De healthscope blijft `process-liveness-only`, backend `configured-unverified`. Voor echte login-/gezins-/mailacceptatie is nog de eigenaar nodig.

## Privacyinformatie en werkelijke uitvoering

De eigenaar bevestigde **back-ups maximaal 180 dagen**, **Stackmail**, **gewone supportmail maximaal 12 maanden na afsluiting**, de **verwerkers-/doorgifteafspraken** en **overgenomen Supabase Auth-templates**. Die informatievragen zijn beantwoord. Zie [eigenaarbewijs](deploy-evidence/privacy-owner-confirmation-2026-11-22.json) en [tekst-/versieoverzicht](PRIVACY-AANVULLING-180-DAGEN.md).

Privacyversie **`2026-11-22.1`**, SHA-256 `c3f6186be703dda5320b70227070fea79e395eac225dbbbde0420913c57727e4`, is additief in beide databases geplaatst en wordt door de nieuwe stagingapp getoond. Voorwaarden blijven **`2026-11-22`**. De oude privacyversie, exacte downloads en bestaande aanvaardingen zijn behouden; er is geen terugwerkende aanvaarding vastgelegd. De livecontrole van 19:33:56–19:37:06 UTC bevestigt tien migraties, de nieuwe functie-/rolgrenzen en directe toegangsweigering van de extra private bewijstabel. De 14 INFO-meldingen zijn de bewust direct afgeschermde private tabellen; er zijn 0 WARN en 0 ERROR.

| Gegevenstype / regel | Bron | Huidige betekenis |
| --- | --- | --- |
| Technische back-ups maximaal 180 dagen | Eigenaar | Bevestigde rotatiegrens; geen algemene termijn voor actieve gegevens |
| Gewone Stackmail-support maximaal 12 maanden na afsluiting | Eigenaar | Bevestigd beleid; inbox-/archiefopschoning is geen door de app uitgevoerde cron |
| Onvoltooide onboarding 7 dagen; handmatige verwijdering 30 dagen | Geïmplementeerde lifecycle | Serverdeadline en worker; een geldig eerder AVG-wisverzoek heeft eigen afhandeling |
| Minimaal AVG-zaakregister 12 maanden na afsluiting | SQL + scheduler | Afzonderlijk van de mailboxinhoud |
| Inactiviteit 90 dagen | Code aanwezig | Automatisch massawissen staat **uit** tot waarschuwingen, kandidatenrapport en overgangscontrole slagen |
| Minimaal ouder-/kindwisbewijs 210 dagen | Nieuwe live migratie | Vaste maximale duur; retries verlengen niet, geen Auth-FK voor kindbewijs; geen onafhankelijke hersteljournal |

Een herstelpunt wordt pas voor gebruikers geopend als alle latere verwijderingen en ingetrokken toestemmingen volledig zijn toegepast vanuit actuele, afgeschermde informatie buiten het teruggezette domein. De 210-dagenbewaring in dezelfde database bewijst deze herstelroute niet. Providerlogcriteria, feitelijke mailboxopschoning en een herstelproef blijven afzonderlijke operationele controles; bevestigde leveranciersafspraken worden niet opnieuw gevraagd.

## Staging-HTTPS en alleen-lezen controle

De eigen route `/etc/caddy/sites/fabelpad-vps08-staging.caddy` is root-owned 0644, SHA-256 `ba6facd1a010dab378eeb170cbaf26b2969c38f4fbfd735269a873280d039acb`. De gecombineerde configuratie is vóór en na installatie gevalideerd, waarna Caddy is herladen. DNS, basisconfiguratie, bestaande routes en de vooraf gemeten default-hostantwoorden zijn behouden. Alleen de nieuwe Fabelpad-stagingroute is toegevoegd. Zie de [eigen routeactivatie](deploy-evidence/privacy180-staging-https-activation-2026-11-22.json) en [headercorrectie](deploy-evidence/privacy180-proxy-header-fix-2026-11-22.json). Next overschreef aanvankelijk de referrerheader; de eigen Caddy-route en beide eigen voorbereide snippets zetten die nu uitgesteld met `>Referrer-Policy`. Alle drie configuraties zijn opnieuw gevalideerd. Een eerste mislukte correctiepoging herstelde aantoonbaar de eigen bestanden. Dit is een proxywijziging; de app-SHA en bundels zijn niet veranderd.

De alleen-lezen stagingcontrole bevestigt HTTP 200, de knop om een inlogcode aan te vragen, de Google-knop met geladen icoon onder de OTP-route, twee aanvankelijk lege registratiekeuzes en blokkering van aanmelding tot die verklaringen zijn gegeven. Privacy.1 noemt Stackmail, 180 dagen en 12 maanden en vermeldt dat automatische 90-dagenwissing nog uit staat. Historische privacy blijft via redirect en exact dezelfde downloadhash toegankelijk. Anonieme e-mailbeheer-API’s geven 401 en tonen geen bewerkbare instellingen. Het zescijferige invoerveld is in broncode en synthetische tests gecontroleerd; de liveproef toont vóór een OTP-aanvraag nog geen codeveld. Er is **geen OTP verstuurd, geen Google-aanmelding gevolgd en geen account gemaakt**. Zie de [browsercontrole](deploy-evidence/privacy180-staging-browser-2026-11-22.json). De [publieke HTTP-/TLS-proef](deploy-evidence/privacy180-staging-public-2026-11-22.json) slaagt voor **23/23 controles** om 19:44 UTC, inclusief TLS 1.3, HTTP→HTTPS, `noindex`, `nosniff`, `no-referrer`, juiste SHA, beide documenthashes en anonieme API-weigering.

## Volgende stappen voor de eigenaar

1. Open **[staging/inloggen](https://staging.fabelpad.nl/inloggen)**. Kies voor de eerste keer **Ouderaccount maken**; er is geen aparte `/registreren`-route. Lees de voorwaarden/privacy en geef de afzonderlijke 18+/ouderverklaring en voorwaardenkeuze actief.
2. Gebruik `info@dgwebservices.nl`, klik **Stuur mij een inlogcode** en vul alleen in Fabelpad de ontvangen **zes cijfers** in. Rond daarna de servergecontroleerde ouderonboarding af. Google is de tweede loginoptie; de volledige callback moet nog echt worden getest.
3. Open **Beheer → E-mailinstellingen** (`/studio/email`). Koppel de eigen Resend API-key via het afgeschermde formulier, controleer afzender/reply-to/tracking, voer de verplichte test uit en sla de geteste instellingen op. Controleer echte ontvangst en outboxafhandeling. SMTP alleen vult deze API-koppeling niet in.
4. Controleer met synthetische gegevens onboarding, beheerrechten, profieltoestemming, lezen, intrekken en de verwijder-/herstelroute. Schakel 90-dagenwissing pas in na de afzonderlijke staging-/waarschuwingscontrole.
5. Laat production-HTTPS uit totdat stagingacceptatie is afgerond. Geef production daarna gecontroleerd vrij en voer haar eigen login-, beheer- en mailacceptatie uit vóór breed online kindgebruik.

Auth-mail blijft via **Supabase Custom SMTP → Resend** gaan; activeer geen Send Email Hook. Templates zijn volgens de eigenaar overgenomen. Latere Auth-wijzigingen moeten als HTML plus onderwerp handmatig naar het eigen Supabase Dashboard worden overgezet. Applicatieservicemails gebruiken afzonderlijk de Resend API uit Vault. Een provider-API-ontvangstbewijs is geen bewijs van inboxbezorging.

## Nog vast te leggen bewijs

| Onderdeel | Staging | Production |
| --- | --- | --- |
| Activatierun / resultaat | `45062096570` / **SUCCESS** | `45062262163` / **SUCCESS** |
| Actieve nieuwe SHA / configuratie | `538c6b719e372f4dca99cfa2bc824cbf6310f5c1` / `privacy180-20261122-stg` | `538c6b719e372f4dca99cfa2bc824cbf6310f5c1` / `privacy180-20261122-prd` |
| Loopbackhealth | HTTP 200, exacte SHA; gezamenlijke audit 19:44 UTC | HTTP 200, exacte SHA; gezamenlijke audit 19:44 UTC |
| Publieke HTTPS | Actief, normale certificaatcontrole en health 200 | Niet geactiveerd; wacht stagingacceptatie |
| Echte OTP-/Google-/beheer-/mailacceptatie | `<STAGING_AUTH_MAIL_ACCEPTANCE_EVIDENCE>` | `<PRODUCTION_AUTH_MAIL_ACCEPTANCE_EVIDENCE>` |

## Eerder bewijs en herstel

De vorige loopbackrelease `c1a9829c6580b835b9845dd672c9d89127f60c64` en haar audits blijven historische controles: [release-/rechtenbewijs](deploy-evidence/loopback-release-2026-11-22.json), [runtimecontrole](deploy-evidence/loopback-smoke-2026-11-22.json). Ook het [eerdere privacybronbewijs](deploy-evidence/privacy-update-validation-2026-11-22.json) op `2467a47…` blijft intact; de nieuwe 37-testbuild op 538 beoordeelt de exacte huidige bron opnieuw. De eerste stagingbouw 45056659715 mislukte door een overgeërfde runnerwerkmap; de inmiddels opgenomen adaptercorrectie gebruikt de eigen werkmap.

Vorige app en runtimeconfiguratie blijven voor herstel beschikbaar. Approllback draait geen database-, documentcatalogus-, Vault- of SMTP-wijzigingen terug. Controleer daarom ook document-/onboardingcompatibiliteit vóór een oude app publiek gebruikt wordt; een oude proceshealth 200 bewijst die compatibiliteit niet. Zie [uitvoeringsroute](DG-VPS-08-TWEE-OMGEVINGEN.md), [validatie](VALIDATIE-GOOGLE-PRIVACY-2026-11-22.md), [Supabase-contract](../supabase/README.md), [gegevensstromen](PRIVACY-DATASTROMEN.md), [DPIA](PRIVACY-DPIA-2026-11-22.md) en [supportprocedure](PRIVACY-SUPPORT-RUNBOOK.md).

De native Android-app blijft een afzonderlijke gratis lokale leesapp zonder cloudaccounts. Deze webrelease voert geen nieuwe Android-upload of Google Play-publicatie uit.
