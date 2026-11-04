## Platformprototype — 4 november 2026

De bestaande Fabelpad-Site bevat nu vijf samenhangende onderdelen. De prototypebalk wisselt tussen website, webapp, Android-schermpreview, ouderomgeving en verhalenstudio. Directe links: `/?surface=website`, `/?surface=app`, `/?surface=android`, `/?surface=parents`, `/?surface=studio`. Een verhaal openen kan met `/?surface=app&story=station`.

De oorspronkelijke dertien verhalen, langere teksten, keuzes, speelprent en kindopslag zijn behouden. De nieuwe ouderomgeving beheert echte lokale kindprofielen, leesvoorkeuren, downloadbestanden en een nadrukkelijk gesimuleerd abonnementsmodel. Het gratis toegangsmodel is standaard uitgeschakeld zodat de bestaande demo compleet blijft; ouders kunnen het expliciet testen. De twee voorproefjes sluiten het gekozen gratis verhaal uit.

De verhalenstudio bewaart concepten afzonderlijk van gepubliceerde versies. Alleen gepubliceerde metadata en daadwerkelijk bewerkte hoofdstukvelden komen in de browserlezer terecht. Bestaande keuzepaden worden niet gewijzigd. Een geopende lezer houdt zijn publicatiemomentopname vast. Voor productie zijn blijvend gepinde contentversies en migratieregels nog nodig.

`mobile/` bevat een afzonderlijke echte Expo/React Native-prototypecodebasis, zonder WebView, met gebundelde verhaalroutes en afbeeldingen. `docs/` beschrijft de overdracht en verdere productieaansluitingen. De Android-weergave in de Site is een interactieve browserpreview; deze bewijst geen native framesnelheid of Android-installatie. De huidige browserdemo gebruikt geen echte Supabase-OTP, Resend-mails of Play Billing; de bestaande Sites/D1-accountcode blijft bewaard en is niet de beoogde VPS-backend.

Browserdownloads bewaren daadwerkelijk afbeeldingen en geserialiseerde verhaalroutes via CacheStorage. Navigatie-/account-HTML wordt uit privacyoverwegingen niet gecachet; koud starten van de webapp zonder internet is dus nog niet beschikbaar. Apparaatstemmen variëren; offline audio wordt niet beloofd.

Aanvullende controle: `node scripts/prototype-platform-check.mjs` controleert toegang, conceptisolatie, publicatievalidatie, tekstgroottecompatibiliteit, alle downloadroutes en foutopruiming.

---

# Fabelpad

Een interactief Nederlandstalig voorleesprototype voor kinderen van 4–8 jaar.

## Ontwerp en techniek

React 19, TypeScript, Vinext, Vite 8 en Motion 14, met een Cloudflare Worker en D1-database via Sites. De vormgeving gebruikt lokaal gebundelde variabele lettertypen, CSS-lagen, containerqueries, aanraakvriendelijke bediening en ondersteuning voor rustige bewegingen. Originele 3D-illustraties en het gekozen Fabelpad-logo zijn onderdeel van de broncode.

## Werkende onderdelen

- Dertien verhaalwerelden: de drie oorspronkelijke avonturen en tien nieuwe geïllustreerde verhalen, ieder met vijf uitgewerkte delen en vijf keuzemomenten.
- Alle 65 delen en alle eindes hebben minstens twee keer zoveel tekst als de vorige versie, met extra gebeurtenissen, kinderdialoog en natuurlijke alinea's. Iedere keuzeroute wordt vergeleken met de vastgelegde oorspronkelijke woordlengte; de kortste verhouding is ruim 2,22×.
- Keuzes veranderen de volgende scène; ieder avontuur heeft meerdere eindes en bijbehorende aandenkens. De naam van het actieve kind komt terug in het verhaal.
- Het prototype opent direct op de voorpagina met alle verhalen. Er is geen automatische boekopening, verhaalstart of profielmodal. Een verhaal wordt alleen geopend na een expliciete keuze.
- De knop **Demo inloggen** simuleert een demoaccount zonder e-mailadres, wachtwoord of ChatGPT-aanmelding. Deze knop is optioneel: de verhalen zijn ook direct te gebruiken. Alle prototypegegevens staan in de afzonderlijke apparaatomgeving `prototype-demo`; er worden geen accountgegevens opgehaald of cloudwijzigingen geschreven.
- De eerste twee delen van Het Verdwaalde Station zijn speelbaar. Help Dibbel door zijn kaartje met een sterrensticker te repareren, of open met de gouden sleutel een kastje. Stap vervolgens aan boord en bedien de wissel naar het muziekbos of de lantaarns. De trein beweegt de gekozen kant op.
- De handeling wordt pas na afronding één keer als bestaande verhaalkeuze opgeslagen. Herhaald tikken, een ouder-rerender en sluiten tijdens vertrek mogen geen extra of late keuze vastleggen. De leesmodus met gewone keuzeknoppen blijft beschikbaar.
- Een doorzoekbare boekenplank, categorieën, filter voor nieuwe verhalen en favorieten. De schatkist telt dynamisch alle dertien avonturen.
- Browservoorleesstem, pauzeren en hervatten wanneer de browser dit ondersteunt.
- Maximaal vijf kindprofielen met een eigen naam en avatar. Bij meerdere profielen verschijnt bij openen de profielkiezer.
- De bestaande serverbasis voor echte ouderaccounts en cloudsynchronisatie blijft in de broncode behouden. De huidige prototypingang gebruikt uitsluitend de lokale demo.
- In de apparaatdemo: maximaal vijf kindprofielen, keuzes, favorieten, instellingen, stempels en verhaalgeheugen. Echte ouderaccountgegevens blijven apart in de bestaande database en zijn niet zichtbaar in de demo.
- Verhaalgeheugen per kind: ontmoete vrienden, feitelijke keuzes, ontvangen schatten en open avonturen. Een terugkerend personage herkent gebeurtenissen uit daadwerkelijk gespeelde scènes.
- Eerdere apparaatprofielen kunnen na ouderlogin bewust worden meegenomen. Namen worden vooraf getoond; import wordt pas geclaimd na een geslaagde cloudopslag. Nieuwe kinderen beginnen leeg.
- Gelijktijdige wijzigingen aan verschillende kinderen kunnen veilig samengevoegd worden. Bij dezelfde kindgegevens of gewijzigde gezinsprofielen volgt een expliciete keuze; geen stil overschrijven.
- Een gastmodus met afzonderlijke apparaatopslag voor rondkijken. Gastgegevens worden niet automatisch aan een ouder gekoppeld.
- Ouderhoekje met geluid en rustige bewegingen.
- PWA-manifest, app-iconen en installatiehulp. De serviceworker bewaart uitsluitend openbare illustraties en statische bestanden; nooit accountpagina's, ouder-HTML of API-antwoorden.

## Prototypegrenzen

De verhalen zijn vooraf geschreven en worden niet live door AI gegenereerd. Betalingen en een eigen e-maillogin zijn niet aangesloten. De oudervraag voorkomt onbedoeld openen van instellingen; de server gebruikt de echte aangemelde ouderidentiteit. De prototypelink is zonder verplichte aanmelding toegankelijk. De serverroute voor echte gezinsgegevens blijft authenticatie en oudergebonden autorisatie vereisen.

Offline wijzigingen in een al geopend venster worden als een concept per ouder op het apparaat bewaard en na verbinding opnieuw aangeboden. Bij geblokkeerde browseropslag waarschuwt de app dat het venster open moet blijven. Volledig offline opnieuw openen toont een neutraal scherm. Synchronisatie werkt bij openen, terugkeren en opslaan; er is geen continue realtimeverbinding. Beschikbaarheid van voorleesstemmen en installatie hangt af van browser en hostingbeleid.

Geheugen komt alleen uit verhaalkeuzes, zonder persoonlijke eigenschappen van het kind af te leiden. Oudere opgeslagen routes worden herkenbaar gereconstrueerd; de app verzint daarvoor geen historische datum. Dit is de basis voor een latere verhalenagent.

## Ontwikkelen

Gebruik de package-manager-versie in package.json. `pnpm dev` start de meegeleverde Vinext-runtime; `pnpm build` voert de TypeScript-controle en productiebuild uit. De Sites-hostingconfiguratie staat in `.openai/hosting.json`, met D1-binding `DB`. Databasewijzigingen worden met `pnpm db:generate` gegenereerd en als onveranderlijke migraties in `drizzle/` opgenomen. De Sites-pakkethelper neemt deze mee bij publicatie.

`GET /api/family` en revision-checked `PUT /api/family` gebruiken uitsluitend de vertrouwde ouderidentiteit. Elke query is op ouder-ID begrensd. Een verouderd accounttabblad, ongeldige momentopname, te groot verzoek of conflicterende revisie wordt geweigerd. `/api/health` controleert alleen de aanwezigheid van de twee databasetabellen en bevat geen persoonsgegevens.

## Controle

De inhoudscontrole doorloopt alle 320 routes van de tien nieuwe verhalen: vijftig verschillende delen, twee keuzes per deel, voldoende tekst, merkbare gevolgen en geen invloed van toekomstige keuzes op eerdere scènes. De opslagcontrole doorloopt alle 416 routes van de volledige catalogus, inclusief geheugen en een gezin met vijf volledig verkende kindprofielen. Eerdere controles voor de drie oorspronkelijke verhalen blijven behouden.

De oorspronkelijke desktopflow, kindprofielen en mobiele profielkiezer zijn eerder in de browser gecontroleerd. De actuele productiebuild en alle domeincontroles slagen. De browserpreview was bij deze interactie-uitbreiding niet bereikbaar (`ERR_CONNECTION_REFUSED`); de nieuwe speelpanelen zijn in die sessie niet visueel in de browser gecontroleerd. De gegenereerde beeldassets zijn wel afzonderlijk bekeken.

De controle voor tekstgroei gebruikt `scripts/fixtures/story-length-baseline.json`, vastgelegd vóór het herschrijven vanaf broncommit `d5eb67b0fc441a86a5fc1242bd991c63a9758ee7`. Elke mogelijke scèneprefix en alle eindroutes moeten minstens 2× zoveel woorden hebben, met exact dezelfde keuzelabels, hints, titels en aandenkens. De speellogicacontrole controleert beide microhandelingen, de twee wisselroutes en het blokkeren van herhaalde of ongeldige acties.

## Speelbare opening

`app/page.tsx` gebruikt `DemoBoundary`, die vóór het mounten van de app de afzonderlijke opslagomgeving `prototype-demo` kiest. De homepage leest geen Sites-gebruikersidentiteit en maakt geen cloudsynchronisatieclient. Demo inloggen en uitloggen veranderen uitsluitend de lokale presentatiestatus; ze verlenen geen API-toegang. De magische boekopening is verwijderd.

`src/StationPlayScene.tsx` gebruikt de pure fasen uit `src/storyPlayLogic.ts`. De voltooiingscallback loopt via de bestaande reader, voortgang en het verhaalgeheugen. Timers, audio en callbacks worden bij sluiten opgeruimd. De reader houdt de speelprent bij de overgang naar deel 2 in beeld; de langere tekst blijft daarnaast of eronder leesbaar, met voorlezen, pauzeren en hervatten.

De profielmodal en reader gebruiken één gedeelde scrollvergrendeling (`src/modalScroll.ts`). Overlappende uitgaande animaties kunnen daardoor de pagina niet voortijdig vrijgeven of na sluiten geblokkeerd achterlaten. Een sluitverzoek blokkeert de verhaalcallback onmiddellijk, ook zolang de reader nog uit beeld animeert.

Nieuwe beeldlagen staan in `public/art/play/`: `station-platform.webp`, `dibbel.webp` en `train.webp`. Ze zijn afzonderlijk gemaakt met de ingebouwde beeldgenerator. De originele transparante PNG's blijven beschikbaar; de WebP-versies zijn geoptimaliseerd van samen circa 3,3 MB naar circa 429 kB, met identiek gecontroleerde alpha. De uiteindelijke prompts en conversiedetails staan in `public/art/play/prompts.json`.

## Nieuwe verhalen en illustraties

| Verhaal | Afbeelding |
| --- | --- |
| Mopperwolks Weerwinkel | `public/art/weather-v2.webp` |
| De Maanbakkerij | `public/art/moonbakery.webp` |
| Het Fluisterende Koraal | `public/art/ocean.webp` |
| De Reuzentuin van Pip | `public/art/garden.webp` |
| Het Klokje van Morgen | `public/art/clock.webp` |
| De Bibliotheek op Pootjes | `public/art/library.webp` |
| De Ballonnenhaven | `public/art/balloon.webp` |
| Het Bos Zonder Kleuren | `public/art/forest.webp` |
| Het Sneeuwfeest van Nori | `public/art/snow.webp` |
| De Sterrenwasserij | `public/art/stars.webp` |

Alle tien nieuwe beelden zijn afzonderlijk met de ingebouwde beeldgenerator gemaakt, visueel gecontroleerd en als WebP op 1536×1024 opgeslagen. De volledige gebruikte prompts staan in `public/art/prompts-a.json` en `public/art/prompts-b.json`. Dezelfde illustratie wordt op de verhaalkaart en naast de vijf delen gebruikt. De bestaande Weerwinkelillustratie is behouden als `weather.webp`.

De nieuwe verhalen staan in `src/storyCollectionA.ts` en `src/storyCollectionB.ts`. `src/storyCatalog.ts` is de gedeelde allowlist voor de reader, opslag, servervalidatie en het verhaalgeheugen. De bestaande documentversie en databasetabellen blijven bruikbaar; de catalogusuitbreiding vereist geen databasemigratie.

Relevante regressiecontroles:

- `node scripts/profile-storage-check.mjs`: migratie, ouder- en kindisolatie, herladen en geblokkeerde opslag.
- `node scripts/cloud-sync-check.mjs`: authenticatie, offline concepten, revisies, gelijktijdige wijzigingen en conflicten.
- `node scripts/family-backend-check.mjs`: echte SQLite-migratie, ouderisolatie, revisieraces, validatie en aanvraaggrenzen.
- `node scripts/story-memory-check.mjs`: de oorspronkelijke 96 routes, herinneringen, beloningen, herhalen en maximale gezinsdocumenten tegen de servervalidator.
- `node scripts/story-catalog-check.mjs`: tien nieuwe illustraties, vijftig delen, 320 routes, keuzegedrag en verhaallengte.
- `node scripts/story-growth-check.mjs`: minstens verdubbelde tekst op alle dertien verhalen, behoud van keuzes, titels, schatten en routebetekenissen.
- `node scripts/story-play-check.mjs`: kaartje en kastje afronden, pas daarna instappen, beide wisselroutes en terminale vertrekfase bij herhaald tikken.
- `node scripts/modal-scroll-check.mjs`: overlappende modals en reader, herhaalde cleanup en herstel van de oorspronkelijke scrollinstelling.
- `node scripts/catalog-storage-check.mjs`: alle dertien verhalen en 416 routes, compatibiliteit en maximale gezinsdocumenten tegen de echte servervalidator.
- `node scripts/sw-cache-check.mjs`: account-HTML, API en login worden nooit gecachet.
