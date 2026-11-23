# Fabelpad — actuele status staging en production

Controledatum: **23 november 2026, Europe/Amsterdam**. Actieve appbron: **`ec82395ba57904302bc4a93e71e5dba63def2950`**, repository `fabelpad/platform`, integratiebranch `main`. Zie het [releasebewijs](deploy-evidence/complete-release-2026-11-23.json) en de [validatie van avonturen en leesniveaus](VALIDATIE-AVONTUREN-2026-11-23.md).

**Beide appservices zijn actief, boot-enabled en exact op deze bron gecontroleerd.** Staging is bereikbaar op **[staging.fabelpad.nl](https://staging.fabelpad.nl)**. De productieapp draait op haar eigen loopbackpoort; **de publieke productieroute blijft uit**. Proxy, DNS, externe mailconfiguratie en zes bestaande services zijn behouden.

## Geïntegreerde avonturen

Alle **13 avonturen** hebben **5 hoofdstukken**, **2 keuzes per hoofdstuk** en een speelprent bij elk van de **65 hoofdstukken**. Web en native gebruiken **hero → volledige verhaaltekst → Wat kies jij? → speelprent of keuzeknoppen → voorlezen/opslagstatus**. Een keuze gaat eenmaal door naar de hero van het volgende hoofdstuk; keuze vijf opent de afsluiting en kent het bijbehorende aandenken toe. De twee specifieke stationsopdrachten en treinanimatie blijven op web behouden. Native gebruikt illustraties met twee directe keuzes op alle hoofdstukken en behoudt de moduswissel.

De drie volledige leesniveaus gebruiken dezelfde routes. `6to8` is de standaard zonder profielvoorkeur; wisselen bewaart hoofdstuk, routekeuzes, vastgezette editie en voortgang. De jongere versies blijven per volledige route binnen 5% van de oorspronkelijke omvang. Een voltooide route kan zonder voortgangsherschrijving worden teruggelezen of vanaf hoofdstuk één opnieuw worden gespeeld; de laatst voltooide route/contentversie blijft bewaard. Bestaande verhaal-ID’s, route-indexen, aandenkens, geauthenticeerde toegang, downloads en oude contentversies blijven bruikbaar.

## Uitgevoerde controles

| Onderdeel | Bewijs | Resultaat en grens |
| --- | --- | --- |
| Schone bronbuild | [Lokale validatie](deploy-evidence/complete-local-validation-2026-11-23.json) | **PASS, 46,8 seconden**, Node 24.18.0 / pnpm 11.25.0 / Next 16.3.4, exact-SHA-gitarchive en geïsoleerde lokale configuratie |
| Volledige browsersuite | [Lokale validatie](deploy-evidence/complete-local-validation-2026-11-23.json) | **68/68 PASS**, 18 nieuwe avontuurscenario’s, 360/390/768/1440 px; geen failures/skips/flaky tests |
| Leesniveau- en routecontrole | [Lokale validatie](deploy-evidence/complete-local-validation-2026-11-23.json) | **403 hoofdstukvarianten en 416 eindroutes per niveau**; alle routes binnen 5%, exacte aandenkens en routebetekenissen |
| PostgreSQL/JSON-contract | [Lokale validatie](deploy-evidence/complete-local-validation-2026-11-23.json) | **38 snapshot- en 37 bundelgevallen**, legacy-upgrade, CAS, consent, ouderisolatie, hash en private rechten |
| Native export/typecontrole/runtime | [Native validatie](deploy-evidence/complete-native-validation-2026-11-23.json) | **PASS**, drie niveaus, 20 bron-/exportillustraties, reproduceerbare export en behouden oude archiefbytes |
| Native ongetekend productie-AAB | [CI-/AAB-inspectie](deploy-evidence/complete-native-ci-2026-11-23.json) | **PASS**, 20 runtime-WebPs met bronhashes gelijk, ELF-/bundle-alignment en statische Hermes-/contenttokens; geen toesteltest, signing of Play-upload |
| Gezamenlijke app-/rechtenaudit | [Bewijs](deploy-evidence/complete-activated-2026-11-23.json) | Beide services gezond op exacte SHA, gekoppelde app/runtimeconfiguratie en vorige readercombinatie behouden |
| Publieke staging | [HTTP/TLS](deploy-evidence/complete-staging-public-2026-11-23.json), [browser](deploy-evidence/complete-staging-browser-2026-11-23.json) | **23 HTTP/TLS- en 1817 browsercontroles PASS**; geen echte Auth-/mailhandelingen |
| Bestaande omgevingen/routing | [Voorcontrole](deploy-evidence/complete-host-before-2026-11-23.json), [eindaudit](deploy-evidence/complete-activated-2026-11-23.json), [routing](deploy-evidence/complete-routing-2026-11-23.json) | Zes bestaande services, gedeelde configuratie, stagingproxy en standaard-hostantwoorden behouden; productie publiek uit |

| Stap | Run | Resultaat |
| --- | --- | --- |
| Verplichte web-CI `verify` | [45084662737](https://github.com/fabelpad/platform/actions/runs/45084662737) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Verplichte `Native Android-controles` | [45084662867](https://github.com/fabelpad/platform/actions/runs/45084662867) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Stagingkandidaat | [45085866014](https://github.com/fabelpad/platform/actions/runs/45085866014) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Stagingactivering | [45086062913](https://github.com/fabelpad/platform/actions/runs/45086062913) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Productiekandidaat | [45086060176](https://github.com/fabelpad/platform/actions/runs/45086060176) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Productieactivering | [45086241991](https://github.com/fabelpad/platform/actions/runs/45086241991) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |

## Eigen omgevingen en release-identiteit

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Supabase-account / project | fabelpad / `tlwfpivafcokcjyjwgmq` | Duindorpdoet / `aptprpkosqctwrzeetgs` |
| App-origin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Eigen doel / runner | `fabelpad-vps08-staging`, ID 21 | `fabelpad-vps08-production`, ID 22 |
| Appservice / loopback | `fabelpad-vps08-staging.service`, `127.0.0.1:4188` | `fabelpad-vps08-production.service`, `127.0.0.1:4189` |
| Actieve kandidaat | `ec82395ba57904302bc4a93e71e5dba63def2950-45085866014-1` | `ec82395ba57904302bc4a93e71e5dba63def2950-45086060176-1` |
| Configuratie-ID | `complete-20261123-stg` | `complete-20261123-prd` |
| Artefact-SHA-256 | `fe475181d48b5231652212ec6f2b54a72e458e4accb0f5528f66c13587e3066b` | `51c661f8781967064ec25991442f03b70d263d10bc49d749d1938e2c44ef0f59` |
| Runtimeconfiguratie-SHA-256 | `c4ddef2350d174daee33787fede61307741a7b104e4412395d5a27365290d842` | `83ffbd21e60be511fd75a777ade86b6845242dc3f731c34a5af1991e1e70c7c7` |
| Actief releasepad | `/srv/sites/fabelpad-vps08-staging/releases/ec82395ba57904302bc4a93e71e5dba63def2950-45085866014-1` | `/srv/sites/fabelpad-vps08-production/releases/ec82395ba57904302bc4a93e71e5dba63def2950-45086060176-1` |
| Vorige kandidaat | `96ef208439a8b4af1dca985ed7192fb286686b13-45080430787-1` | `96ef208439a8b4af1dca985ed7192fb286686b13-45080609989-1` |
| Vorige configuratie-ID | `reader-20261122-stg` | `reader-20261122-prd` |
| Publieke HTTPS | Actief; `noindex, nofollow, noarchive` | Niet geactiveerd |

Ieder environment houdt uitsluitend `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Er zijn geen variabelen/secrets toegevoegd. Runner-, build- en apprechten blijven gescheiden; de twaalf root-owned adapters per doel, eigen locks en concurrency blijven behouden.

## Databases, authenticatie en privacy

Beide eigen databases hebben **12 migraties en 26 releases**. De dertien oude releasepayloads zijn bytegelijk behouden en dertien nieuwe releases bevatten alle drie niveaus. Staging behoudt **1 Auth-gebruiker / 1 gezin**, production **0 / 0**; gezins-/Auth-gegevens zijn niet herschreven en er zijn geen gebruikers aangemaakt. De nieuwe optionele profielvelden hebben dezelfde scope, toestemming, CAS en verwijderroute als bestaande leesvoortgang. Bewijs: [staging](deploy-evidence/complete-database-staging-2026-11-23.json) en [production](deploy-evidence/complete-database-production-2026-11-23.json); [Supabase-contract](../supabase/README.md).

Voorwaarden blijven `2026-11-22`, privacy `2026-11-22.1`. Eenmalige ouderverklaring bij registratie, echte sessie-/beheercontrole en afzonderlijke toestemming per online kinderprofiel blijven behouden. Auth-mail blijft **Supabase Custom SMTP → Resend** met zes cijfers; activeer geen Send Email Hook. De afzonderlijke API-servicemail wordt beheerd via `/studio/email`, templates via `/studio/email/templates`; een werkende SMTP-koppeling bewijst geen API- of inboxacceptatie.

De bestaande lifecycle behoudt **7 dagen** voor onafgeronde onboarding, **30 dagen** voor vrijwillige verwijdering en **210 dagen** voor minimaal gehashte wisbewijzen. **Automatische 90-dageninactiviteitswissing blijft uit** totdat waarschuwingen en overgang zijn geaccepteerd. Back-ups maximaal **180 dagen** en gewone Stackmail-support maximaal **12 maanden na afsluiting** blijven bevestigd beleid; externe opschoning en een echte herstelproef worden niet als appcron geclaimd.

## Gebruik, herstel en acceptatiegrenzen

Ververs staging eenmaal. Maak geen bestaand account of profiel opnieuw aan en wis geen browsergegevens voor deze integratie. Nieuwe echte OTP-/Google-registratie, API-mailbezorging en de volledige ouderflow blijven afzonderlijke interactieve acceptatie. De publieke productieroute vereist de bestaande aparte vrijgave en haar eigen acceptatie.

De vorige procesgezonde combinatie is bron `96ef208439a8b4af1dca985ed7192fb286686b13`: staging `96ef208439a8b4af1dca985ed7192fb286686b13-45080430787-1` met `reader-20261122-stg`, production `96ef208439a8b4af1dca985ed7192fb286686b13-45080609989-1` met `reader-20261122-prd`. App en bijbehorende runtimeconfiguratie blijven samen behouden. Er is geen live rollback uitgevoerd.

Een kale terugkeer naar deze oude app is **geen functioneel veilige gezinsherstelroute zodra nieuwe velden zijn opgeslagen**: haar oude TypeScript-validator weigert `prefs.readingLevel`, `lastCompletedPicks` en `lastCompletedContentVersion`. Houd de additieve databasemigratie en alle onveranderlijke releases staan. Gebruik voor ouder-/gezinssynchronisatie een herstelbuild met compatibele validatie of een gecontroleerde vooruitreparatie; test bestaande snapshots en de volledige gebruikersflow vóór verkeer terugkeert. Verwijder geen nieuwe voorkeuren of routegeschiedenis om de oude validator te laten passen. Een health 200 bewijst uitsluitend procesliveness. Zonder vorige gezonde combinatie stopt een mislukte eerste installatie alleen de eigen app en verwijdert zij de eigen `current`-verwijzing.

Alle CI-, build- en activeringsclaims horen bij de bovenstaande applicatiecommit. Een latere documentatiecommit wordt niet als opnieuw gebouwd, getest of geactiveerd voorgesteld. Health heeft scope `process-liveness-only`, backend `configured-unverified`. Er is geen echte OTP-/Google-aanmelding, mailbezorging, native toestel-/emulatortest, TalkBack-/systeemlettertest, signing of Google Play-upload uitgevoerd. Een synthetische spraakstem bewijst geen hoorbare apparaatstem. De ongebruikte toegangsgrens heeft uitsluitend bronreview: de huidige App geeft geen `previewLimit` door.

Zie [release- en herstelprocedure](DG-VPS-08-TWEE-OMGEVINGEN.md), [gegevensstromen](PRIVACY-DATASTROMEN.md) en [supportprocedure](PRIVACY-SUPPORT-RUNBOOK.md). Hersteld verkeer vereist volledige dekking van latere verwijderingen en intrekkingen vanuit actuele afgeschermde informatie buiten het teruggezette domein, of het herstelpunt wordt geweigerd. De eerdere [readerrelease](deploy-evidence/reader-release-2026-11-22.json), [registratierelease](deploy-evidence/registration-release-2026-11-22.json) en oudere releasebewijzen blijven historische momentopnamen.
