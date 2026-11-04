# Fabelpad native prototype

Een zelfstandige Expo/React Native-demo met echte native componenten. Deze app werkt lokaal zonder account of backend. De Android-bouwstatus en nog niet uitgevoerde toestelcontroles staan in `VALIDATIE.md`.

## Wat zit erin?

- Dertien verhalen met alle 403 bereikbare scènes en 416 eindroutes uit dezelfde bestaande verhaallogica als de webapp.
- Gebundelde illustraties en logo, bibliotheek, zoeken, favorieten, vijf lokale kindprofielen, aparte routevoortgang, hervatten en schatkist.
- Native Android-terugknop, veilige schermranden, telefoon- en tabletindeling, grotere tekst en verminderde beweging.
- Native stationsspeelprent: Dibbel helpen met zijn kaartje, het kastje openen, instappen en de wissel bedienen. Gesture Handler verwerkt de knoppen en Reanimated beweegt de trein/wissel. Dubbele tikken verwerken maximaal één keuze; verlaten en achtergrond annuleren oude timers.
- Voorlezen via de apparaatstem. Android ondersteunt in `expo-speech` stoppen en opnieuw beginnen, geen pauze/hervatten; die onjuiste belofte staat daarom niet in de UI. Een Nederlandse/offline stem moet op het toestel beschikbaar zijn.
- Seriële AsyncStorage-schrijfacties. Een mislukte opslag wordt zichtbaar; de app claimt dan niet dat gegevens duurzaam zijn opgeslagen. AsyncStorage is niet versleuteld en bevat uitsluitend demo-kindprofielen/voortgang, nooit secrets of authenticatietokens.
- Een gewijzigde contenthash blokkeert het automatisch voortzetten van oude keuzes. De productieversie moet oude verhaalreleases blijven aanbieden; de demo biedt een expliciete, bevestigde herstart.
- Een afzonderlijke SecureStore-adapter is voorbereid voor toekomstige native authenticatietokens; er wordt nu geen Supabase-sessie gemaakt of gesynchroniseerd.

## Starten op de development-VPS

Installeer eerst de hoofdrepository-dependencies; die leveren TypeScript voor de contentexport. Voer vanuit de repository uit:

```bash
node scripts/export-native-content.mjs
cd mobile
npm ci
npm run check
npm run test:runtime
npm start
```

De lockfile is aanwezig; gebruik `npm ci`. Gebruik een passende Expo Go-versie of een eigen development build. Een headless VPS heeft voor interactief testen een apart toestel/emulator nodig.

Voor een zelfstandige arm64-demo-APK, vanuit de repository:

```bash
JAVA_HOME=/pad/naar/jdk-21 \
ANDROID_HOME=/pad/naar/android-sdk \
bash scripts/native-build-demo.sh
```

Het script controleert schijfruimte, inodes, toolchain, TypeScript, runtimecontracten en Expo-dependencies. Daarna genereert Expo het Android-project en bouwt Gradle met één worker, maximaal 1 GiB Java-heap en gebundelde JavaScript/assets. De doelmap is `artifacts/native/fabelpad-demo-arm64.apk`. De SDK moet API 37, Build-Tools 37.0.0 en NDK 27.1.12297006 bevatten; Gradle kan daarnaast de vereiste CMake-versie installeren. Raadpleeg `VALIDATIE.md` voor de werkelijk gebruikte versies en uitkomst.

De demo gebruikt `nl.dgwebservices.fabelpad.demo`, versie 0.1.0/versionCode 1 en de gegenereerde Android-debugsleutel. Deze lokale identiteit en sleutel zijn uitsluitend voor de demo. `FABELPAD_VARIANT=production` vereist expliciet `FABELPAD_ANDROID_PACKAGE`; de definitieve productie-ID, uploadkey, backend en publicatie zijn nog niet ingericht. Het demoscript bouwt altijd de demovariant.

Installeer het gebouwde bestand op een aangesloten arm64 Android-toestel met `adb install -r artifacts/native/fabelpad-demo-arm64.apk`, of kopieer het bestand naar het toestel en open het daar. Toestemming om lokaal een APK te installeren kan nodig zijn. Start de app één keer zonder Metro-server, schakel daarna internet uit en test ook na volledig sluiten/heropenen. Dit zijn nog uit te voeren toestelcontroles, geen bouwbewijs.

`npm run export:android` maakt een Metro/JavaScript-export. Dat is geen APK en geen bewijs van een geslaagde native Android-build. De productie-AAB moet later met Gradle of een lokale Expo-build worden gemaakt en ondertekend.

## Versies

Expo SDK 58 is officieel uitgebracht op 15 oktober 2026. De pins zijn gecontroleerd op 4 november 2026: `expo@58.0.23` uit de officiële npm-package, React 19.3.0 / React Native 0.88.1 / Speech 58.0.3 / Safe Area 5.11.1 / AsyncStorage 2.2.0 uit `expo@58.0.23/bundledNativeModules.json`; Babel 58.0.24 uit de Expo-package-dependencies. Bij upgrades eerst `npx expo install --check` en Expo Doctor uitvoeren, daarna toestelregressies.

## Grenzen van dit prototype

Het browserprototype en deze native app hebben elk hun eigen lokale demo-opslag. Ze zijn niet aan elkaar gekoppeld en de native app is niet verbonden met Supabase. Native OTP/Google-login, gezinsisolatie via de backend, echte synchronisatie, downloads van nieuwe releases, Play Billing, aankoopherstel, accountverwijdering en productiesigning blijven open werk. De gebundelde verhalen zijn lokaal leesbaar; een Nederlandse/offline apparaatstem is afhankelijk van het toestel. Skia is niet toegevoegd: de begrensde stationsinteractie gebruikt native weergaven, Reanimated en Gesture Handler. Er is geen 60-fps-resultaat zonder meting op echte toestellen.

Browserbeheerderswijzigingen staan lokaal in de browser; de export haalt de repositoryverhalen op, niet de browser-localStorage. Voor productie moet de beheeromgeving gepubliceerde, onveranderlijke contentreleases leveren die zowel web als app kunnen laden.

Zie `../docs/FABELPAD-CODEX-OVERDRACHT.md` voor schermmapping, contracten en acceptatiecriteria.

Officiële bronnen: [SDK 58-release](https://expo.dev/changelog/sdk-58), [SDK-versiematrix](https://docs.expo.dev/versions/latest/), [lokale builds](https://docs.expo.dev/build-reference/local-builds/), [Speech](https://docs.expo.dev/versions/latest/sdk/speech/), [AsyncStorage](https://docs.expo.dev/versions/latest/sdk/async-storage/).
