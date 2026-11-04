# Fabelpad native prototype

Een zelfstandige Expo/React Native-prototypeapp met echte native componenten, geen WebView. Deze broncode hoort bij het Fabelpad-prototype. Er is in deze sessie geen APK/AAB gebouwd en geen toesteltest uitgevoerd.

## Wat zit erin?

- Dertien verhalen met alle 403 bereikbare scènes en 416 eindroutes uit dezelfde bestaande verhaallogica als de webapp.
- Gebundelde illustraties en logo, bibliotheek, zoeken, favorieten, vijf lokale kindprofielen, aparte routevoortgang, hervatten en schatkist.
- Native Android-terugknop, veilige schermranden, telefoon- en tabletindeling, grotere tekst en verminderde beweging.
- Voorlezen via de apparaatstem. Android ondersteunt in `expo-speech` stoppen en opnieuw beginnen, geen pauze/hervatten; die onjuiste belofte staat daarom niet in de UI. Een Nederlandse/offline stem moet op het toestel beschikbaar zijn.
- Seriële AsyncStorage-schrijfacties. Een mislukte opslag wordt zichtbaar; de app claimt dan niet dat gegevens duurzaam zijn opgeslagen. AsyncStorage is niet versleuteld en bevat uitsluitend demo-kindprofielen/voortgang, nooit secrets of authenticatietokens.
- Een gewijzigde contenthash blokkeert het automatisch voortzetten van oude keuzes. De productieversie moet oude verhaalreleases blijven aanbieden; de demo biedt een expliciete, bevestigde herstart.

## Starten op de development-VPS

Installeer eerst de hoofdrepository-dependencies; die leveren TypeScript voor de contentexport. Voer vanuit de repository uit:

```bash
node scripts/export-native-content.mjs
cd mobile
npm ci
npm run check
npm start
```

Als er nog geen lockfile aanwezig is, voer dan één keer `npm install` uit en commit de gegenereerde `package-lock.json`; gebruik daarna `npm ci`. Gebruik een passende Expo Go-versie of een eigen development build. Voor de eigen Android-build moet de VPS een passende JDK/Android SDK hebben; `npm run android` genereert en bouwt het Android-project via Expo prebuild. Een headless VPS heeft voor interactief testen een apart toestel/emulator en netwerkverbinding nodig. De package-ID's in `app.config.ts` zijn voorstellen en moeten vóór de eerste Play-publicatie definitief worden vastgelegd.

`npm run export:android` maakt een Metro/JavaScript-export. Dat is geen APK en geen bewijs van een geslaagde native Android-build. De productie-AAB moet later met Gradle of een lokale Expo-build worden gemaakt en ondertekend.

## Versies

Expo SDK 58 is officieel uitgebracht op 15 oktober 2026. De pins zijn gecontroleerd op 4 november 2026: `expo@58.0.23` uit de officiële npm-package, React 19.3.0 / React Native 0.88.1 / Speech 58.0.3 / Safe Area 5.11.1 / AsyncStorage 2.2.0 uit `expo@58.0.23/bundledNativeModules.json`; Babel 58.0.24 uit de Expo-package-dependencies. Bij upgrades eerst `npx expo install --check` en Expo Doctor uitvoeren, daarna toestelregressies.

## Grenzen van dit prototype

Het browserprototype en deze native app hebben elk hun eigen lokale demo-opslag. Ze zijn niet aan elkaar gekoppeld en niet verbonden met Supabase. De bestaande Sites/D1-backend is geen Supabase-implementatie. OTP/Resend, gezinsisolatie via RLS, echte synchronisatie, downloads van nieuwe releases, Play Billing, aankoopherstel en productiesigning blijven implementatiewerk op de VPS. Het native prototype gebruikt basisovergangen via `Animated` met native driver; de uitgebreide stationsspeelprent en Reanimated/Gesture Handler/Skia-effecten volgen als native interactielaag. Geen 60-fps-resultaat wordt geclaimd zonder releasebuild en meting op echte toestellen.

Browserbeheerderswijzigingen staan lokaal in de browser; de export haalt de repositoryverhalen op, niet de browser-localStorage. Voor productie moet de beheeromgeving gepubliceerde, onveranderlijke contentreleases leveren die zowel web als app kunnen laden.

Zie `../docs/FABELPAD-CODEX-OVERDRACHT.md` voor schermmapping, contracten en acceptatiecriteria.

Officiële bronnen: [SDK 58-release](https://expo.dev/changelog/sdk-58), [SDK-versiematrix](https://docs.expo.dev/versions/latest/), [lokale builds](https://docs.expo.dev/build-reference/local-builds/), [Speech](https://docs.expo.dev/versions/latest/sdk/speech/), [AsyncStorage](https://docs.expo.dev/versions/latest/sdk/async-storage/).
