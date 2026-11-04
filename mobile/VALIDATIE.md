# Native demo — uitgevoerde controles

4 november 2026. Dit verslag betreft de lokale demo, zonder stagingbackend of Play-publicatie.

| Controle | Resultaat |
| --- | --- |
| Contentcontract tijdens de native runtimecontrole | Geslaagd: 13 verhalen, 403 bereikbare scènes, 416 eindroutes |
| `npm run check` | Geslaagd: TypeScript zonder fouten |
| `npm run test:runtime` | Geslaagd: begrensde stationsacties, dubbele tik, oude callbacks na sluiten/achtergrond, profielhervatten, opslagfout en schrijf-/wisvolgorde |
| `npx expo install --check` | Geslaagd: dependencies up-to-date voor Expo 58.0.23 |
| Expo Android prebuild | Geslaagd |
| Metro tijdens de Gradle-releasebuild | Geslaagd: 1156 modules, 15 assets, gebundelde Hermes-JavaScript |
| Gradle `app:assembleRelease` | Geslaagd in 6m 19s; 492 taken, waarvan 484 uitgevoerd en 8 up-to-date |
| APK-signatuur, package, SDK en architectuur | Geslaagd via Build-Tools 37 `apksigner` en `aapt2`: Android-debugcertificaat, v2-signatuur, demo-package, min SDK 24, target SDK 36, arm64-v8a |
| APK ZIP-uitlijning | Geslaagd: `zipalign -c -P 16 4` |
| APK-installatie en werking op Android-toestel/emulator | Niet uitgevoerd; geen toestel beschikbaar gesteld, geen emulator ingericht |
| Koude offline appstart, Android-terugknop, rotatie/tablet, systeemtekstschaling en audio-onderbreking op toestel | Nog te verifiëren |
| Native 60-fps-meting, geheugengebruik en echte offline Nederlandse apparaatstem | Niet uitgevoerd |
| Native Supabase/Auth/Resend, cross-device synchronisatie, contentdownloads en Play Billing | Niet aangesloten; geen integratietest geclaimd |
| Productie-AAB, productiesigning en Play review/publicatie | Niet uitgevoerd; definitieve productie-identiteit en signing ontbreken |

## Gebouwd bestand

- APK: `artifacts/native/fabelpad-demo-arm64.apk` vanuit de repositoryroot.
- Controlemanifest: `artifacts/native/fabelpad-demo-arm64.json`.
- Omvang: 35.671.087 bytes (ongeveer 34,0 MiB).
- SHA-256: `d0c6720ec74c8bde079fe2e1da7064158dea94c914dbd35c9fb0d49ecd9991de`.
- Naam: Fabelpad Demo; package-ID `nl.dgwebservices.fabelpad.demo`; versie 0.1.0, versionCode 1.
- Configuratie: lokaal gebundelde content, geen backend, geen Metro-server nodig.
- Certificaat-SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (gegenereerde Android-debugsleutel, uitsluitend demo).

Deze eerste APK is gebouwd uit de gewijzigde lokale werkboom boven basiscommit `a7475c4573d3f125be337eb315c574945c64352c`. Het manifest vermeldt daarom `workingTreeDirty: true`; dit is geen aan een schone releasecommit gekoppeld staging- of productieartefact. Een latere releasebouw moet de exacte definitieve bron-SHA en omgevingsconfiguratie vastleggen. APK-signatuur en ZIP-uitlijning zijn statische controles en bewijzen geen installatie, schermwerking of prestaties. Bij een volgende bouw is het gegenereerde manifest leidend voor hash en bronstatus.

## Gebruikte toolchain en capaciteit

- Node 24.18.0; Expo 58.0.23; React 19.3.0; React Native 0.88.1.
- Reanimated 4.7.1, Worklets 0.13.0, Gesture Handler 3.3.0 en SecureStore 58.0.2.
- Gradle wrapper 9.4.1, Kotlin 2.2.10, JDK 21 voor Gradle; Gradle gebruikt daarnaast de beschikbare Java 17-toolchain voor Java-compilatie.
- Android compile API 37, target API 36, min API 24; Build-Tools 37.0.0, NDK 27.1.12297006 en CMake 3.22.1.
- Lokale JDK: `/home/codex/.local/share/fieldgrid-android/jdk-21`; eigen Android SDK: `/home/codex/.local/share/fabelpad-android/sdk`.
- Voorcontrole: 38 GiB vrije schijfruimte en 13.806.396 vrije inodes. Na de bouw circa 36 GiB en 13,7 miljoen inodes vrij.
- Het bouwscript gebruikt een exclusieve build-lock, één Gradle-worker, Kotlin in hetzelfde proces en maximaal 1 GiB Java-heap. AGP roept Ninja rechtstreeks aan; diens C++-compilatietaken kunnen intern parallel lopen. `CMAKE_BUILD_PARALLEL_LEVEL=1` is daarvoor geen harde bovengrens. De bouw is zonder OOM geslaagd; houd rekening met de capaciteit van een gedeelde host.

De upstream Expo/Android-plugins melden deprecations richting AGP/Gradle 10. De gebruikte 9.4.1-wrapper is geslaagd; er is geen compatibiliteit met Gradle 10 geclaimd.

## Nog uit te voeren op een toestel

Volg de installatie-instructies in `README.md`. Test minimaal het volledige stationsverhaal met kaartje én kastje, beide wisselkeuzes, dubbele tikken, weggaan tijdens vertrek en heropenen, twee kindprofielen met afzonderlijke routes, favorieten, beloning/schatkist en hervatten na een koude appstart. Controleer ook in vliegtuigstand, met grotere systeemtekst, verminderde beweging, rotatie en een aanwezige Nederlandse apparaatstem. Audio moet stoppen bij verlaten, achtergrond en profielwissel. Meet prestaties pas op het afgesproken gewone Android-toestel.

De native demo gebruikt basisovergangen via native `Animated` en de stationsinteractie via Reanimated/Gesture Handler. Alle verhalen en illustraties zijn gebundeld; dit test nog geen download-/synchronisatiecontract. Productie-authenticatie krijgt de voorbereide SecureStore-adapter; AsyncStorage blijft uitsluitend voor demo-profielen en voortgang.

De eerste APK is gebouwd vanuit de gewijzigde werkboom boven de importcommit. Een volgende gecontroleerde build op de uiteindelijke commit schrijft de exacte bron-SHA en de actuele APK-hash in `artifacts/native/fabelpad-demo-arm64.json`; dat manifest bepaalt welke bron bij het geleverde artefact hoort. Toestelchecks blijven ook na die herbouw niet uitgevoerd.
