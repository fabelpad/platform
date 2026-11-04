# Fabelpad — website, webapp en native Android

> Historische prototypeoverdracht. De actuele implementatie, DG-runtime en verificatie staan in [PROJECTPROFIEL.md](PROJECTPROFIEL.md), [RUNBOOK.md](RUNBOOK.md) en [LOKALE-VALIDATIE.md](LOKALE-VALIDATIE.md).

Datum: 4 november 2026. Dit document beschrijft het prototype en de route naar de productie-implementatie op de eigen development-VPS. Broncode, bestaande illustraties, verhaalteksten en het mobiele starterproject horen bij dezelfde repository.

## Status en ontwerpbesluiten

| Onderdeel | Status | Betekenis |
| --- | --- | --- |
| Bestaande verhaalbibliotheek | Werkende logica | Dertien verhalen, vijf keuzes per verhaal, alle 416 routes aanwezig; de tien extra verhalen blijven behouden. |
| Website en internetapplicatie | Browserprototype | De bijgewerkte schermen worden door de hoofdrepository gebouwd. Lokale demohandelingen zijn geen productietransacties. |
| Android-schermpreview | Browserpreview | Toont ontwerp en flow. Dit is geen Android-runtime en bewijst geen native prestaties. |
| `mobile/` | Native prototypebroncode | Expo/React Native met native views, lokale profielen, routes en gebundelde content; geen WebView. |
| Supabase, Resend, billing en Play | Productie-opdracht | Niet op basis van dit document als geïmplementeerd beschouwen. De huidige Sites-cloudcode gebruikt D1 en eigen identity, geen Supabase. |

De frontend gaat direct naar de voorpagina; de verwijderde boekopening keert niet terug. In het prototype kan de demo direct zonder echte login worden geopend. Productie: ouderaccount via OTP, kindprofielen onder dat gezin; kinderen krijgen geen eigen e-mailaccount.

## Schermen en routes

| ID | Scherm | Website/web | Native broncode |
| --- | --- | --- | --- |
| W01 | Introductie en uitleg | Marketingwebsite, directe demo-CTA | Niet in kinderapp nodig |
| W02 | Verhaaloverzicht en voorbeeld | Verhalen, filters, openen | Bibliotheek |
| W03 | Pakketten en FAQ | Conceptmodel, geen vastgestelde prijzen | In ouderhoek voorbereiden |
| C01 | Kind kiezen/bewerken | Bestaande kindprofielen en ouderdashboard | `profiles` |
| C02 | Ontdekken | Bibliotheek, zoeken, favorieten | `library` |
| C03 | Hervatten | Bewaarde route per kind | Filter ‘Verder lezen’ |
| C04 | Lezen en keuzes | Reader, voorlezen, speelprent station | `reader`, native keuzes en apparaat-TTS |
| C05 | Einde en beloning | Bewaarde herinneringen en stempels | Eindpassage en `treasures` |
| P01 | Ouderomgeving | Profielen, instellingen, downloads en demo-abonnement | `parent`, lokale instellingen |
| P02 | Opslag- en synchronisatiestatus | Lokale demo; bestaande cloudcode blijft los staan | Lokaal bewaren/bezig/fout; cloud ontbreekt |
| B01 | Contentbeheer | Concept, controleren, publiceren en preview | Webbeheer is bron voor latere releases |

De native broncode is een bruikbaar beginpunt. De uitgebreidere stationsspeelprent, drag-/tapinteracties en Reanimated/Gesture Handler/Skia-laag moeten voor native verder worden gebouwd en op toestellen worden getest. De browserpreview en native broncode zijn geen pixel-voor-pixel-identieke runtime.

## Contentcontract en assets

`node scripts/export-native-content.mjs` haalt `getScene` en `getEnding` uit de bestaande TypeScript-broncode via `compileSource`. Per verhaal worden 31 bereikbare keuze-prefixen en 32 eindroutes geëxporteerd. Daardoor behoudt native de route-afhankelijke tekst; teksten worden niet samengevoegd tot één lineair verhaal.

De uitvoer `mobile/src/content.json` bevat `schemaVersion`, `contentVersion`, `parts`, `nameToken`, `stories` en assetchecksums. Iedere scène heeft `title`, `text` en twee `choices`; ieder einde heeft een titel, tekst en aandenken. De sleutel voor een route is de bestaande keuzevolgorde, bijvoorbeeld `010`. De kindnaam wordt pas bij weergave ingevuld op de token `__FABELPAD_CHILD__`.

`mobile/src/assets.ts` bevat letterlijke `require`-paden voor Metro. De 13 illustraties, het logo en de mascotte worden vanuit `public/` gekopieerd naar `mobile/assets/`. Checksums staan in de contentexport; de bronassets blijven behouden. Exporteer opnieuw na een repository-contentwijziging. Lokale concepten uit browserbeheer komen niet automatisch in de repository-export terecht.

Productiepublicatie moet onveranderlijke contentreleases gebruiken. Elk leesavontuur bevat minimaal `storyId`, `contentVersion`, `picks`, `updatedAt` en een revisie. Een begonnen verhaal blijft de oorspronkelijke release gebruiken. Een later verhaal aanpassen mag de eerdere route niet stilzwijgend veranderen. Bewaar oude releases of bouw een expliciete migratie met ouderkeuze. De native demo blokkeert bij een gewijzigde contenthash en biedt een bevestigde herstart; hij simuleert geen volledige releasearchivering.

## Opslag en synchronisatie

De huidige web-demo-opslag en `mobile/` zijn gescheiden. Native gebruikt AsyncStorage voor uitsluitend de lokale demo. Geen API-secret, refresh token of persoonlijke productiegegevens toevoegen aan deze onbeveiligde demostore.

Voor productie:

1. Maak een opslagadapter die verhaal- en keuzelogica van browser/React Native scheidt. Native gebruikt duurzame lokale opslag; authenticatiesecrets krijgen platformgeschikte beveiligde opslag.
2. Bewaar een keuze eerst lokaal. Een netwerkfout blokkeert het lezen niet. Voeg een idempotente wachtrij toe met gevalideerde revisies en een zichtbare foutstatus.
3. Eén ouder bezit het gezin; kindrecords en voortgang zijn alleen via dat gezin toegankelijk. Supabase RLS moet die eigendom afdwingen, ook wanneer een client een ander kind-ID meestuurt.
4. Wisselen van gezin of uitloggen mag geen data van het vorige gezin tonen. Wis geen nog niet gesynchroniseerde versie zonder herstel- of bewaaroptie.
5. Dezelfde route op twee toestellen kan samen worden afgehandeld. Afwijkende keuzes zijn een conflict; bewaar beide versies en laat bewust kiezen. Voeg nooit tegenstrijdige takken samen.
6. De API en databaseschema's blijven werken voor de huidige en vorige ondersteunde appversie. Mobiele updates worden niet tegelijk geïnstalleerd.

## Ouderaccount, mails en abonnementen

Gebruik Supabase Auth voor ouder-OTP en Resend via custom SMTP of een server-side mailhook. De Resend API-key en Supabase secret/service key horen uitsluitend op de server. De app mag een Supabase publishable key bevatten als tabel- en opslagtoegang door RLS wordt begrensd. Werk met afzonderlijke staging-/productieprojecten of aantoonbaar gescheiden omgevingen.

Het voorgestelde gratis model is één zelfgekozen volledig verhaal en twee eerste delen als preview. Pakketten, prijzen, profielgrenzen en foundersvoorwaarden zijn nog niet definitief vastgesteld; houd die servergestuurd configureerbaar. De demo activeert geen echte aankoop en verstuurt geen e-mail.

Verbind Android-aankopen aan Google Play Billing, tenzij een toepasselijk alternatief programma bewust wordt gekozen. Valideer aankopen op de server en leg toegangsrechten per gezin vast. Web- en Play-aankopen gebruiken dezelfde rechtenlaag. Verwerk aankoopherstel, verlengen, annuleren, verlopen en terugbetaling. Een clientvlag ‘premium’ is geen autorisatie. Een gewone opzegging en het einde van al betaalde toegang zijn verschillende gebeurtenissen.

Vul Google Play-doelgroep, Data safety, privacyverklaring en contentrating in met werkelijk gedrag van alle gebruikte SDK's. Richt een volwassen oudercontrole in vóór betalingen en accountbeheer. De demoknop of een rekensom is geen productie-authenticatie. Start accountverificatie en accountafhankelijke Play-testvereisten vroeg.

## Bouw- en releasecontract voor de VPS

De Sites-runtime blijft een prototypehost. Zet voor de eigen VPS een ondersteunde Next.js-serverbuild/Dockerfile en deploymentconfiguratie op. De bestaande Vinext/Workers-configuratie is niet automatisch een productie-Dockerimplementatie.

| Stap | Web/API | Android |
| --- | --- | --- |
| Geteste commit naar staging | Docker-image met commit-tag; migraties gecontroleerd toepassen | Aparte staging/demo-app, met stagingbackend |
| Productiekandidaat | Productie-image vastleggen; achterwaarts compatibele backend | Productieconfiguratie, nieuw versionCode, ondertekende AAB |
| Testdistributie | Bestaande API blijft beschikbaar | Interne/gesloten Play-test van productie-AAB |
| Vrijgave | Bekende image uitrollen en gezondheid controleren | Dezelfde geteste productie-AAB promoveren, review en rollout volgen |

Een Android-stagingbuild met ingebakken stagingbackend mag niet als productieversie worden gepromoveerd. Maak aparte application-ID's als staging en productie naast elkaar moeten staan; Play-distributie van een apart ID vraagt een aparte Play-app. Leg de definitieve ID vóór eerste publicatie vast. De voorgestelde ID in `mobile/app.config.ts` kan nog veranderen.

Runner: ondersteunde Linux-versie, Node volgens Expo SDK, passende JDK, Android SDK/NDK waar nodig, Gradle wrapper uit het gegenereerde Android-project. Geen desktop-Android Studio nodig voor de headless CI-build. Een buildcontainer mag de buildomgeving leveren; Google Play ontvangt de AAB, niet de Docker-image.

Bewaar upload-keystore/wachtwoorden en Play API-identiteit buiten Git en buiten de app. Play App Signing beheert de distributieondertekening; de runner gebruikt de upload key. Configureer API-rechten voor het specifieke pakket. Uploadsucces is niet hetzelfde als goedgekeurd en gepubliceerd. Houd commit, image digest, contentrelease en Android-versionCode aan elkaar gekoppeld.

Deze overdracht bevat bewust geen workflow die zonder project-ID's, registries, runners, secrets en signingkeys een productiepublicatie zou suggereren. Codex stelt die concrete workflows op na inspectie van jullie VPS/repository en controleert de uitvoer daadwerkelijk.

## Acceptatie en oplevervolgorde

1. Bouw één verhaal van begin tot einde op echte Android-hardware: profiel kiezen, lezen, keuzes, sluiten/heropenen en beloning. Geen terugkerende boekopening.
2. Verifieer iedere keuze-prefix en afloop tegen dezelfde webcontent; test terugkeren bij deel 1–5 en na voltooiing. Dubbele taps geven maximaal één keuze.
3. Twee kinderen hebben verschillende favorieten, routes en stempels. Een profielwissel wist niets. Toevoegen, bewerken en herladen werken; wissen vraagt bevestiging.
4. Vliegtuigmodus, app afsluiten/heropenen, terugknop, rotatie/tablet, fontschaling, verminderde beweging en audio-onderbreking zijn echte toesteltests.
5. Meet stabiele 60 fps als doel op een afgesproken gewone Android-telefoon in een releasebuild. Controleer beelden, geheugen en laden; claim geen meetresultaat op basis van een browserpreview.
6. Test opslagfouten en sessieherstel, verlopen auth en herhaalde sync. Een mislukte bewaaractie wordt nooit ‘geslaagd’ genoemd.
7. Controleer concept/publicatie, ontbrekende hoofdstukken, oude contentversies en conflict tussen twee toestellen. Publiceer daarna de overige verhalen.
8. Sluit als laatste echte toegangsrechten, Play Billing en e-mails aan; test sandboxaankoop/herstel/opzegging en API-isolatie voordat gezinnen productiegegevens gebruiken.

## Verificatiegrenzen

De contentexport is in deze sessie uitgevoerd en controleerde alle 403 scènes en 416 eindes plus de vijftien gekoppelde assets. De mobiele dependency-, TypeScript- en Metro-controles worden afzonderlijk in `mobile/VALIDATIE.md` vastgelegd. Een JavaScript-export is geen ondertekende native build. Er zijn geen Play-publicatie, werkende Supabase-koppeling of native prestatiemetingen uitgevoerd.

Officiële referenties: [Expo SDK58](https://expo.dev/changelog/sdk-58), [lokale Expo-builds](https://docs.expo.dev/build-reference/local-builds/), [React Native performance](https://reactnative.dev/docs/performance), [Supabase React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Android signing](https://developer.android.com/studio/publish/app-signing), [Play API](https://developers.google.com/android-publisher/getting_started), [Families](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en), [Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).
