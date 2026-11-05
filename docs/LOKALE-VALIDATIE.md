# Lokale validatie

4 november 2026. Nieuwe controles zijn uitgevoerd op deze lokale implementatie. De exacte oplevercommit en laatste uitvoer worden naast de bouwproducten vastgelegd in `artifacts/local-validation.json`, `artifacts/local-build.log`, `artifacts/browser-tests.log` en het Android-artefactmanifest. Deze lokale bestanden zijn genegeerde bouwuitvoer. De oorspronkelijke pakketresultaten zijn niet als nieuw bewijs overgenomen.

## Bron en omgeving

| Onderdeel | Werkelijk bewijs |
| --- | --- |
| Aangeleverde broncommit | `97c3881d6bd94f41596ce77fb7a53d55936c6397` volgens pakketmetadata |
| Lokale importcommit | `a7475c4573d3f125be337eb315c574945c64352c` |
| Geteste broncommit web en APK | `045c863997b6c8aca57cd118b1723b2cbfb7997f`; schone werkboom bij de bouw |
| Repositorykoppeling | `fabelpad/platform`, remote `origin`, branch/upstream `main` / `origin/main`; daarna uitsluitend documentatie en samenvoeging van de GitHub-initcommit |
| Toolchain web | Node `24.18.0`, pnpm `11.25.0`, Next.js `16.3.4`, React `19.2.6` |
| Host / gebruiker / checkout | `codex-worker-01` / `codex` / `/home/codex/repos/fabelpad` |
| Geteste runtime | `pnpm start --port 3017`, `http://127.0.0.1:3017`; echte Next.js-productiebuild |
| Externe configuratie | Geen Supabase-project, mailgateway, deployment of Google-provider aangesloten |

## Uitgevoerde controles

| Controle | Resultaat |
| --- | --- |
| Capaciteit vóór installatie | Circa 39 GiB en 13,7 miljoen inodes vrij; geen onbekende bestanden opgeruimd |
| Capaciteit vóór laatste webbouw | 37.157.449.728 vrije bytes / 13.747.907 vrije inodes; preflight geslaagd |
| `pnpm install --frozen-lockfile` | Geslaagd; vastgelegde Node/pnpm-pins |
| `pnpm check:config` | Lokale demo zonder accounts geldig; ontbrekende stagingwaarden en onveilige publieke namen/keys worden geweigerd zonder waarden te loggen |
| `pnpm typecheck` | Geslaagd |
| `pnpm check:content` | Elf gerichte domeinchecks en deterministische native exportvergelijking geslaagd |
| Contentcontract | 13 verhalen, 403 scènes, 416 eindroutes, 15 assets; native catalogushash `4e48e9296a01fff5` |
| `pnpm check:backend` | Geslaagd: PostgreSQL WASM/PGlite, echte migratie, RLS met twee ouders, directe RPC-manipulaties, revisies/CAS/replay, expliciete beheerdersrechten, conceptisolatie, onveranderlijke/idempotente publicaties, catalogus bij >1000 releases |
| Browser/server/PostgreSQL-contenthash | Alle dertien releases gebruiken dezelfde canonieke JSON/hash en ongewijzigde vertakkingen |
| `node scripts/family-backend-check.mjs` | Historische SQLite-adapter onder `legacy/d1/` nog uitvoerbaar en geslaagd; niet de huidige backend |
| `pnpm check:native` | Geslaagd: inhoud, stationsacties, dubbele tik, timercleanup, profielhervatten, opslagfout en schrijf-/wisvolgorde |
| `bash scripts/local-build.sh` | Geslaagd: build-lock, preflight, configuratie, webtypen/domein/backend/native-contracten en echte `next build` |
| Browserregressies | Zes Playwright-tests geslaagd tegen de gebouwde lokale server |
| Visuele controle | Desktopwebsite en stationslezer bekeken; telefoonbibliotheek/screenshot beschikbaar onder `artifacts/screenshots/` |
| Native install/typecheck/Expo | Geslaagd; Expo Doctor 20/20, dependencycompatibiliteit gecontroleerd |
| Metro-export | Geslaagd: 1156 modules, 15 assets, Android Hermes-bundle |
| Android SDK-/Gradle-build | Standalone arm64-demo-APK gebouwd; package-, SDK-, signatuur- en ZIP-uitlijningscontrole geslaagd; zie `mobile/VALIDATIE.md` |
| GitHub CI | Verificatieworkflow aanwezig; de eerste push start een run. De actuele uitslag is afzonderlijk te controleren via [Actions](https://github.com/fabelpad/platform/actions) |
| Staging/productie/Play | Niet uitgerold of gepubliceerd |

De zes browserchecks bewijzen: gescheiden website-/lees-/review-/account-/beheerroutes; lezen, hervatten, beloning en behoud van een begonnen contentversie; dubbele tik; telefoonweergave en opslagfout; stationsactie en sluiten tijdens vertrek; en de gerepareerde ouder-/studioflows. De laatste twee gebruiken expliciet onderschepte sessie-/API-antwoorden om UI-regressies te testen. Zij bewijzen geen werkende externe authenticatie.

De PostgreSQL-test gebruikt beperkte Auth-stubs en één WASM-databaseverbinding. Hij bewijst het SQL-/RLS-/RPC-contract, geen echte Supabase OTP/OAuth, multi-connection-lockcontention of netwerkgedrag op twee fysieke apparaten.

## Nog afzonderlijk te bewijzen of te implementeren

- Hosted Supabase-migraties/advisors, echte login/cookies/sessieherstel en gezinsisolatie met twee echte accounts.
- Google-login met web-/Android-callbacks en de werkelijk gebruikte signingcertificaten.
- DG Auth-mailgateway, duurzame applicatie-outbox, worker, retries, webhooks/reconciliatie en mailboxontvangst; providerflags blijven standaard uit.
- Native cloudlogin/synchronisatie en cross-device conflictacceptatie. De huidige native APK is een zelfstandige lokale demo zonder backend.
- Supabase mediaopslag/uploadbeleid, geautomatiseerde accountverwijdering/sessierevocatie en definitieve privacy-/supportgegevens.
- Servergestuurde commerciële toegang/abonnementen en Play Billing. De lokale contentcatalogus is volledig publiek; de demo-toegangstest is geen betaalautorisatie.
- Stagingdeployment met exacte runtime-SHA, juiste doelrunner, versleutelde backup/herstelbewijs en geverifieerd rollbackpad.
- APK-installatie/koude start/offline lezen op een toestel, terugknop, rotatie/tablet, tekstschaling, verminderde beweging, TTS en audio-onderbreking. Geen 60-fps- of geheugencijfers zonder toestelmetingen.
- Productie-package-ID, uploadsigning, productie-AAB, interne Play-testdistributie en eventuele latere openbare release.

De broncode bouwt en de lokale demo werkt; bovenstaande echte integraties zijn geen geslaagde productieacceptatie. De volledige benodigde gegevenslijst staat in [INRICHTING.md](INRICHTING.md).

De Android-demo is als prerelease beschikbaar via [GitHub Releases](https://github.com/fabelpad/platform/releases/tag/demo-android-0.1.0-045c863). De APK hoort bij de geteste broncommit hierboven; documentatie-/integratiecommits daarna vormen geen nieuwe native build.
