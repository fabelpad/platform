# Fabelpad — Google, OTP, privacy en accountlevenscyclus

Actueel [samenvattend releasebewijs](deploy-evidence/privacy180-release-2026-11-22.json): beide CI-runs, beide kandidaatbouwen, beide activeringen en alleen staging-HTTPS.

Datum: **22 november 2026**. Exacte bron: **`538c6b719e372f4dca99cfa2bc824cbf6310f5c1`**, repository `fabelpad/platform`, branch `main`. De nieuwe release biedt privacyversie **`2026-11-22.1`**, behoudt de eerdere documenten en gebruikt de bestaande Supabase Custom SMTP via Resend. Er is geen Send Email Hook geactiveerd.

**Resultaat:** schone build en 37 browsertests op dezelfde SHA geslaagd; beide verplichte CI-controles geslaagd; beide kandidaten gebouwd en gecontroleerd. Staging is geactiveerd en via eigen HTTPS bereikbaar voor de eigenaaracceptatie. Production draait dezelfde nieuwe app intern op loopback; de gezamenlijke geactiveerde audit slaagt voor beide doelen. Echte OTP-/Google-aanmelding, API-servicemail en de afzonderlijke productie-openstelling worden niet als voltooid geclaimd.

## Huidige resultaten

| Onderdeel | Exacte bron / run | Resultaat | Grens van de controle |
| --- | --- | --- | --- |
| Schone productiebuild | `538c6b719e372f4dca99cfa2bc824cbf6310f5c1`, `git archive`, frozen lockfile en normale projectbuild | **PASS** | Geïsoleerde lokale configuratie; geen echte mail of live migratie |
| Browserregressie | Productiebundel van dezelfde SHA | **37/37 PASS**, 24,0 s | Synthetische sessies/gegevens; geen echte providerlogin |
| Web-CI | [45060149261](https://github.com/fabelpad/platform/actions/runs/45060149261) | **SUCCESS** | Exacte SHA; geen deployment uit de CI |
| Native CI | [45060149267](https://github.com/fabelpad/platform/actions/runs/45060149267) | **SUCCESS**, 19:37:55 UTC | Native bron ongewijzigd; geen Play-upload |
| Live Supabase | [Privacy-/retentiebewijs](deploy-evidence/privacy180-supabase-live-2026-11-22.json) | Beide projecten **PASS**, 10 migraties | Geen echte accounts/mails aangemaakt |
| Stagingkandidaat | [45061896274](https://github.com/fabelpad/platform/actions/runs/45061896274) | **SUCCESS**, audit PASS | Oude gezonde release bleef tijdens bouw beschikbaar |
| Productiekandidaat | [45062081153](https://github.com/fabelpad/platform/actions/runs/45062081153) | **SUCCESS**, audit PASS | Oude gezonde release bleef tijdens bouw beschikbaar |
| Stagingactivering | [45062096570](https://github.com/fabelpad/platform/actions/runs/45062096570) | **SUCCESS**, audit/loopbackhealth PASS | Geen voltooide login-/mailacceptatie |
| Productionactivering | [45062262163](https://github.com/fabelpad/platform/actions/runs/45062262163) | **SUCCESS**, gezamenlijke audit/loopbackhealth PASS | Geen publieke productionroute |
| Staging-HTTPS | Eigen route sinds 19:41:49 UTC | **23/23 PASS**, certificaat-/headercontrole en health 200 op exacte SHA | Alleen-lezen bereikbaarheid/configuratie; eigenaaracceptatie volgt |
| Production-HTTPS | Geen eigen Fabelpad-route actief | **Uit** | Geen publieke productievrijgave |

## Schone build en browserregressie

De bron is uit exact de genoemde commit met `git archive` in een schone aparte werkmap geplaatst. Installatie: **`pnpm install --frozen-lockfile`**. Build: **`bash scripts/local-build.sh`**. Toolchain: **Node 24.18.0**, **pnpm 11.25.0**, **Next 16.3.4**. De bouw gebruikte `FABELPAD_DATA_MODE=local`, zonder Supabasewaarden of runtimegeheimen.

Alle normale controles slagen: configuratie/TypeScript, profielen/content/synchronisatie/PWA, echte PostgreSQL/RLS/CAS-logica, **32 Auth-contractscenario’s**, **36 ouder-API-scenario’s**, **48 AVG-beheer-API-scenario’s**, retentie- en documentupgrades, echte pgcrypto-HMAC, **18 workertests**, **59 mailtests**, **17 Python-mailtests**, **89 releasetests**, **19 Python-hostinstallatietests**, native gedragscontrole en de Next-productiebundel. De 89 releasetests zitten nu in deze nieuwe appbron; de historische c1-build had 87. Er is geen nieuwe testtelling aan een oudere build toegeschreven.

Alle **37 browsertests slagen in 24,0 seconden**. Zij omvatten de bestaande lees-/beheerflows, Google/OTP, afzonderlijke ouderverklaring en voorwaarden, geen privacycheckbox, actuele documentversies en historische privacyweergave/downloads, profieltoestemming en intrekking, verse authenticatie, serverpreview vóór accountverwijdering, atomische minute-rolloverafhandeling, expliciet herstel, cachewissing na bewezen verwijdering, offline TTS, AVG-beheer en veilige SMTP-HTML-download. Er zijn geen echte mailboxen of provideraccounts gebruikt.

Lokale logs: `/tmp/fabelpad-staging-final-clean-build-20261122.log` en `/tmp/fabelpad-staging-final-browser-20261122.log`. Deze build/testopdrachten voeren geen live migratie, gebruikersmail of appactivering uit.

## Nieuwe database- en juridische versie

De twee additieve migraties zijn eerst op staging toegepast en gecontroleerd en daarna op production. De livecontrole is afgerond op **19:37:06 UTC**:

| Migratie | Exacte SQL-SHA-256 | Beide projecten |
| --- | --- | --- |
| `20261122190748_backup_erasure_evidence_retention.sql` | `b436de9753f28f90b44605c7988c1992fdea410b3688c0d5b42e1fa5c9de0977` | Toegepast; opgeslagen historie exact gelijk |
| `20261122190924_privacy_backup_support_update.sql` | `d362f0b8bad9074fd910d4dfd64122635c68b2a5f7723aa1359d882bfc4232a6` | Toegepast; opgeslagen historie exact gelijk |

Beide histories bevatten nu **10 migraties**. Bij afwijkende beheertooltijdstempels is uitsluitend de versie-administratie gewijzigd na exacte hash-, naam-, cardinaliteits- en doelversiecontrole. Auth-/SMTP-configuratie, Vault en gebruikers zijn niet door deze migratieproef veranderd.

Privacy **`2026-11-22.1`** heeft SHA-256 **`c3f6186be703dda5320b70227070fea79e395eac225dbbbde0420913c57727e4`**. De oude privacy **`2026-11-22`** behoudt SHA-256 `97673d3103443115097def26e20e6c677650dcb760d095de900ae3c5c5961cb7`; voorwaarden **`2026-11-22`** behouden SHA-256 `8da71baa717f1e98b393320532670b4ebbddacbd390a14dba3c4cc144b394840`. Bestaande aanvaardingen en bytes zijn niet overschreven. Huidige onboarding en nieuwe profieltoestemming gebruiken de nieuwe privacy-informatieversie; voorwaardenversie blijft gelijk.

De vaste bewijsretentie is **210 dagen**: te korte en te lange expiries worden naar de juiste einddatum geklemd, het eerste voltooiings-/registratiemoment verschuift niet door retries en minimaal gehasht kindwisbewijs blijft na een Auth-cascade beschikbaar. De directe tabelrechten zijn voor anon/authenticated/service_role geweigerd; toegestane functies blijven begrensd. De onderhoudstaak is actief, maar 90-dagenmassawissing staat **uit**. Er zijn 0 Auth-gebruikers,0 gezinnen en 0 aanvaardingen in de gecontroleerde projecten.

Security advisors: **0 WARN,0 ERROR,14 INFO**. De extra INFO betreft de nieuwe private kindwisbewijstabel met RLS en bewust geweigerde directe toegang. De volledige metadata en bewijslimieten staan in het [livebewijs](deploy-evidence/privacy180-supabase-live-2026-11-22.json).

## Kandidaatbouw en activering

| Gegeven | Staging | Production |
| --- | --- | --- |
| Kandidaat-ID | `538c6b719e372f4dca99cfa2bc824cbf6310f5c1-45061896274-1` | `538c6b719e372f4dca99cfa2bc824cbf6310f5c1-45062081153-1` |
| Configuratie-ID | `privacy180-20261122-stg` | `privacy180-20261122-prd` |
| Artefact-SHA-256 | `347d8c18b546721b45250b155eeac85bd4b9ed489e08856989ebff00a4577175` | `2e475b808862cac2792e7372a3ba1c8ff71f2d64dcb1f72a1121234a84d077d2` |
| Verzegeld |19:39:58 UTC |19:41:54 UTC |
| Kandidaataudit |19:40:26–27 UTC **PASS** |19:42:11–13 UTC **PASS** |
| Activeringsrun |45062096570 **SUCCESS** |45062262163 **SUCCESS** |
| Geactiveerde releaseaudit / health |Gezamenlijke audit 19:44 UTC **PASS**, HTTP 200 exacte SHA | Gezamenlijke audit 19:44 UTC **PASS**, HTTP 200 exacte SHA |

De audits controleren doelidentiteit, twaalf vertrouwde adapterhashes, configuratiebinding, volledige artefactdigest, root-eigendom en gescheiden runner-/build-/applees- en schrijfrechten. Tijdens beide builds bleef de vorige gezonde c1-release behouden. Beide activeringen koppelen de nieuwe app aan de eigen verzegelde runtimeconfiguratie en bewaren hun c1-app/configuratie als vorige combinatie. De gezamenlijke audit van 19:44:22–19:44:27 UTC bevestigt beide services active/running en enabled, de juiste current- en previous-verwijzingen, gezonde releasebewijzen en de volledige digest-/rechtencontrole. Geen failures of warnings; de zes bestaande servicebaselines en basisconfiguraties blijven gelijk. Er is geen live rollback uitgevoerd.

Bewijs: [stagingkandidaat](deploy-evidence/privacy180-staging-candidate-2026-11-22.json), [productiekandidaat](deploy-evidence/privacy180-production-candidate-2026-11-22.json) en [beide geactiveerde releases](deploy-evidence/privacy180-activated-2026-11-22.json). De `/api/health`-scope blijft **`process-liveness-only`**, backend **`configured-unverified`**. Proceshealth vervangt geen volledige login-, gezins-, beheer- of mailboxacceptatie.

## Gecontroleerde staging-HTTPS

Alleen `/etc/caddy/sites/fabelpad-vps08-staging.caddy` is als nieuwe eigen site toegevoegd, root-owned 0644, SHA-256 `ba6facd1a010dab378eeb170cbaf26b2969c38f4fbfd735269a873280d039acb`. Geïsoleerde én complete actieve configuratievalidatie slaagden vóór de Caddy-reload. Het basisbestand, DNS, bestaande routes en vooraf gemeten default-hostantwoorden zijn behouden. Sinds **19:41:49 UTC** is staging bereikbaar met normale certificaatcontrole en health 200 op exacte 538-SHA. De route geeft `X-Robots-Tag: noindex, nofollow, noarchive`. Production-HTTPS is niet geactiveerd.

De publieke **alleen-lezen** UI-proef bevestigt: OTP en de geladen Google-knop daaronder; voor registratie twee aanvankelijk lege verklaring-/voorwaardenkeuzes; privacy.1 met Stackmail/180 dagen/12 maanden en expliciet uitgeschakelde 90-dagenautomatisering; actuele download en historische redirect 307 met ongewijzigde hash; de route `/registreren` bestaat niet; anonieme e-mailbeheer-API’s 401 en geen bewerkbare mailinstellingen voor bezoekers. Het zescijferige invoerveld is in broncode en synthetische tests gecontroleerd; vóór een live OTP-aanvraag is het codeveld nog afwezig. Er is **geen OTP verzonden, geen Google-navigatie uitgevoerd en geen echt account gemaakt**. Geen onverwachte externe aanvragen zijn waargenomen.

Bewijzen: [routeactivatie](deploy-evidence/privacy180-staging-https-activation-2026-11-22.json), [publieke browsercontrole](deploy-evidence/privacy180-staging-browser-2026-11-22.json), [publieke HTTP-/TLS-controle](deploy-evidence/privacy180-staging-public-2026-11-22.json) en [headercorrectie](deploy-evidence/privacy180-proxy-header-fix-2026-11-22.json). De definitieve publieke proef om 19:44:16 UTC slaagt voor **23/23 controles**: geldige normale TLS-controle/TLS 1.3, exacte staging-SHA, noindex/nosniff/no-referrer, providerstatus, juridische routes en hashes, anonieme API-weigering, onbekende privacyversie 404 en HTTP→HTTPS. De referrerheader werd aanvankelijk door Next overschreven. Alleen de eigen actieve stagingroute, beide eigen voorbereide snippets en hun validatiesnapshots zijn gecorrigeerd met uitgestelde `>Referrer-Policy`; alle drie configuraties zijn daarna gevalideerd. De eerste mislukte correctiepoging heeft de eigen bestanden hersteld. De basisconfiguratie en andere projecten zijn ongewijzigd. De appcode/bundels zijn niet opnieuw gebouwd; de actieve bron blijft 538.

De eerste eigenaarflow loopt via **`/inloggen` → Ouderaccount maken**, de actieve ouderverklaring/voorwaardenkeuze, zes OTP-cijfers, serveronboarding en **Beheer → E-mailinstellingen** (`/studio/email`). Een volledige Google-callback wordt pas via deze bereikbare canonieke HTTPS-origin getest.

## Open uitvoering en herstel

De eigenaar bevestigde 180 dagen voor back-ups, Stackmail,12 maanden voor gewone support na afsluiting, verwerkers-/doorgifteafspraken en overgenomen Auth-templates. Die informatievragen zijn gesloten; zie [bron](deploy-evidence/privacy-owner-confirmation-2026-11-22.json). De beleidstermijnen voor back-ups en Stackmail zijn geen door de Fabelpad-app uitgevoerde opschooncron. Geïmplementeerde regels zijn 7 dagen onvoltooide onboarding,30 dagen handmatige hersteltermijn,12 maanden minimale AVG-zaakmetadata en 210 dagen minimale wisbewijzen.90-dageninactiviteit staat nog **uit**.

Echte OTP-/Google-aanmelding, eerste beheerderonboarding, de afzonderlijke Resend API-koppeling, inbox-/outboxacceptatie en een gecontroleerde inactiviteitsproef blijven uit te voeren. Production-HTTPS wacht eerst op stagingacceptatie en krijgt daarna haar eigen gecontroleerde vrijgave/acceptatie vóór breed gebruik van online kindgegevens. Auth blijft Supabase Custom SMTP gebruiken; activeer geen Send Email Hook.

Voor herstel uit een oude back-up is volledige actuele wis-/intrekkingsinformatie buiten het teruggezette domein vereist, of moet een ongedekt herstelpunt worden geweigerd. De 210-dagenbewijzen in dezelfde database leveren geen zelfstandige hersteljournal en er is geen herstelproef geclaimd. Approllback draait de nieuwe documentcatalogus/database niet terug; controleer de oude app daarom ook op juridische versie-/onboardingcompatibiliteit vóór publiek gebruik.

Historische bewijsbestanden blijven intact: de c1-[releaseaudit](deploy-evidence/loopback-release-2026-11-22.json) en [runtimecontrole](deploy-evidence/loopback-smoke-2026-11-22.json), plus de eerdere [2467a 47-broncontrole](deploy-evidence/privacy-update-validation-2026-11-22.json). De nieuwe schone 538-build en 37 tests zijn onafhankelijk daarvan uitgevoerd. De native app blijft de afzonderlijke gratis lokale leesapp zonder cloudaccounts; geen Android-upload of Play-publicatie is uitgevoerd.
