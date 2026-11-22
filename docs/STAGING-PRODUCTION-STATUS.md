# Fabelpad — actuele status staging en production

Controledatum: **22 november 2026**. Actieve appbron: **`d2d8d3e3667d636ad6352bf8c6dca0108e7d2fd9`**, repository `fabelpad/platform`, integratiebranch `main`. Zie het [releasebewijs](deploy-evidence/faqage-release-2026-11-22.json) en de [validatie van de leeftijdslabels](VALIDATIE-LEEFTIJDSLABELS-2026-11-22.md).

**Beide appservices draaien de nieuwe versie en zijn boot-enabled.** Staging is bereikbaar op **[staging.fabelpad.nl](https://staging.fabelpad.nl)**. De productieapp draait op haar eigen loopbackpoort; **de publieke productieroute blijft uit** volgens de bestaande vrijgaveafspraak. Proxy, DNS, externe mailconfiguratie en andere applicaties zijn niet gewijzigd.

## Laatste wijziging

De doelgroepbadges zijn uit de marketinghero, leeshero en alle verhaalkaarten verwijderd. De kaarten behouden **5 delen**. Alleen het FAQ-antwoord in de productuitleg noemt de doelgroep: **“Fabelpad is bedoeld voor kinderen van ongeveer 3 tot 10 jaar.”** Ook de README en vrije Store-/promotie-instructies hebben geen leeftijdslabels. Verplichte Console-doelgroepkeuzes staan apart in het interne Play-invulblad.

De afzonderlijke native app had geen dergelijke labels en is niet gewijzigd. Er zijn geen juridische documentversies, accountregels, databases, oudercontroles, ondertekening of Play Console gewijzigd. De registratie- en profielverbeteringen uit bron 003 blijven behouden in de nieuwe app.

## Uitgevoerde controles

| Onderdeel | Bewijs | Resultaat en grens |
| --- | --- | --- |
| Schone bronbuild | [Lokale validatie](deploy-evidence/faqage-local-validation-2026-11-22.json); gitarchive, frozen lockfile, normale projectbuild | **PASS**, 41,4 seconden; Node 24.18.0, pnpm 11.25.0, Next 16.3.4; geïsoleerde lokale configuratie |
| Gerichte lokale schermcontrole | [Browserbewijs](deploy-evidence/faqage-local-browser-2026-11-22.json) | **39/39 PASS**, home en leesapp op desktop en mobiel; geen overflow of browserfouten |
| Verplichte webcontrole `verify` | [45075010480](https://github.com/fabelpad/platform/actions/runs/45075010480) | **SUCCESS** |
| Verplichte `Native Android-controles` | [45075010469](https://github.com/fabelpad/platform/actions/runs/45075010469) | **SUCCESS**; native bron ongewijzigd, geen ondertekende release of Play-upload |
| Stagingkandidaat / activering | [45076337234](https://github.com/fabelpad/platform/actions/runs/45076337234) / [45076570283](https://github.com/fabelpad/platform/actions/runs/45076570283) | Beide **SUCCESS**, kandidaataudit **PASS** |
| Productiekandidaat / activering | [45076551688](https://github.com/fabelpad/platform/actions/runs/45076551688) / [45076812862](https://github.com/fabelpad/platform/actions/runs/45076812862) | Beide **SUCCESS**, kandidaataudit **PASS** |
| Gezamenlijke release-/rechtenaudit | [Bewijs](deploy-evidence/faqage-activated-2026-11-22.json) | **PASS**, 0 failures/0 warnings; juiste app/configuratie en behoud van vorige combinatie |
| Publieke staging HTTP/TLS | [Bewijs](deploy-evidence/faqage-staging-public-2026-11-22.json) | **23/23 PASS**, normale certificaatcontrole, exacte SHA, headers en juridische hashes |
| Publieke staging desktop/mobiel | [Bewijs](deploy-evidence/faqage-staging-browser-2026-11-22.json) | **39/39 PASS**, FAQ, beide heroes en alle 13 verhaalkaarten gecontroleerd; geen mutatie-/account-/providerrequests |
| Bestaande omgevingen / routing | [Voorcontrole](deploy-evidence/faqage-host-before-2026-11-22.json), [eindaudit](deploy-evidence/faqage-activated-2026-11-22.json), [routing](deploy-evidence/faqage-routing-2026-11-22.json) | Zes bestaande services en gedeelde configuratie gelijk; stagingproxy en standaard-hostantwoorden behouden |

Er zijn voor deze tekstwijziging geen nieuwe permanente tests geschreven. De normale build voert de bestaande TypeScript-, content-, backend-, mail-, deploy- en nativecontractcontroles uit. De tijdelijke schermcontrole gebruikt een verse anonieme browser; zij verstuurt geen OTP/mail, volgt geen Google-login en verandert geen echte accountgegevens. Health heeft scope `process-liveness-only`, backend `configured-unverified`.

## Eigen omgevingen

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Supabase-account / project | fabelpad / `tlwfpivafcokcjyjwgmq` | Duindorpdoet / `aptprpkosqctwrzeetgs` |
| App-origin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Eigen doel / runner | `fabelpad-vps08-staging`, ID 21 | `fabelpad-vps08-production`, ID 22 |
| Appservice / loopback | `fabelpad-vps08-staging.service`, `127.0.0.1:4188` | `fabelpad-vps08-production.service`, `127.0.0.1:4189` |
| Actieve kandidaat | `d2d8d3e3667d636ad6352bf8c6dca0108e7d2fd9-45076337234-1` | `d2d8d3e3667d636ad6352bf8c6dca0108e7d2fd9-45076551688-1` |
| Configuratie-ID | `faqage-20261122-stg` | `faqage-20261122-prd` |
| Artefact-SHA-256 | `ade4ec285f8516f8a9d940d9362d2594bef9302d558b7d59a79a4933a98776f0` | `3148588bb854850dd82b8ce337156a8477a85f9cfa95dacefbb773d734032baa` |
| Vorige app/configuratie | `003670a…-45072508682-1` / `regprof-20261122-stg` | `003670a…-45072710965-1` / `regprof-20261122-prd` |
| Publieke HTTPS | Actief; `noindex, nofollow, noarchive` | Niet geactiveerd |

Ieder environment houdt dezelfde vier variabelen: `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Er zijn geen variabelen of secrets toegevoegd. Runner-, build- en apprechten blijven gescheiden en de twaalf root-owned adapters per doel zijn ongewijzigd.

## Behouden registratie, mail en privacy

De [registratie-/profielrelease 003](deploy-evidence/registration-release-2026-11-22.json) blijft de inhoudelijke basis: eenmaal verklaren bij registratie, veilig afronden na verificatie, directe doorgang voor een afgerond account en correcte verwerking van JSONB-profielantwoorden. De afzonderlijke toestemming voor ieder online kinderprofiel blijft vereist. De toen uitgevoerde 43 browsertests en 67 publieke stagingcontroles zijn historisch bewijs van die basis, geen opnieuw uitgevoerde aantallen voor deze tekstrelease.

Deze uitrol voert geen Supabase-migratie of gebruikerswijziging uit. De elf migraties, privacyversie 2026-11-22.1 en voorwaarden 2026-11-22 blijven behouden. De [laatste databasecontrole bij de registratierelease](deploy-evidence/registration-database-final-2026-11-22.json) legde staging 1 gebruiker / 1 geldig gezin / 1 aanvaarding en production 0 / 0 / 0 vast, met nul registratieproofs en geen teruggevulde verklaringen. Dat is geen nieuwe telling van deze uitrol.

Auth-mail blijft **Supabase Custom SMTP → Resend**, met de door de eigenaar bevestigde zescijferige OTP en overgenomen templates. Activeer geen Send Email Hook. De afzonderlijke API-servicemail wordt beheerd via `/studio/email`, templates via `/studio/email/templates`; echte bezorging volgt uit de eigen beheertest en wordt niet afgeleid uit deze schermcontrole.

Back-ups maximaal 180 dagen en gewone Stackmail-support maximaal 12 maanden na afsluiting zijn bevestigd beleid. De bestaande lifecycle houdt onvoltooide onboarding 7 dagen, handmatige verwijdering 30 dagen en minimaal wisbewijs 210 dagen. **Automatische 90-dageninactiviteitswissing blijft uit** tot waarschuwingen en overgang zijn geaccepteerd. Externe mailbox-/back-upopschoning en een echte herstelproef worden niet als appcron geclaimd. Zie [gegevensstromen](PRIVACY-DATASTROMEN.md), [privacyaanvulling](PRIVACY-AANVULLING-180-DAGEN.md) en [supportprocedure](PRIVACY-SUPPORT-RUNBOOK.md).

## Gebruik en herstel

Ververs staging eenmaal. Maak geen bestaand account of profiel opnieuw aan en wis voor deze tekstwijziging geen browsergegevens. Nieuwe echte OTP-/Google-registratie, API-mailbezorging en volledige ouderflow blijven afzonderlijke interactieve acceptatie; productie-HTTPS volgt de bestaande aparte vrijgaveprocedure.

De vorige 003-app en haar runtimeconfiguratie blijven voor herstel beschikbaar. Een rollback herstelt ook de oude leeftijdslabels en wijzigt geen database, Auth of SMTP. Er is geen live rollback uitgevoerd. Zie [release- en herstelprocedure](DG-VPS-08-TWEE-OMGEVINGEN.md). Eerdere [003](deploy-evidence/registration-release-2026-11-22.json)-, [538](deploy-evidence/privacy180-release-2026-11-22.json)- en [c1](deploy-evidence/loopback-release-2026-11-22.json)-bewijzen blijven historische momentopnamen. Hersteld verkeer vereist volledige dekking van latere verwijderingen en intrekkingen vanuit actuele afgeschermde informatie buiten het teruggezette domein, of het herstelpunt wordt geweigerd.
