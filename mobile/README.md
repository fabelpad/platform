# Fabelpad voor Android

De eerste productieversie is een gratis, lokale leesapp met dertien gebundelde verhalen, 403 scènes en 416 eindes. Kinderen kiezen hun eigen verhaalroute; vijf lokale profielen bewaren afzonderlijke voortgang, favorieten, voorkeuren en schatkisten. De stationsspeelprent gebruikt native weergaven, Gesture Handler en Reanimated. De app gebruikt geen WebView, account, backend, advertenties, analytics of aankopen.

De nieuwe, afzonderlijk gekozen variant `connected` voegt ouderaanmelding, gedeelde online gezinstoegang en Google Play Billing 9.1.0 toe. De oorspronkelijke variant `production` houdt haar lokale scope. Alleen `connected` resolveert de Billing SDK en krijgt netwerktoegang. Lees de configuratie, testgrenzen en externe providerstappen in [BETALINGEN-BEHEER.md](../docs/BETALINGEN-BEHEER.md). De gekoppelde variant gebruikt een hogere versionCode dan de bestaande versie `1.0.1 (2)`; zij wordt met deze wijziging niet gepubliceerd.

Productie-identiteit: `nl.fabelpad.app`, versie `1.0.0`, eerste `versionCode` `1`. De eigenaar heeft deze identiteit en lokale productscope bevestigd. Iedere volgende Play-versie krijgt een hoger versionCode. De historische demo heeft een afzonderlijk pakket en sleutel; die APK kan niet als productie-upload worden gebruikt.

## Installeren en controleren

Gebruik Node conform de repository, de vastgelegde npm-lockfile voor `mobile/` en de root-lockfile voor de contentexport en domeintests:

```bash
pnpm install --frozen-lockfile
node scripts/export-native-content.mjs
npm ci --prefix mobile
npm run check --prefix mobile
npm run test:runtime --prefix mobile
cd mobile
npx expo install --check
```

Expo en SecureStore zijn op de compatibele SDK 58-patches `58.0.26` en `58.0.3` vastgezet. React Native blijft `0.88.1`. De Android-toolchain wordt uit de geïnstalleerde React Native-versiematrix gecontroleerd. Een JavaScript-export is geen native build of toesteltest.

## Lokale gegevens en verhaalupdates

AsyncStorage bewaart alleen lokale profielen, namen/bijnamen, keuzes, favorieten en voorkeuren. Dit is geen versleutelde kluis; secrets en sessietokens horen er niet in. Productie schakelt Android-appback-up uit. In **Ouders → Alle gegevens op dit apparaat wissen** verwijdert de app de lokale opslag en begint met een leeg standaardprofiel. Er is geen online account om te verwijderen.

Een gestart verhaal krijgt in `Profile.storyVersions` de onveranderlijke contentversie. De export bewaart de bijbehorende catalogus onder `src/releases/` en genereert statische imports in `src/releaseCatalog.ts`. Begonnen verhalen en verdiende herinneringen blijven daardoor bij hun oorspronkelijke tekst na een app-update. Een bewuste herstart kiest de nieuwste versie. Verwijder nooit een reeds uitgebrachte catalogus of bijbehorende illustratie; ontbrekende versies worden geblokkeerd en krijgen geen stilzwijgende nieuwe tekst. De migratie van oudere lokale opslag gebruikt de eerder bewaarde `Store.contentVersion`.

## Voorlezen

De eigen lokale Expo-module `modules/fabelpad-offline-speech` ondersteunt Android. Alleen een geïnstalleerde Nederlandse stem die volgens Android geen netwerk nodig heeft wordt geselecteerd; een mislukte selectie krijgt geen standaard- of netwerkfallback. Stoppen initialiseert geen stem. De engine ontvangt generieke verhaaltekst met **Avonturier**, nooit de naam uit het kindprofiel. Als een geschikte stem ontbreekt blijft gewoon lezen beschikbaar. Steminstallatie gebeurt buiten Fabelpad via de Android-instellingen.

Een eigen Android-build is nodig om deze module te testen. Expo Go heeft de module niet. Een geslaagde compilatie bewijst geen correcte enginewerking: test voorlezen op echte toestellen, zonder netwerk, met en zonder Nederlandse offline stem en na achtergrond/stop/heropenen. Het gedrag van de afzonderlijke, door de gebruiker geïnstalleerde TTS-engine moet bij de definitieve gegevensbeoordeling worden meegenomen.

## Productiebuild en signing

`app.config.ts` vereist de productie-ID en een expliciet versionCode. `plugins/withFabelpadProduction.cjs` verwijdert onnodige rechten, zet back-up en cleartext uit en voorkomt debugondertekening. De Android-map is gegenereerde uitvoer; maak wijzigingen via config/plugin/broncode.

De productiebuild gebruikt de uploadkey uit afgeschermde bestanden buiten de repository. Wachtwoorden worden uit de twee afgeschermde wachtwoordbestanden gelezen. De vereiste namen zijn `FABELPAD_UPLOAD_KEYSTORE`, `FABELPAD_UPLOAD_KEY_ALIAS`, `FABELPAD_UPLOAD_STORE_PASSWORD_FILE` en `FABELPAD_UPLOAD_KEY_PASSWORD_FILE`. Een build met `FABELPAD_UNSIGNED_CHECK=true` is uitsluitend een inspectiebuild en kan niet naar Play.

De productiebuild gebruikt standaard `assets/brand/launcher.png`, een ongewijzigde kopie van het aanwezige Fabelpad-icoon. Extern gemaakte Store-beelden worden apart geüpload. Een vervangend Android-launchericoon moet in de AAB worden meegebouwd.

Het complete invulblad en de release-instructies staan in `../docs/GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md` en de bijbehorende Google Play-documentatie. De publieke privacyroute, supportmailbox, ondertekende AAB, toestelacceptatie en Play-accountcontroles moeten afzonderlijk worden geverifieerd. Een voorbereide productieconfiguratie is geen Play-goedkeuring.
