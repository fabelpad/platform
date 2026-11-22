# Validatie verhaallezer — 22–23 november 2026

Beoordeelde applicatiecommit: `96ef208439a8b4af1dca985ed7192fb286686b13` in `fabelpad/platform`.

Overdracht: **23 november 2026, Europe/Amsterdam**. De uitvoering startte op 22 november; bewijsbestanden houden hun start-/UTC-datum `2026-11-22`. De lokale build, verplichte CI, kandidaatbuilds en activeringen zijn geslaagd. Beide eigen appservices draaien de exacte bovenstaande commit en zijn boot-enabled. **Staging is publiek bereikbaar; de publieke productieroute blijft uit.** Zie het [definitieve releasebewijs](deploy-evidence/reader-release-2026-11-22.json).

## Gewijzigd gedrag

Web en de native Android-lezer gebruiken één verticale leesvolgorde: compacte bovenbalk, bestaande heroafbeelding, voortgang en volledige verhaaltekst, **Wat kies jij?**, speelprent of gewone keuzeknoppen, voorleesbediening en opslagstatus. Ook desktop heeft één centrale leeskolom. De hero blijft zichtbaar in beide modi; de speelprent staat onder de tekst, zonder eigen verticale scroller of vaste speelkolom.

De uitlegmelding en de knop naar de speelprent zijn verwijderd. De modusknop staat bij het keuzegedeelte en verschijnt alleen op de eerste twee speelbare stationsonderdelen. Een moduswissel behoudt onderdeel, keuzes, opslag, voorlezen, focus en scrollpositie. Een minimale hoogte op de bestaande inhoudscontainer voorkomt dat de kortere leesmodus de scrollpositie afkapt; die tijdelijke hoogte vervalt bij een echte keuze of herstart.

Een voltooide spelhandeling verwerkt de keuze eenmaal. Wisselen van modus en sluiten annuleren onafgemaakte callbacks. Een volgende passage, eindscène en herstart beginnen bovenaan; web focust de nieuwe inhoudstitel met `preventScroll`. Native gebruikt de bestaande scrollcontainer en de toegankelijkheidsfocus op de nieuwe passagetitel. Hervatten en het herstellen van de achterliggende paginascroll blijven behouden.

Verhaalinhoud, keuzeroutes, eindes, aandenkens, profielen, verhaalgeheugen, versies, opslag en authenticatie zijn behouden. Er zijn geen nieuwe illustraties, speelonderdelen, toegangsregels, betalingen of abonnementen toegevoegd. Er is geen database- of juridische documentversie gewijzigd en geen echte registratie of e-mail gestart tijdens deze controles.

## Bestanden

| Bestand | Wijziging |
| --- | --- |
| `src/StoryReader.tsx` | Hero boven de tekst; speelprent en modusknop bij de keuzes; focus, scrollreset, herstart en behoud van de moduspositie. |
| `src/reader.css`, `src/reader-extended.css` | Centrale leeskolom, responsive hero en keuzegedeelte, leesbare tekst en bedieningsknoppen van minimaal 44 × 44 px. |
| `src/StationPlayScene.tsx`, `src/story-play.css` | Synchrone timeropruiming bij ontkoppelen, bescherming tegen late/dubbele callbacks, instructiefocus zonder scrollsprong en voldoende aanraakgebied. |
| `mobile/App.tsx` | Dezelfde inhoudsvolgorde in de native lezer, bestaande native speelprent, scroll-/focusherstel, modusbehoud en readerbediening van minimaal 48 × 48 dp. |
| `tests/browser/reader.spec.ts` | Gerichte regressies voor volgorde, responsive gedrag, beide spelroutes, annulering, voortgang, focus, scroll en voorlezen. |

## Uitgevoerde lokale controles

De schone build gebruikt een afzonderlijke werkmap uit `git archive` van de volledige bovenstaande commit, Node **24.18.0**, pnpm **11.25.0** en Next.js **16.3.4**. De configuratie stond op lokale gegevens zonder echte Supabase-, Resend- of accountacties.

| Controle | Resultaat |
| --- | --- |
| `pnpm install --frozen-lockfile` en `bash scripts/local-build.sh` in de schone werkmap | **Geslaagd; 44,1 seconden.** De normale configuratie-, type-, content-, backend-, e-mail-, deploy- en nativecontroles en de productiebuild zijn uitgevoerd. |
| `pnpm test:browser tests/browser/reader.spec.ts --reporter=line` | **7/7 geslaagd; 19,1 seconden.** |
| `pnpm test:browser --reporter=line` | **50/50 geslaagd; 49,8 seconden.** |
| Browserbreedtes 360, 390, 768 en 1440 px | DOM- en zichtbare volgorde, hero, tekst van minimaal 16 px, knoppen, één verticale scroller en geen horizontale overflow gecontroleerd. |
| Stationspel, beide eerste keuzeroutes en beide spoorwissels | Taak moet eerst worden uitgevoerd; herhaald tikken verwerkt iedere keuze eenmaal; het juiste verhaalvervolg blijft bewaard. |
| Moduswissel en sluiten tijdens de vertrekactie, op beide speelbare onderdelen | Geen late keuze of voortgangswijziging; heropenen hervat het bewaarde onderdeel. |
| Volgende passage, overgang van deel 2 naar 3, einde en herstart | Nieuwe inhoudstitel krijgt focus en de lezer blijft bovenaan; geen lege speelcontainer of overbodige modusknop. |
| Grotere tekst en minder beweging | Browserinstellingen getest; tekst blijft bruikbaar. De annuleringscontroles zijn ook met gewone animaties uitgevoerd. |
| Voorlezen, pauzeren, hervatten, moduswissel en geluid uit | Getest met een synthetische lokale Nederlandse spraakstem; een moduswissel herstart de spraak niet. Dit bewijst geen daadwerkelijk hoorbare apparaatstem. |
| Sluiten en heropenen | Keuzes en verhaalversie blijven behouden; body-scrollvergrendeling en achterliggende paginascroll worden hersteld. De tijdelijke browser-server is gestopt. |

De gevonden browserclamp van 24/52/47/32 px bij de vier breedtes is verholpen. De oorspronkelijke strikte scroll- en focusasserties zijn ongewijzigd opnieuw geslaagd. Lokale screenshots van 390 en 1440 px zijn visueel bekeken: hero en tekst staan in dezelfde centrale kolom, met de speelprent daaronder.

De conditionele toegangsgrens heeft **alleen bronreview** gehad. De huidige productie-App geeft geen `previewLimit` door, waardoor die tak niet via de echte routes bereikbaar is. Er is geen testhook of nieuwe toegangslimiet toegevoegd. De bestaande tak gebruikt dezelfde directe mount, scrollreset en focusbare inhoudstitel; er wordt geen runtimecontrole daarvan geclaimd.

Bewijs: [lokale validatie](deploy-evidence/reader-local-validation-2026-11-22.json) en [webbronreview](deploy-evidence/reader-web-review-2026-11-22.json).

## Native Android

Met Node **24.18.0**, React Native **0.88.1** en Expo **58.0.26** zijn `npm run check --prefix mobile`, `npm run test:runtime --prefix mobile` en de productie-export via `expo export --platform android` geslaagd. De export bevat 1.135 modules en 15 assets. De bestaande native speelprent voor de eerste twee stationsonderdelen is behouden; er is geen WebView toegevoegd.

De runtimecontroles dekken onder meer de twee speltaken, vereiste handelingen, dubbele tikken, het ongeldig maken van vertraagde callbacks, hervatten per profiel en verhaalversie en opslagfouten. Native scroll- en focuslogica en de bescherming tegen scrollclamping zijn tevens in de bron beoordeeld.

De verplichte native CI heeft daarna de echte Android-releasevariant gebouwd zonder uploadsleutel. Het gedownloade GitHub-artefact en het productie-AAB zijn onafhankelijk gecontroleerd: ZIP-CRC en GitHub-digest kloppen, `bundletool validate` slaagt, het pakket is `nl.fabelpad.app`, versie **1.0.0 (1)**, target SDK **36**, min SDK **24**. Beide ABI's (`arm64-v8a`, `x86_64`) en alle 44 native libraries voldoen aan de gecontroleerde 16-KiB-ELF-/bundle-alignment. De AAB-SHA-256 is `8ef99affc863f1901b480112a8c11488f2682d7188bf73a142a4d38bc7af052e`.

`adb devices` vond geen aangesloten toestel. Er is **geen toestel-, emulator-, TalkBack-, grote systeemletter- of hoorbare offline-spraaktest** uitgevoerd. De geslaagde Gradle-build en bundle-inspectie bewijzen geen daadwerkelijke native weergave of toestelwerking. Signing, pakketnaam en versie zijn voor deze wijziging niet aangepast; het controle-AAB is **niet ondertekend en niet naar Google Play geüpload**.

Bewijs: [native validatie](deploy-evidence/reader-native-validation-2026-11-22.json) en [onafhankelijke native CI-/AAB-inspectie](deploy-evidence/reader-native-ci-2026-11-22.json).

## CI en uitgevoerde uitrol

| Stap | Status |
| --- | --- |
| [Web-CI 45079196385](https://github.com/fabelpad/platform/actions/runs/45079196385) op commit `96ef208439a8b4af1dca985ed7192fb286686b13` | **SUCCESS**. |
| [Native Android-CI 45079196444](https://github.com/fabelpad/platform/actions/runs/45079196444) op dezelfde commit | **SUCCESS**; ongetekend productie-AAB onafhankelijk gevalideerd, geen Play-upload. |
| Staging: [kandidaat 45080430787](https://github.com/fabelpad/platform/actions/runs/45080430787) → [activering 45080612720](https://github.com/fabelpad/platform/actions/runs/45080612720) | Beide **SUCCESS**; kandidaat `96ef208439a8b4af1dca985ed7192fb286686b13-45080430787-1`, configuratie `reader-20261122-stg`. |
| Production: [kandidaat 45080609989](https://github.com/fabelpad/platform/actions/runs/45080609989) → [activering 45080849171](https://github.com/fabelpad/platform/actions/runs/45080849171) | Beide **SUCCESS**; kandidaat `96ef208439a8b4af1dca985ed7192fb286686b13-45080609989-1`, configuratie `reader-20261122-prd`. |
| [Gezamenlijke release-/rechtenaudit](deploy-evidence/reader-activated-2026-11-22.json) | **PASS, 0 fouten en 0 waarschuwingen**. Beide services actief/boot-enabled, exacte SHA-health en gekoppelde app/runtimeconfiguratie; vorige gezonde `d2d8d3e`/`faqage`-combinaties behouden. |
| Publieke staging: [HTTP/TLS](deploy-evidence/reader-staging-public-2026-11-22.json) en [browser](deploy-evidence/reader-staging-browser-2026-11-22.json) | **23/23 HTTP/TLS- en 116/116 browsercontroles PASS**; alleen-lezen, geen echte Auth- of mailhandelingen. |
| [Bestaande omgevingen en routing](deploy-evidence/reader-routing-2026-11-22.json) | Zes bestaande services, gedeelde configuratie, stagingproxy en standaard-hostantwoorden behouden. Productie blijft intern op loopback; haar publieke route is niet geactiveerd. |

De vorige gezonde app/configuratie is staging `d2d8d3e3667d636ad6352bf8c6dca0108e7d2fd9-45076337234-1` / `faqage-20261122-stg` en production `d2d8d3e3667d636ad6352bf8c6dca0108e7d2fd9-45076551688-1` / `faqage-20261122-prd`. Er is geen live rollback uitgevoerd. Een rollback herstelt de vorige readerlayout en behoudt de leeftijdsvrije presentatie buiten de FAQ. Zie de [release-/herstelprocedure](DG-VPS-08-TWEE-OMGEVINGEN.md).

Alle CI- en deploymentclaims horen bij de genoemde applicatiecommit. Een latere documentatiecommit is geen opnieuw gebouwde of geactiveerde app en krijgt hier geen impliciete CI-goedkeuring. Health bewijst procesliveness (`process-liveness-only`, backend `configured-unverified`), geen echte OTP-/Google-, mail- of gezinsacceptatie. Die interactieve acceptatie en native toestelcontrole blijven afzonderlijke stappen.
