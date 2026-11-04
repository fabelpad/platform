# Fabelpad

Nederlandstalige interactieve verhalenwereld voor kinderen van 4–8 jaar. Deze checkout bouwt lokaal met native Next.js en bevat een afzonderlijke Expo/React Native-app. Het aangeleverde prototype is behouden in importcommit `a7475c4573d3f125be337eb315c574945c64352c`; de pakketmetadata verwijst naar oorspronkelijke broncommit `97c3881d6bd94f41596ce77fb7a53d55936c6397`.

## Lokaal starten

Gebruik Node **24.18.0** en pnpm **11.25.0**.

```bash
node scripts/local-preflight.mjs
pnpm install --frozen-lockfile
bash scripts/local-build.sh
pnpm start
```

Open `http://localhost:3000`. De demo heeft geen externe accounts of secrets nodig. `pnpm dev` start de ontwikkelserver. Een andere poort: `pnpm start --port 3017`. De server bindt aan loopback.

| Route | Functie |
| --- | --- |
| `/` | Website, verhaalvoorbeelden en uitleg |
| `/lezen` | Direct bruikbare lokale kinderleesapp |
| `/ouders` | Lokale ouderdemo: profielen, instellingen, downloads en toegangsmodel testen |
| `/demo` | Reviewroute met Website/Webapp/Android/Ouders/Verhalenstudio-balk |
| `/inloggen` | Supabase e-mail-OTP/Google; uitgeschakeld tot echte configuratie aanwezig is |
| `/gezin` | Gezinsomgeving met geverifieerde ouderidentiteit en synchronisatiecontract |
| `/studio` | Verhalenstudio met servergecontroleerde beheerdersrechten |
| `/privacy`, `/support`, `/account-verwijderen` | Dienstpagina's met expliciete nog ontbrekende gegevens |

De ontwerpschakelaar staat uitsluitend op `/demo`. De primaire leesroute heeft geen ontwikkelmenu of automatische boekopening. De Android-iframe op de reviewroute is alleen een browserpreview.

## Wat lokaal beschikbaar is

- Alle dertien verhalen, 403 bereikbare scènes, 416 eindroutes en oorspronkelijke illustraties/teksten/keuzebetekenissen.
- Lokale kindprofielen, zoeken, filters, favorieten, hervatten, beloningen en verhaalgeheugen.
- De stationsspeelprent met begrensde acties, bescherming tegen dubbele keuzes en opgeruimde callbacks.
- Voorlezen met de aanwezige browser-/apparaatstem; stoppen bij verlaten of achtergrond. Offline Nederlandse stemmen zijn niet gegarandeerd.
- Begin van een webavontuur pinnen aan `storyId`, `contentVersion`, `picks` en revisie. Volledige releases worden lokaal gecachet; ontbrekende oude releases worden niet stilzwijgend vervangen.
- Een herkenbare lokale ouder-/studiodemo. Demo-login verleent geen rechten op server-API's.
- Native componenten, lokale opslag, eigen profielvoortgang en dezelfde volledige catalogus in `mobile/`, zonder WebView.

Geblokkeerde lokale opslag wordt zichtbaar. Browserdownloads bevatten afbeeldingen en verhaalroutes, maar account-/navigatie-HTML wordt uit privacyoverwegingen niet gecachet. **Koud starten van de webapp zonder internet is nog niet beschikbaar.** De native app bundelt de oorspronkelijke content; werkelijk toestelgedrag wordt afzonderlijk getest.

## Backendvoorbereiding

`supabase/migrations/` bevat het PostgreSQL-contract voor oudergebonden gezinsdocumenten, revisiecontrole, expliciete beheerdersrechten, afgeschermde concepten en onveranderlijke contentreleases. Serverroutes verifiëren Supabase-sessies; RLS/RPC beperkt eigendom. De webserver heeft geen service-role key nodig. Concepten worden pas na validatie gepubliceerd. Lokale browserconcepten kunnen uitsluitend via een expliciete importactie in de beheerstudio worden overgenomen.

Voor echte verbindingen: kopieer `.env.example` naar `.env.local` en vul de eigen projectgegevens in. Bewaar secrets buiten Git. Email/Google blijven standaard uit tot providers, callbacks en de bestaande DG-mailgateway zijn ingericht. Zie [supabase/README.md](supabase/README.md).

Er zijn geen externe accounts/projecten aangemaakt, migraties toegepast, mails verstuurd of deployments uitgevoerd. Native cloudlogin/synchronisatie, productierechten/Play Billing, geautomatiseerde accountverwijdering, Supabase Storage en DG-mailgateway/outbox zijn nog niet volledig aangesloten. De volledige catalogus is in deze lokale fase publiek beschikbaar; betaalde toegang is niet afgedwongen. Voorstelprijzen en pakketgrenzen zijn geen commerciële besluiten.

## Controles

```bash
pnpm typecheck
pnpm check:config
pnpm check:content
pnpm check:backend
pnpm check:native
pnpm build
```

`check:content` controleert profielen, cloudwachtrij/conflicten, alle verhalen, tekstgroei, speelactie, modal-scroll, cacheprivacy en toegang-/publicatiedemo. De native export wordt opnieuw gegenereerd en vergeleken met de vastgelegde bron.

`check:backend` voert de echte migratie lokaal uit in PostgreSQL WASM (PGlite), met beperkte Auth-stubs: twee ouders, RLS, gemanipuleerde writes, CAS/replay, beheerrechten, conceptisolatie en onveranderlijke publicaties. Server/browser/PostgreSQL gebruiken dezelfde canonieke contenthash. Dit bewijst geen hosted Supabase Auth, echte mailbox/OAuth of multi-device netwerkwerking.

Browserregressies staan in `tests/browser/`. Start eerst de gebouwde server op poort 3017 en voer `pnpm test:browser` uit. Gebruik eventueel `FABELPAD_TEST_URL` en een aanwezige Chromium via `FABELPAD_CHROMIUM_PATH`. De tests controleren echte lokale routes, lezen/hervatten, versiebehoud, dubbele tikken en opslagfouten.

## Android

Zie [mobile/README.md](mobile/README.md) voor installatie, Expo/Gradle-toolchain, de lokale demo-APK en productievariabelen. [mobile/VALIDATIE.md](mobile/VALIDATIE.md) bevat het werkelijk behaalde bewijs en de resterende toestelchecks. Een Metro-export is geen APK; een APK is geen Play-release of prestatiemeting.

## Inrichting en release

- [Benodigde gegevens, accounts, variabelen en secrets](docs/INRICHTING.md)
- [Actueel projectprofiel](docs/PROJECTPROFIEL.md)
- [Bouw-, backup- en releaserunbook](docs/RUNBOOK.md)
- [Lokale validatie en verificatiegrenzen](docs/LOKALE-VALIDATIE.md)
- [Releasegates](.github/RELEASE-GATES.md)

De DG-webstandaard is een native Next.js-serverrelease via `dg-site-deploy`, self-hosted doelrunners en Caddy. Staging en productie bouwen dezelfde volledige broncommit elk met eigen configuratie. Het werkelijke wrappercontract, domeinen, projectrefs en runnergegevens ontbreken nog; deze checkout verzint daarvoor geen deploymentcommando's. De CI-workflow valideert alleen en is pas een uitgevoerde CI-run nadat de repository daadwerkelijk is gekoppeld.

De oorspronkelijke [prototypeoverdracht](docs/FABELPAD-CODEX-OVERDRACHT.md) blijft historische context; de oude Docker-/SMTP-/Workers-voorstellen zijn niet het huidige releasepad.
