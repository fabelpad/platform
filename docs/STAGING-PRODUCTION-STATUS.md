# Fabelpad — actuele status staging en production

Controledatum: **22 november 2026**. Actieve appbron: **`003670aad04ecdf761b21627d8624dea50403ae5`**, repository `fabelpad/platform`, integratiebranch `main`. Zie het [samenvattende releasebewijs](deploy-evidence/registration-release-2026-11-22.json) en de [inhoudelijke validatie](VALIDATIE-REGISTRATIE-PROFIEL-2026-11-22.md).

**Beide appservices draaien de nieuwe versie en zijn boot-enabled.** Staging is bereikbaar op **[staging.fabelpad.nl](https://staging.fabelpad.nl)**. De productieapp draait op haar eigen loopbackpoort; **de publieke productieroute blijft uit** volgens de bestaande vrijgaveafspraak. De uitrol heeft geen proxy, DNS, externe mailconfiguratie of andere applicaties gewijzigd.

## Wat is verholpen

- De 18+/ouderverklaring en voorwaardenkeuze worden bij registratie vastgelegd en na geverifieerde OTP- of Google-aanmelding afgerond. Een afgerond account krijgt deze keuzes bij inloggen of `/onboarding` niet opnieuw. Een tijdelijk mislukte afronding is herhaalbaar zonder nieuwe vinkjes. Ontbrekend/verlopen bewijs krijgt een expliciete fallback; historische verklaringen worden niet verzonnen.
- Een geldig opgeslagen kinderprofiel werd door de browser afgewezen wanneer PostgreSQL JSONB de objectsleutels anders ordende. De controle vergelijkt nu strikt de inhoud, met behoud van betekenisvolle arrayvolgorde. Een bestaande achtergebleven lokale wijzigingskopie kan herstellen zonder nieuw profiel of nieuwe toestemming. De bestaande staginggegevens zijn behouden.
- Website, leesapp en ouderomgeving tonen de echte dienst en echte inlogroutes. De bibliotheek heeft 13 gratis complete verhalen. Gesimuleerde abonnementen, ouderlogin en betaalmuren zijn uit de bereikbare gebruikersflow gehaald. Oude lokale opslag is behouden; interne historische sleutelnamen veranderen geen gebruikersgegevens.

De afzonderlijke toestemming voor ieder online kinderprofiel blijft vereist. Er is geen nieuwe Android-upload of Play-publicatie uitgevoerd.

## Uitgevoerde controles

| Onderdeel | Bewijs | Resultaat en grens |
| --- | --- | --- |
| Schone bronbuild | Exacte gitarchive; frozen lockfile; `bash scripts/local-build.sh` | **PASS**; Node 24.18.0, pnpm 11.25.0, Next 16.3.4; geïsoleerde lokale configuratie |
| Browserregressie | Productiebundel van dezelfde SHA, synthetische gegevens | **43/43 PASS**, 29,2 seconden |
| Verplichte webcontrole `verify` | [45070746885](https://github.com/fabelpad/platform/actions/runs/45070746885) | **SUCCESS** |
| Verplichte `Native Android-controles` | [45070746947](https://github.com/fabelpad/platform/actions/runs/45070746947) | **SUCCESS**; native bron ongewijzigd, geen upload |
| Stagingkandidaat / activering | [45072508682](https://github.com/fabelpad/platform/actions/runs/45072508682) / [45072723017](https://github.com/fabelpad/platform/actions/runs/45072723017) | Beide **SUCCESS**, afzonderlijke kandidaataudit **PASS** |
| Productiekandidaat / activering | [45072710965](https://github.com/fabelpad/platform/actions/runs/45072710965) / [45072894209](https://github.com/fabelpad/platform/actions/runs/45072894209) | Beide **SUCCESS**, afzonderlijke kandidaataudit **PASS** |
| Gezamenlijke release-/rechtenaudit | [Bewijs](deploy-evidence/registration-activated-2026-11-22.json) | **PASS**, 0 failures/0 warnings; beide app/configuratiecombinaties correct |
| Publieke staging HTTP/TLS | [Bewijs](deploy-evidence/registration-staging-public-2026-11-22.json) | **23/23 PASS**, normale certificaatcontrole, exacte SHA, headers en juridische hashes |
| Publieke staging mobiel | [Bewijs](deploy-evidence/registration-staging-public-smoke-2026-11-22.json) | **67/67 PASS**, zeven routes, geen browserfouten, geen mutatie-/providerrequests |
| Supabase na uitrol | [Finale alleen-lezen controle](deploy-evidence/registration-database-final-2026-11-22.json) | Beide **11 migraties**; staging 1 gebruiker / 1 geldig gezin / 1 acceptatie; production 0 / 0 / 0; nul registratieproofs en geen achteraf ingevulde verklaringen |
| Bestaande omgevingen / routing | [Hostaudit](deploy-evidence/registration-activated-2026-11-22.json), [routing](deploy-evidence/registration-routing-2026-11-22.json) | Zes bestaande services en gedeelde configuratie identiek; stagingproxy identiek; productie/default-hostantwoord behouden |

De [schone lokale controle](deploy-evidence/registration-local-validation-2026-11-22.json) omvat onder meer 51 Auth-, 27 registratie-SQL-, 36 ouder-API-, 48 AVG-beheer-API-, 89 deploy- en 19 Python-hostscenario’s. De openbare controles maken geen account aan, vragen geen OTP aan, volgen geen Google-login en bewijzen geen inboxbezorging. Een aanvankelijk te strikte homepage-locator in het controlescript is begrensd gecorrigeerd; appbron bleef gelijk. Zie het validatiedocument voor het behouden eerste rapport en de geslaagde herhaling.

## Eigen omgevingen

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Supabase-account / project | fabelpad / `tlwfpivafcokcjyjwgmq` | Duindorpdoet / `aptprpkosqctwrzeetgs` |
| App-origin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Eigen doel / runner | `fabelpad-vps08-staging`, ID 21 | `fabelpad-vps08-production`, ID 22 |
| Eigen appservice | `fabelpad-vps08-staging.service` | `fabelpad-vps08-production.service` |
| Loopback | `127.0.0.1:4188` | `127.0.0.1:4189` |
| Actieve kandidaat | `003670aad04ecdf761b21627d8624dea50403ae5-45072508682-1` | `003670aad04ecdf761b21627d8624dea50403ae5-45072710965-1` |
| Configuratie-ID | `regprof-20261122-stg` | `regprof-20261122-prd` |
| Artefact-SHA-256 | `299ed89254b1bdf72ebe43a69d4c595536b9f1baa268e2bcade496a606142bbb` | `c9667ca63b799c6fff634b8cf51a695fd75671b18691347bcd42281d606284cc` |
| Vorige app/configuratie | `538c6b7…-45061896274-1` / `privacy180-20261122-stg` | `538c6b7…-45062081153-1` / `privacy180-20261122-prd` |
| Publieke HTTPS | Actief; `noindex, nofollow, noarchive` | Niet geactiveerd |
| Auth / SMTP | E-mail en Google aan; Auto Confirm uit; Supabase Custom SMTP via Resend | Dezelfde inrichting, eigen project |
| Edge-versies | `email-admin` v3, `auth-email` v3, `account-maintenance` v2 | Dezelfde versies |

Ieder GitHub environment gebruikt uitsluitend `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Deze wijziging voegt geen variabelen of secrets toe. Build-, app- en runnerrechten blijven gescheiden. De healthscope is `process-liveness-only`, backend `configured-unverified`; volledige provideracceptatie wordt niet uit een HTTP200 afgeleid.

## Registratie, mail en privacy

De [elfde migratie en rechtencontrole](deploy-evidence/registration-supabase-live-2026-11-22.json) slaagt eerst op staging en daarna op production. Registratiebewijs is 30 minuten geldig, bevat uitsluitend gehashte verwijzingen en geeft vóór verificatie geen gezinsrechten. De private tabel heeft RLS en geen directe applicatierolrechten. Bestaande aanvaardingen blijven identiek. De gegroepeerde private-RLS-INFO is geen lijst losse tabelissues; de bestaande stagingwaarschuwing `auth_leaked_password_protection` is onveranderd en werd op production niet getoond.

Auth-mail blijft via **Supabase Custom SMTP → Resend**, met de door de eigenaar bevestigde zescijferige OTP en overgenomen templates. Activeer geen Send Email Hook. De afzonderlijke **Resend API-koppeling** voor applicatieservicemail beheert de bevoegde ouder via **Beheer → E-mailinstellingen** (`/studio/email`); alle templates staan op `/studio/email/templates`. De actuele sleutel-/bezorgstatus volgt uit de eigen beheertest en is niet uit SMTP of deze uitrol afgeleid. Geheimen gaan niet in broncode, GitHub-variabelen of chat. `info@dgwebservices.nl` blijft het beoogde eerste beheerdersadres per afzonderlijke projectidentiteit.

Privacyversie **2026-11-22.1** en voorwaarden **2026-11-22** blijven ongewijzigd. De eigenaar bevestigde back-ups maximaal 180 dagen, Stackmail, gewone supportmail maximaal 12 maanden na afsluiting, verwerkers-/doorgifteafspraken en Auth-templates. De app voert onvoltooide onboarding 7 dagen, handmatige accountverwijdering 30 dagen en minimaal wisbewijs 210 dagen via de lifecycle uit. **Automatische 90-dageninactiviteitswissing blijft uit** totdat waarschuwingen en overgang zijn geaccepteerd. Externe back-up-/mailboxopschoning en een echte herstelproef worden niet als uitgevoerde appcron geclaimd. Zie [privacyaanvulling](PRIVACY-AANVULLING-180-DAGEN.md), [gegevensstromen](PRIVACY-DATASTROMEN.md) en [supportprocedure](PRIVACY-SUPPORT-RUNBOOK.md).

## Gebruik en verdere acceptatie

1. Ververs **[staging.fabelpad.nl](https://staging.fabelpad.nl)**. Een bestaand afgerond account kiest **Inloggen**; maak hetzelfde account of profiel niet opnieuw aan en wis geen browsergegevens voor deze oplossing.
2. Een nieuwe ouder kiest **Ouderaccount maken**, geeft de twee registratiekeuzes eenmaal en verifieert met OTP of Google. De aparte kinderprofieltoestemming blijft onderdeel van het aanmaken van een online profiel.
3. Controleer de eigen Resend API-instellingen en echte testontvangst in Beheer. Nieuwe echte OTP-/Google-registratie, mailbezorging en de volledige ouderflow blijven interactieve acceptatie; de geslaagde synthetische en anonieme controles vervangen die niet.
4. Publieke productionvrijgave volgt de bestaande afzonderlijke vrijgaveprocedure na stagingacceptatie. De productieapp is bijgewerkt; een publiek werkende productiesite wordt nog niet geclaimd.

## Herstel en historisch bewijs

De vorige 538-app en bijbehorende runtimeconfiguratie blijven beschikbaar. Approllback draait de elfde databasewijziging, Auth, Vault of SMTP niet terug; de wijziging is additief. Een rollback brengt ook het oude registratie-/profielgedrag terug en is geen oplossing voor de gemelde fouten. Voer geen live rollback uit als test. Zie [exacte releaseprocedure](DG-VPS-08-TWEE-OMGEVINGEN.md).

De eerdere [538-release](deploy-evidence/privacy180-release-2026-11-22.json), [c1-loopbackrelease](deploy-evidence/loopback-release-2026-11-22.json) en andere bestaande bewijzen blijven herkenbare historische momentopnamen. Een herstelpunt mag pas gebruikersverkeer krijgen als alle latere verwijderingen en intrekkingen volledig zijn toegepast vanuit actuele afgeschermde informatie buiten het teruggezette domein, of het ongedekte herstelpunt wordt geweigerd.
