> **Actuele bundel, 23 november 2026:** Fabelpad **1.0.1 (2)** is ondertekend en gecontroleerd. Gebruik het [actuele bouw-/uploadverslag](ANDROID-PRODUCTIE-1.0.1.md) en de bijbehorende bestanden. De versie-, hash- en bereikbaarheidsgegevens hieronder beschrijven de eerdere voorbereiding van 18 november.

# Fabelpad Android — productiebuild 1.0.0 (1)

Gecontroleerd op 18 november 2026. De eigenaar bevestigde `nl.fabelpad.app` als gratis, volledig lokale eerste release. Play-indiening en toestelacceptatie blijven afzonderlijke stappen.

| Onderdeel | Werkelijk resultaat |
| --- | --- |
| Broncommit | `8dcb98c4287dc78421b092ee395ace05f492baaa`; vastgelegd bij start; schone werkboom bij start en controle |
| AAB | `artifacts/native/archive-1.0.0-20261118/fabelpad-production.aab`, 37.005.584 bytes, SHA-256 `ffc22ec85449074a667a243dc132dfa46e9a484c756dc57c859433ba68ba6e1c` |
| Identiteit | Fabelpad, `nl.fabelpad.app`, production/release, versionName 1.0.0, versionCode 1 |
| Ondertekening | Eigen PKCS12/RSA-3072-uploadsleutel; JAR-signatuur en overeenkomst met beschermd uploadcertificaat geverifieerd; geen debugsigning |
| Publiek uploadcertificaat | `artifacts/native/fabelpad-upload-certificate.pem`; SHA-256 `3598b0e2d3d6d7d5127110970352733e79e3f122f1bb60161704af2e421887de` |
| Android | minSdk 24, targetSdk 36, compileSdk 37; arm64-v8a en x86_64 |
| Rechten | Alleen VIBRATE en eigen signature-permission; geen INTERNET, AD_ID, opslag, overlay of biometrie |
| Manifest | Niet debugbaar; automatische app-back-up en cleartext uit; variant/privacy/supportmetadata gecontroleerd |
| 16 KB | Alle 44 native libraries: ELF PT_LOAD minimaal 16 KB; PAGE_ALIGNMENT_16K in bundleconfig; gegenereerde APK slaagt voor zipalign 16 KB |
| Bundletool | 1.18.3, officiële download/checksum gecontroleerd; validate/config/manifest/build-apks geslaagd |
| Optimalisatie | R8 en resource shrink aan; DEX samen 4.760.040 ongecomprimeerde bytes; corresponderende mapping bewaard |
| APK voor acceptatie/captures | `artifacts/native/archive-1.0.0-20261118/fabelpad-production.apk`, 51.857.216 bytes, SHA-256 `f14713f6492d68ef062948ad814599d4c3b50a0e605547154c36d21adff23681`; signing en ZIP-uitlijning geverifieerd |
| Native checks | TypeScript, runtimecontracten inclusief contentversies/migratie, Expo-dependencycontrole en release-lint geslaagd |
| Gradle | lintRelease + bundleRelease geslaagd in 5m22s, 546 taken; geen niet-bestaande unit-testtaak als geslaagde test geteld |
| Play-route | 27 offline tests voor API, CI-vrijgave en artefactidentiteit geslaagd; Bash/Python gecontroleerd; actuele GitHub-uitslag bij PR #2 |
| Web/privacy | Next.js-productiebuild en TypeScript geslaagd; privacy/support/verwijderen lokaal HTTP 200; zelfstandige HTML-export voorbereid |
| Publieke privacy | https://fabelpad.nl/privacy gaf HTTP 401 / StackProtect; niet publiek geverifieerd |
| Toestel / Play | Geen toestelinstallatie, emulatortest, Play-upload of Google-goedkeuring geclaimd |

Toolchain: Node24.18.0, Expo58.0.26, RN0.88.1, Gradle9.4.1, JDK21 met beschikbare Java17-toolchain, Build-Tools37.0.0 en NDK27.1.12297006. Beide lockfiles blijven leidend. Gradle meldt upstreamdeprecations richting versie10; er is geen Gradle10-compatibiliteit geclaimd. De JSON naast de AAB bevat volledige metadata. Latere wijzigingen aan documentatie of GitHub SDK-bootstrap veranderen de bronidentiteit van het geleverde bestand niet.

De private keystore en wachtwoordbron staan buiten Git. De eigen herstelkopie op dg-nxttrack-01 is root-only, heeft een afzonderlijke wachtwoordbron en is geopend en op certificaat gecontroleerd. Het [release-runbook](GOOGLE-PLAY-RELEASE-RUNBOOK.md) bevat veilige stappen en paden. Bestaande appservices, domeinroutes en runners bleven ongemoeid.

Test met synthetische profielen op telefoon en kleine/grote tablet: koude/offline start, stationsacties, profielscheiding, hervatten na update, favorieten/schatkist, tekstschaling/rotatie/beweging, offline spraak en ontbrekende stem, achtergrond/audio, ouderlinks en duurzaam wissen. Noteer motor/stem en netwerkgedrag voordat de definitieve gegevensverklaring wordt bevestigd. Volg daarna het [productie-invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md).
