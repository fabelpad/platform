# Fabelpad — publieke productie vrijgegeven

Op **23 november 2026 om 02:14 UTC** is de publieke productieroute op uitdrukkelijk verzoek van de eigenaar geactiveerd. **https://fabelpad.nl** is bereikbaar met geldig HTTPS; **https://fabelpad.nl/privacy** geeft zonder login HTTP 200 en bevat de actuele informatie voor zowel de lokale Android-app als de afzonderlijke webdienst.

## Wat er draait

De ongewijzigde, eerder gebouwde en geteste appbron is **`228d951ac0db0bac03c7a74c9d67a8c547b005fa`**. Productie gebruikt kandidaat `228d951ac0db0bac03c7a74c9d67a8c547b005fa-45092530884-1`, configuratie `birth-20261123-prd` en `fabelpad-vps08-production.service` op `127.0.0.1:4189`. Staging blijft haar eigen kandidaat, configuratie, Supabase-project en poort 4188 gebruiken. De bestaande CI-/build-/databasebewijzen staan in [de actuele status](STAGING-PRODUCTION-STATUS.md) en het [geboortedatumreleasebewijs](deploy-evidence/birth-release-2026-11-23.json). Dat oudere bewijs beschrijft terecht de toen nog uitgeschakelde openbare productieroute; deze aanvullende vrijgave volgt daarna.

Alle applicatiewijzigingen stonden al op `main` en in de bestaande productie-installatie. Er was geen nieuwe applicatiebuild, apprestart of databasewijziging nodig. De veertien migraties blijven behouden. Deze documentatievrijgave verandert de app-SHA of Android-bundel niet.

## Uitgevoerde activering en controles

De SSH-hostnaam en machine-ID van `dg-vps-08` zijn gecontroleerd. Het bestaande DNS A-record `fabelpad.nl` wijst naar het op deze host aanwezige publieke adres `204.168.128.28`; er is geen AAAA-record. DNS is niet gewijzigd.

Onder het bestaande productie-activatielock is de eigen root-beheerde voorbereide snippet als **`/etc/caddy/sites/fabelpad-vps08-production.caddy`** toegevoegd. SHA-256: `c98bf166a14b46b23c3141e55d7476d0eda44c7142bf5153de0c785aca546a9b`. Zowel de verse samengestelde configuratie als de werkelijk geïnstalleerde volledige Caddyconfiguratie zijn gevalideerd. Daarna is alleen Caddy herladen. Het samengestelde validatiebestand staat buiten de actieve import op `/etc/dg-webservices/fabelpad-vps08-production/prepared/production-https-20261123-validation.Caddyfile`.

De toestand vóór en na bevestigt dat alle tien gecontroleerde bestaande services dezelfde status, PID en starttijd behouden. Beide app-/runtimecombinaties en hun vorige releases zijn ongewijzigd. Het gedeelde Caddyfile en alle reeds bestaande snippets hebben dezelfde hashes. Staging blijft bereikbaar en behoudt `noindex`. Alleen de eigen nieuwe productieproxy is toegevoegd. [Volledig hostbewijs](deploy-evidence/production-https-activation-2026-11-23.json).

De strikte TLS-controle verifieert `fabelpad.nl` en de vertrouwde certificaatketen; het certificaat is geldig tot **21 februari 2027**. De publieke healthcheck meldt de exacte app-SHA en omgeving `production`. Privacy, voorwaarden, bedrijfsgegevens, support, accountverwijderinformatie en privacyverzoek zijn zonder login bereikbaar. De anonieme gezins-API weigert toegang met HTTP 401. [TLS-/HTTP-controle](deploy-evidence/production-https-rootcheck-2026-11-23.json).

De afzonderlijke acceptatie slaagt voor **16 HTTPS/API/inhoudsgroepen** en **14 browsergroepen**: dertien avonturen, 65 hoofdstukken, 416 eindroutes, twintig bronidentieke illustraties, leesweergave zonder geboortedatum/niveaukiezer, mobiele pagina's zonder horizontale overloop, de juiste native/webprivacyscope en juridische downloads. De drie juridische manifests en vier documentdownloads zijn met hun bronhashes vergeleken. [Onafhankelijke publieke acceptatie](deploy-evidence/production-public-acceptance-2026-11-23.json).

Er zijn geen echte accounts of kindgegevens aangemaakt of aangepast, geen OTP aangevraagd en geen mails verstuurd. Deze publieke controle bewijst geen echte OTP-/Google-login, hosted gezinsopslag, mailbezorging of Android-toestelgedrag. De bestaande health blijft expliciet `process-liveness-only` met backend `configured-unverified`.

## Google Play

De **ondertekende productie-AAB 1.0.1 (2)** voor **`nl.fabelpad.app`** blijft ongewijzigd: 38.917.985 bytes, SHA-256 `6e32d9faed68febb783e9a0c2a0a2683cd418858fbc7af3e78ca539bea9de746`. Gebruik het [bouw-/uploadverslag](ANDROID-PRODUCTIE-1.0.1.md) en het [actuele volledige invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md). De publieke privacybereikbaarheid is nu opgelost. Toestel-/TTS-acceptatie, Store-beelden, account-/testgate, controle op ongebruikte versiecode 2 en de eigen Cloud-/Play-inrichting blijven afzonderlijke stappen. Er is geen Play-upload of publicatie uitgevoerd.

## Controle en herstel

Herhaal de niet-schrijvende controle met:

```bash
curl --fail --silent --show-error https://fabelpad.nl/api/health
curl --fail --silent --show-error --output /dev/null https://fabelpad.nl/privacy
curl --fail --silent --show-error --output /dev/null https://fabelpad.nl/algemene-voorwaarden
```

Een eventueel later herstel van uitsluitend deze publieke routing verwijdert onder hetzelfde activatielock alleen de aantoonbaar eigen snippet met bovenstaande hash, valideert `/etc/caddy/Caddyfile` en herlaadt Caddy. Het laat de gezonde loopbackrelease, staging, DNS en database intact. Er is geen live rollback uitgevoerd. Voor applicatieherstel blijft een compatibele herstelbuild nodig; een kale terugkeer naar de oude app begrijpt de nieuwe profielvelden en privacyversie niet.
