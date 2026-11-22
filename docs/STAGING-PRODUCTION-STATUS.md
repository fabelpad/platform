# Fabelpad — actuele status staging en production

Controledatum: **23 november 2026, Europe/Amsterdam**. Actieve appbron: **`96ef208439a8b4af1dca985ed7192fb286686b13`**, repository `fabelpad/platform`, integratiebranch `main`. De uitvoering startte op 22 november; bewijsbestandsnamen houden hun start-/UTC-datum. Zie het [releasebewijs](deploy-evidence/reader-release-2026-11-22.json) en de [readervalidatie](VALIDATIE-VERHAALLEZER-2026-11-22.md).

**Beide appservices draaien de nieuwe versie en zijn boot-enabled.** Staging is bereikbaar op **[staging.fabelpad.nl](https://staging.fabelpad.nl)**. De productieapp draait op haar eigen loopbackpoort; **de publieke productieroute blijft uit** volgens de bestaande vrijgaveafspraak. Proxy, DNS, externe mailconfiguratie en andere applicaties zijn niet gewijzigd.

## Laatste wijziging

De verhaallezer gebruikt op web en native Android de volgorde **hero → volledige verhaaltekst → Wat kies jij? → speelprent of keuzeknoppen → voorlezen/opslagstatus**. Desktop heeft dezelfde centrale kolom. De uitlegcontainer is verwijderd; de modusknop staat bij de keuzes. Moduswisselen behoudt focus, scroll, voortgang en voorlezen. Een keuze verwerkt eenmaal, annuleert oude spelcallbacks en opent de nieuwe passage bovenaan met focus op de inhoudstitel. Eindscène, herstart en hervatten volgen dezelfde opslag- en navigatielogica.

De native reader is eveneens aangepast en bouwt in CI als productievariant; het ongetekende AAB is onafhankelijk geïnspecteerd. Er is geen toestel-/emulatortest, ondertekening of Play-upload uitgevoerd. Verhaalinhoud, illustraties, keuzes, data, authenticatie, toegang en juridische documentversies blijven behouden. De eerdere leeftijdsvrije presentatie blijft intact: alleen de FAQ geeft een globale doelgroepindicatie. De registratie- en profielverbeteringen uit bron 003 blijven behouden.

## Uitgevoerde controles

| Onderdeel | Bewijs | Resultaat en grens |
| --- | --- | --- |
| Schone bronbuild | [Lokale validatie](deploy-evidence/reader-local-validation-2026-11-22.json); gitarchive van exacte app-SHA, frozen lockfile, normale projectbuild | **PASS**, 44,1 seconden; Node 24.18.0, pnpm 11.25.0, Next 16.3.4; geïsoleerde lokale configuratie |
| Gerichte reader / volledige browsersuite | [Lokale validatie](deploy-evidence/reader-local-validation-2026-11-22.json) | **7/7 en 50/50 PASS**; 360/390/768/1440 px, grotere tekst, minder beweging, beide speelroutes, annulering, scroll/focus, hervatten en synthetisch voorlezen |
| Verplichte webcontrole `verify` | [45079196385](https://github.com/fabelpad/platform/actions/runs/45079196385) | **SUCCESS** |
| Verplichte `Native Android-controles` | [45079196444](https://github.com/fabelpad/platform/actions/runs/45079196444), [AAB-inspectie](deploy-evidence/reader-native-ci-2026-11-22.json) | **SUCCESS**; echt ongetekend productie-AAB gevalideerd, geen Play-upload of toesteltest |
| Stagingkandidaat / activering | [45080430787](https://github.com/fabelpad/platform/actions/runs/45080430787) / [45080612720](https://github.com/fabelpad/platform/actions/runs/45080612720) | Beide **SUCCESS**, [kandidaataudit PASS](deploy-evidence/reader-staging-candidate-2026-11-22.json) |
| Productiekandidaat / activering | [45080609989](https://github.com/fabelpad/platform/actions/runs/45080609989) / [45080849171](https://github.com/fabelpad/platform/actions/runs/45080849171) | Beide **SUCCESS**, [kandidaataudit PASS](deploy-evidence/reader-production-candidate-2026-11-22.json) |
| Gezamenlijke release-/rechtenaudit | [Bewijs](deploy-evidence/reader-activated-2026-11-22.json) | **PASS**, 0 failures/0 warnings; juiste app/configuratie en behoud van vorige combinatie |
| Publieke staging HTTP/TLS | [Bewijs](deploy-evidence/reader-staging-public-2026-11-22.json) | **23/23 PASS**, normale certificaatcontrole, exacte SHA, headers en juridische hashes |
| Publieke staging browser | [Bewijs](deploy-evidence/reader-staging-browser-2026-11-22.json) | **116/116 PASS**; alleen-lezen, geen echte mutatie-/account-/providerhandelingen |
| Bestaande omgevingen / routing | [Voorcontrole](deploy-evidence/reader-host-before-2026-11-22.json), [eindaudit](deploy-evidence/reader-activated-2026-11-22.json), [routing](deploy-evidence/reader-routing-2026-11-22.json) | Zes bestaande services en gedeelde configuratie gelijk; stagingproxy en standaard-hostantwoorden behouden |

De normale build voert TypeScript-, content-, backend-, mail-, deploy- en nativecontractcontroles uit. De zeven nieuwe permanente readerregressies gebruiken alleen synthetische apparaatdata. De publieke controle gebruikt een verse anonieme browser; zij verstuurt geen OTP/mail, volgt geen Google-login en verandert geen echte accountgegevens. De conditionele toegangsgrens kreeg alleen bronreview: de huidige App geeft geen `previewLimit` door. Health heeft scope `process-liveness-only`, backend `configured-unverified`. De CI-resultaten gelden voor de applicatiecommit; een latere documentatiecommit wordt niet als gebouwd of geactiveerd voorgesteld.

## Eigen omgevingen

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Supabase-account / project | fabelpad / `tlwfpivafcokcjyjwgmq` | Duindorpdoet / `aptprpkosqctwrzeetgs` |
| App-origin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Eigen doel / runner | `fabelpad-vps08-staging`, ID 21 | `fabelpad-vps08-production`, ID 22 |
| Appservice / loopback | `fabelpad-vps08-staging.service`, `127.0.0.1:4188` | `fabelpad-vps08-production.service`, `127.0.0.1:4189` |
| Actieve kandidaat | `96ef208439a8b4af1dca985ed7192fb286686b13-45080430787-1` | `96ef208439a8b4af1dca985ed7192fb286686b13-45080609989-1` |
| Configuratie-ID | `reader-20261122-stg` | `reader-20261122-prd` |
| Artefact-SHA-256 | `4719abf77b2b3114365882e3dd22a157253ecb0c26c5031681e8fb50a12ffd73` | `6fcd95963d51bde10bfedd36ba9893e3ab1af9f3da380ef3ed21da81fe09731e` |
| Vorige app/configuratie | `d2d8d3e…-45076337234-1` / `faqage-20261122-stg` | `d2d8d3e…-45076551688-1` / `faqage-20261122-prd` |
| Publieke HTTPS | Actief; `noindex, nofollow, noarchive` | Niet geactiveerd |

Ieder environment houdt dezelfde vier variabelen: `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Er zijn geen variabelen of secrets toegevoegd. Runner-, build- en apprechten blijven gescheiden en de twaalf root-owned adapters per doel zijn ongewijzigd.

## Behouden registratie, mail en privacy

De [registratie-/profielrelease 003](deploy-evidence/registration-release-2026-11-22.json) blijft de inhoudelijke basis: eenmaal verklaren bij registratie, veilig afronden na verificatie, directe doorgang voor een afgerond account en correcte verwerking van JSONB-profielantwoorden. De afzonderlijke toestemming voor ieder online kinderprofiel blijft vereist. De toen uitgevoerde 43 browsertests en 67 publieke stagingcontroles zijn historisch bewijs van die basis, geen opnieuw uitgevoerde aantallen voor deze readerrelease.

Deze uitrol voert geen Supabase-migratie of gebruikerswijziging uit. De elf migraties, privacyversie 2026-11-22.1 en voorwaarden 2026-11-22 blijven behouden. De [laatste databasecontrole bij de registratierelease](deploy-evidence/registration-database-final-2026-11-22.json) legde staging 1 gebruiker / 1 geldig gezin / 1 aanvaarding en production 0 / 0 / 0 vast, met nul registratieproofs en geen teruggevulde verklaringen. Dat is geen nieuwe telling van deze uitrol.

Auth-mail blijft **Supabase Custom SMTP → Resend**, met de door de eigenaar bevestigde zescijferige OTP en overgenomen templates. Activeer geen Send Email Hook. De afzonderlijke API-servicemail wordt beheerd via `/studio/email`, templates via `/studio/email/templates`; echte bezorging volgt uit de eigen beheertest en wordt niet afgeleid uit deze schermcontrole.

Back-ups maximaal 180 dagen en gewone Stackmail-support maximaal 12 maanden na afsluiting zijn bevestigd beleid. De bestaande lifecycle houdt onvoltooide onboarding 7 dagen, handmatige verwijdering 30 dagen en minimaal wisbewijs 210 dagen. **Automatische 90-dageninactiviteitswissing blijft uit** tot waarschuwingen en overgang zijn geaccepteerd. Externe mailbox-/back-upopschoning en een echte herstelproef worden niet als appcron geclaimd. Zie [gegevensstromen](PRIVACY-DATASTROMEN.md), [privacyaanvulling](PRIVACY-AANVULLING-180-DAGEN.md) en [supportprocedure](PRIVACY-SUPPORT-RUNBOOK.md).

## Gebruik en herstel

Ververs staging eenmaal. Maak geen bestaand account of profiel opnieuw aan en wis voor deze readerwijziging geen browsergegevens. Nieuwe echte OTP-/Google-registratie, API-mailbezorging en volledige ouderflow blijven afzonderlijke interactieve acceptatie; productie-HTTPS volgt de bestaande aparte vrijgaveprocedure.

De vorige `d2d8d3e`-app en haar `faqage`-runtimeconfiguratie blijven samen voor herstel beschikbaar. Een rollback herstelt de vorige readerlayout, behoudt de leeftijdsvrije presentatie buiten de FAQ en wijzigt geen database, Auth of SMTP. Er is geen live rollback uitgevoerd. Zie [release- en herstelprocedure](DG-VPS-08-TWEE-OMGEVINGEN.md). Eerdere [d2d8d3e](deploy-evidence/faqage-release-2026-11-22.json)-, [003](deploy-evidence/registration-release-2026-11-22.json)-, [538](deploy-evidence/privacy180-release-2026-11-22.json)- en [c1](deploy-evidence/loopback-release-2026-11-22.json)-bewijzen blijven historische momentopnamen. Hersteld verkeer vereist volledige dekking van latere verwijderingen en intrekkingen vanuit actuele afgeschermde informatie buiten het teruggezette domein, of het herstelpunt wordt geweigerd.
