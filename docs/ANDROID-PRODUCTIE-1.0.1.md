# Fabelpad Android 1.0.1 (2)

Gecontroleerd op **23 november 2026**. De gesigneerde productievariant bevat de dertien complete verhalen en geboortedatum-/leesniveauwijziging van schone broncommit **`228d951ac0db0bac03c7a74c9d67a8c547b005fa`**.

| Onderdeel | Werkelijk resultaat |
| --- | --- |
| App / pakket | Fabelpad / `nl.fabelpad.app` |
| Variant / versie | production, release; versionName `1.0.1`, versionCode `2` |
| AAB | **38.917.985 bytes**, SHA-256 `6e32d9faed68febb783e9a0c2a0a2683cd418858fbc7af3e78ca539bea9de746` |
| Signing | Bestaande eigen uploadsleutel; JAR-signatuur en uploadcertificaat gecontroleerd; geen debugcertificaat |
| Publiek uploadcertificaat | SHA-256 `3598b0e2d3d6d7d5127110970352733e79e3f122f1bb60161704af2e421887de` |
| APK voor toestelacceptatie | 54.516.015 bytes, SHA-256 `100e476f26c189d26d9b8c661192a10aa1d3a00b834d12fc3295c891fcc969c7`; signing en zipalign gecontroleerd |
| Android | minSdk 24, targetSdk 36, compileSdk 37; `arm64-v8a` en `x86_64` |
| Rechten | Alleen VIBRATE en eigen signature-permission; geen INTERNET of AD_ID; back-up en cleartext uit |
| Native libraries | Alle **44** ELF-bibliotheken minimaal 16-KiB-alignment; bundleconfig en APK-zipalign 16 KiB gecontroleerd |
| Werkelijke inhoud | Alle **20** WebP-bestanden bytegelijk aan de bron; Hermes99 bevat contentversie, dertien verhaal-ID's, drie niveaus en nieuwe profielvelden; DEX bevat de echte native datumkiezer |
| Build | TypeScript, native runtime, Expo dependencycheck, clean prebuild, `lintRelease` en `bundleRelease`; **BUILD SUCCESSFUL in 5m50s**, 546 taken |
| Toestelacceptatie | **Niet uitgevoerd**; `adb devices -l` toont geen aangesloten toestel of emulator |
| Google Play | **Niet geüpload of gepubliceerd** |

Bewijs: [buildrapport](deploy-evidence/birth-native-signed-2026-11-23.json) en [onafhankelijke inhoudscontrole](deploy-evidence/birth-native-content-2026-11-23.json). De aanwezigheid van bytecodetokens bewijst geen uitvoering op een toestel. Ondertekening, manifest en alignment zijn wel op de werkelijke artefacten gecontroleerd.

De distributiekopieën staan onder `/home/codex/fabelpad-productie-1.0.1-2026-11-23/`, met de versie in de bestandsnamen. Het ongewijzigde buildrapport gebruikt de oorspronkelijke namen `fabelpad-production.aab`, `.apk` en `-mapping.txt`; de inhoudshashes verbinden die met de hernoemde kopieën. De private keystore en wachtwoorden staan uitsluitend buiten Git en buiten dit pakket.

## Gebouwd gedrag en gegevens

Nieuwe persoonlijke profielen vereisen een geboortedatum. Automatisch leesniveau, afzonderlijke ouderoverride, lokale ouderdrempel, legacyprofielen, verjaardagen, hervatten en routebehoud staan in [de functievalidatie](VALIDATIE-GEBOORTEDATUM-2026-11-23.md). De Android-app blijft de door de eigenaar gekozen gratis lokale app zonder account, Supabase-verbinding, advertenties of aankopen. De webapp gebruikt de afzonderlijke online gezinsvoorzieningen. Nieuwe geboortedatums in Android blijven in dezelfde lokale profielopslag en worden bij profiel-/appdatawissing meegenomen. De spraakengine krijgt de generieke naam; geen kindnaam of geboortedatum.

De huidige launcher is het bestaande Fabelpad-merkbeeld. Extern gemaakte Store-beelden kunnen apart worden toegevoegd. Een nieuw launcher-icoon verandert de appbundle en vergt opnieuw bouwen met een hogere ongebruikte versionCode.

## Upload en controle

1. Installeer de meegeleverde APK op een testtelefoon en kleine/grote tablet, met uitsluitend synthetische profielen. Controleer datumkiezer, aanmaken/bewerken, beide verjaardagsgrenzen via testconfiguratie, ouderpoort, grote tekst, TalkBack, rotatie, offline stem, hervatten, keuzes, aandenkens en wissen. De huidige build-/runtimechecks vervangen dit niet.
2. Controleer in Play Console → Appbundleverkenner of **code 2** nog ongebruikt is en bij de gekozen uploadsleutel hoort. Er was geen Play Console-toegang om dat te bevestigen. Bij een gebruikte code moet een nieuwe bundel worden gebouwd met een hogere code.
3. Open de eigen app **Fabelpad**, pakket **nl.fabelpad.app**. Kies voor de eerste acceptatie **Intern testen → Nieuwe release maken**. Upload **`fabelpad-1.0.1-2-production.aab`**. De APK is voor toestelacceptatie, geen appbundle voor Play.
4. Gebruik bij een nieuwe app Play App Signing met Google als beheerder/generator van de app-signingsleutel. De AAB is al met onze uploadsleutel ondertekend. Het meegeleverde openbare PEM is alleen nodig als Console om een uploadcertificaat vraagt; geef geen private keystore af.
5. Controleer op het uploadscherm `nl.fabelpad.app`, `1.0.1`, `2`, signing en Device Catalog. Voeg de corresponderende R8-mapping toe als Console daarom vraagt. Het pakket bevat releaseopmerkingen (321 Unicode-tekens), Nederlandse Store-teksten en Engelse reviewinstructies.
6. Rond de actuele Play-formulieren, externe Store-beelden en account-/testgate af volgens het [invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md). **De productieprivacy-URL `https://fabelpad.nl/privacy` is op 23 november publiek geactiveerd en gecontroleerd: geldig TLS, HTTP 200 zonder login en de juiste native/webscope.** Deze bereikbaarheidsblokkade is opgelost; zie [live-acceptatie](PRODUCTIE-LIVE-2026-11-23.md).
7. Voer pas na toestelacceptatie en de Console-controles de afzonderlijk goedgekeurde indiening/publicatie uit. Automatische Cloud-/Play-publicatie is niet met deze AAB-bouw geactiveerd. Het actuele aanvullende Cloud-stappenplan staat in het op 23 november geleverde Play-voorbereidingspakket; accountidentiteiten en eerste Console-/teststappen blijven nodig.

Voor het opnieuw bouwen is de daadwerkelijk gebruikte opdracht:

```bash
PATH=/home/codex/.nvm/versions/node/v24.18.0/bin:$PATH \
JAVA_HOME=/home/codex/.local/share/fieldgrid-android/jdk-21 \
ANDROID_HOME=/home/codex/.local/share/fabelpad-android/sdk \
JAVA_TOOLCHAIN_17=/home/codex/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2 \
FABELPAD_ANDROID_PACKAGE=nl.fabelpad.app \
FABELPAD_ANDROID_VERSION_NAME=1.0.1 \
FABELPAD_ANDROID_VERSION_CODE=2 \
bash scripts/native-build-production.sh
```

Deze opdracht draaide in een afzonderlijke schone worktree, na `pnpm install --frozen-lockfile` en `npm ci --prefix mobile --no-audit --no-fund`. Gebruik code 2 alleen voor deze ongewijzigde, nog niet eerder gebruikte bundel; gewijzigde releases krijgen een nieuwe code.
