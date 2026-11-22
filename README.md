# Fabelpad

Android-productie 1.0.0 (1), `nl.fabelpad.app`: gratis lokale leesapp zonder accounts of abonnementen. Zie het [bouwbewijs](docs/ANDROID-PRODUCTIE-VALIDATIE.md), [Play Console-invulblad](docs/GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md) en [signing-/release-runbook](docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md) voor het uploadbestand en de eenmalige Cloud-inrichting.

Repository: [fabelpad/platform](https://github.com/fabelpad/platform), integratiebranch `main`. De actuele twee-omgevingeninrichting staat in [STAGING-PRODUCTION-STATUS.md](docs/STAGING-PRODUCTION-STATUS.md).

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

Voor echte verbindingen: kopieer `.env.example` naar een nog niet bestaand `.env.local` en vul de eigen publieke projectgegevens in. Bewaar secrets buiten Git. De twee bestaande GitHub environments `staging` en `production` bevatten uitsluitend de vier afgesproken variabelen. Staging gebruikt Supabase-account **fabelpad**; production gebruikt **Duindorpdoet**. Zie [supabase/README.md](supabase/README.md).

Op 22 november zijn schema, beheerderbootstrap en 13 bronverhalen in beide lege Supabase-projecten ingericht. De ondertekende `auth-email` Edge Function staat in beide projecten, met één gedeelde Fabelpad-renderer en Resend API-transport. Er zijn [26 plakklare Auth-templates](docs/EMAIL-TEMPLATES.md). Secrets/Auth-instellingen en echte OTP-bezorging zijn nog niet geverifieerd; er zijn nog geen Auth-gebruikers of verzonden mails. **info@dgwebservices.nl** krijgt de eerste beheerrol na daadwerkelijke adresbevestiging. [Mailconfiguratie en resterende stappen](docs/EMAIL-CONFIGURATIE.md).

De beheeromgeving heeft **E-mail** (`/studio/email`) voor de Resend-koppeling, afzender, antwoordadressen, voettekst en testmail, en **E-mailtemplates** (`/studio/email/templates`) voor alle 17 templates met teksteditor en voorbeeld. De key staat na opslag versleuteld in het eigen Supabase Vault; opslaan vereist een geaccepteerde test naar de bevestigde beheerder. Zie [de beheerhandleiding](docs/EMAIL-BEHEER.md) voor eerste inrichting en gebruik. De pagina's worden zichtbaar bij een afzonderlijk vrijgegeven apprelease.

Native cloudlogin/synchronisatie, Play Billing, geautomatiseerde accountverwijdering en Supabase Storage vallen buiten de bestaande lokale native release. Webaccountverwijdering verloopt via het publieke supportverzoek. De catalogus is publiek; betaalde toegang wordt niet afgedwongen. Voorstelprijzen en pakketgrenzen zijn geen commerciële besluiten.

## Controles

```bash
pnpm typecheck
pnpm check:config
pnpm check:content
pnpm check:backend
pnpm check:email
pnpm check:deploy
pnpm check:native
pnpm build
```

`check:content` controleert profielen, cloudwachtrij/conflicten, alle verhalen, tekstgroei, speelactie, modal-scroll, cacheprivacy en toegang-/publicatiedemo. De native export wordt opnieuw gegenereerd en vergeleken met de vastgelegde bron.

`check:backend` voert de echte migratie lokaal uit in PostgreSQL WASM (PGlite), met beperkte Auth-stubs: twee ouders, RLS, gemanipuleerde writes, CAS/replay, beheerrechten, conceptisolatie en onveranderlijke publicaties. Server/browser/PostgreSQL gebruiken dezelfde canonieke contenthash. Dit bewijst geen hosted Supabase Auth, echte mailbox/OAuth of multi-device netwerkwerking.

Browserregressies staan in `tests/browser/`. Start eerst de gebouwde server op poort 3017 en voer `pnpm test:browser` uit. Gebruik eventueel `FABELPAD_TEST_URL` en een aanwezige Chromium via `FABELPAD_CHROMIUM_PATH`. De tests controleren echte lokale routes, lezen/hervatten, versiebehoud, dubbele tikken en opslagfouten.

## Android

[Download de Android-demo-APK via GitHub](https://github.com/fabelpad/platform/releases/tag/demo-android-0.1.0-045c863) (arm64, versie 0.1.0; toegang tot deze privérepository vereist).

Zie [mobile/README.md](mobile/README.md) voor installatie, Expo/Gradle-toolchain, de lokale demo-APK en productievariabelen. [mobile/VALIDATIE.md](mobile/VALIDATIE.md) bevat het werkelijk behaalde bewijs en de resterende toestelchecks. Een Metro-export is geen APK; een APK is geen Play-release of prestatiemeting.

## Inrichting en release

- [Benodigde gegevens, accounts, variabelen en secrets](docs/INRICHTING.md)
- [Actueel projectprofiel](docs/PROJECTPROFIEL.md)
- [Bouw-, backup- en releaserunbook](docs/RUNBOOK.md)
- [Lokale validatie en verificatiegrenzen](docs/LOKALE-VALIDATIE.md)
- [Releasegates](.github/RELEASE-GATES.md)

De DG-webroute gebruikt native Next.js, gescheiden self-hosted doelrunners, root-owned projectadapters, systemd en Caddy. Beide doelen op `dg-vps-08` zijn voorbereid met eigen rollen/paden/poorten. Er staan nog geen doelkandidaten of actieve releases. De runners zijn ongeregistreerd totdat de vereiste beperkte organisatiegroep beschikbaar is. De zes handmatige workflows bouwen, activeren of herstellen één eigen doel; zie [het tweedoelenrunbook](docs/DG-VPS-08-TWEE-OMGEVINGEN.md). Gewone web-CI valideert alleen; controleer vóór main-merge ook de bestaande Android-/Play- en eventuele externe integraties.

De oorspronkelijke [prototypeoverdracht](docs/FABELPAD-CODEX-OVERDRACHT.md) blijft historische context; de oude Docker-/SMTP-/Workers-voorstellen zijn niet het huidige releasepad.
