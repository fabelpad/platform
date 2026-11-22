# Fabelpad

Android-productie 1.0.0 (1), `nl.fabelpad.app`: gratis lokale leesapp zonder accounts of abonnementen. Zie het [bouwbewijs](docs/ANDROID-PRODUCTIE-VALIDATIE.md), [Play Console-invulblad](docs/GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md) en [signing-/release-runbook](docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md) voor het uploadbestand en de eenmalige Cloud-inrichting.

Repository: [fabelpad/platform](https://github.com/fabelpad/platform), integratiebranch `main`. De actuele twee-omgevingeninrichting staat in [STAGING-PRODUCTION-STATUS.md](docs/STAGING-PRODUCTION-STATUS.md).

Webstatus 22 november 2026: **[staging.fabelpad.nl](https://staging.fabelpad.nl) is actief voor eigenaaracceptatie**. Beide VPS-apps en databases zijn bijgewerkt; productie draait intern en haar publieke route blijft uit. De afzonderlijke Resend API-key wordt na echte eerste beheerderlogin via **Beheer → E-mail** gekoppeld. Auth blijft Supabase Custom SMTP via Resend gebruiken.

Nederlandstalige interactieve verhalenwereld voor kinderen van 4–8 jaar. De webdienst gebruikt Next.js en bevat daarnaast een afzonderlijke Expo/React Native-app.

## Lokaal starten

Gebruik Node **24.18.0** en pnpm **11.25.0**.

```bash
node scripts/local-preflight.mjs
pnpm install --frozen-lockfile
bash scripts/local-build.sh
pnpm start
```

Open `http://localhost:3000`. De lokale leesapp heeft geen externe accounts of secrets nodig. `pnpm dev` start de ontwikkelserver. Een andere poort: `pnpm start --port 3017`. De server bindt aan loopback. Staging en productie gebruiken hun eigen echte Supabase-project.

| Route | Functie |
| --- | --- |
| `/` | Website, verhaalvoorbeelden en uitleg |
| `/lezen` | Direct bruikbare lokale kinderleesapp |
| `/ouders` | Ouderomgeving voor profielen en instellingen; online via de eigen gezinsomgeving |
| `/inloggen` | Supabase e-mail-OTP/Google op staging; eerste account via **Ouderaccount maken**; lokale modus heeft geen online login |
| `/gezin` | Gezinsomgeving met geverifieerde ouderidentiteit en synchronisatiecontract |
| `/studio` | Verhalenstudio met servergecontroleerde beheerdersrechten |
| `/privacy`, `/support`, `/account-verwijderen` | Privacyversie, ondersteuning en account-/gegevensverwijdering |

De primaire leesroute heeft geen ontwikkelmenu of automatische boekopening. Historische reviewlinks leiden naar de gewone leesomgeving.

## Wat lokaal beschikbaar is

- Alle dertien verhalen, 403 bereikbare scènes, 416 eindroutes en oorspronkelijke illustraties/teksten/keuzebetekenissen.
- Lokale kindprofielen, zoeken, filters, favorieten, hervatten, beloningen en verhaalgeheugen.
- De stationsspeelprent met begrensde acties, bescherming tegen dubbele keuzes en opgeruimde callbacks.
- Voorlezen met de aanwezige browser-/apparaatstem; stoppen bij verlaten of achtergrond. Offline Nederlandse stemmen zijn niet gegarandeerd.
- Begin van een webavontuur pinnen aan `storyId`, `contentVersion`, `picks` en revisie. Volledige releases worden lokaal gecachet; ontbrekende oude releases worden niet stilzwijgend vervangen.
- Lokale profielinstellingen en de afzonderlijke geauthenticeerde ouder-/beheeromgeving.
- Native componenten, lokale opslag, eigen profielvoortgang en dezelfde volledige catalogus in `mobile/`, zonder WebView.

Geblokkeerde lokale opslag wordt zichtbaar. Browserdownloads bevatten afbeeldingen en verhaalroutes, maar account-/navigatie-HTML wordt uit privacyoverwegingen niet gecachet. **Koud starten van de webapp zonder internet is nog niet beschikbaar.** De native app bundelt de oorspronkelijke content; werkelijk toestelgedrag wordt afzonderlijk getest.

## Backend en webomgeving

`supabase/migrations/` bevat het PostgreSQL-contract voor oudergebonden gezinsdocumenten, revisiecontrole, expliciete beheerdersrechten, afgeschermde concepten en onveranderlijke contentreleases. Serverroutes verifiëren Supabase-sessies; RLS/RPC beperkt eigendom. De webserver heeft geen service-role key nodig. Concepten worden pas na validatie gepubliceerd. Lokale browserconcepten kunnen uitsluitend via een expliciete importactie in de beheerstudio worden overgenomen.

Voor echte verbindingen: kopieer `.env.example` naar een nog niet bestaand `.env.local` en vul de eigen publieke projectgegevens in. Bewaar secrets buiten Git. De twee bestaande GitHub environments `staging` en `production` bevatten uitsluitend de vier afgesproken variabelen. Staging gebruikt Supabase-account **fabelpad**; production gebruikt **Duindorpdoet**. Zie [supabase/README.md](supabase/README.md).

Op 22 november zijn elf migraties en 13 bronverhalen in beide Supabase-projecten ingericht en gecontroleerd. Privacyversie `2026-11-22.1` en vaste 210-dagenbewaring voor minimale wisbewijzen blijven live. De nieuwe registratie bewaart de 18+/ouderverklaring en voorwaardenkeuze eenmaal; de profielcontrole herkent correct geordende én door JSONB anders geordende antwoorden. Beide appservices draaien de gecontroleerde bron `003670aad04ecdf761b21627d8624dea50403ae5`; 43 lokale browsertests en beide verplichte CI-controles slagen. Staging slaagt publiek voor 23 HTTP- en 67 mobiele browsercontroles; productie-HTTPS blijft uit. De finale databasecontrole bevestigt staging 1 gebruiker / 1 geldig gezin / 1 aanvaarding en production 0 / 0 / 0, met behoud van bestaande gegevens. Zie het [releasebewijs](docs/deploy-evidence/registration-release-2026-11-22.json).

Auth gebruikt de door de eigenaar ingerichte Custom SMTP-koppeling via Resend; de voorbereide `auth-email` Send Email Hook is niet actief. De eigenaar heeft de [Auth-templates](docs/EMAIL-TEMPLATES.md) overgenomen. De afzonderlijke Resend API-koppeling en test worden beheerd via `/studio/email`, templates via `/studio/email/templates`. Nieuwe interactieve OTP-/Google-registratie en inboxbezorging worden niet door de synthetische of anonieme controles bewezen. **info@dgwebservices.nl** blijft het beoogde eerste beheerdersadres per project na echte adresbevestiging en afgeronde serveronboarding. [Mailbeheer en eerste inrichting](docs/EMAIL-BEHEER.md).

De beheeromgeving heeft **E-mail** (`/studio/email`) voor de Resend-koppeling, afzender, antwoordadressen, voettekst en testmail, en **E-mailtemplates** (`/studio/email/templates`) voor alle 17 templates met teksteditor en voorbeeld. Deze pagina's staan op staging en vereisen een bevestigde beheerder. De key staat na opslag versleuteld in het eigen Supabase Vault; opslaan vereist een geaccepteerde test naar de bevestigde beheerder. Zie [de beheerhandleiding](docs/EMAIL-BEHEER.md) voor eerste inrichting en gebruik. SMTP-Auth-teksten worden na aanpassen afzonderlijk naar Supabase geëxporteerd; servicemails gebruiken opgeslagen wijzigingen rechtstreeks.

Native cloudlogin/synchronisatie, Play Billing, geautomatiseerde accountverwijdering en Supabase Storage vallen buiten de bestaande lokale native release. Webaccounts hebben servergestuurde verwijdering met 30 dagen hersteltermijn; onafgeronde onboarding vervalt na 7 dagen. De eigen onderhoudscron is actief. Automatische 90-dageninactiviteitswissing blijft uit tot mailwaarschuwingen en overgangscontrole zijn geaccepteerd. Privacyverzoeken kunnen daarnaast via de publieke supportroute worden ingediend. Back-uprotatie (maximaal 180 dagen) en Stackmail-opschoning (maximaal 12 maanden na afsluiting) worden buiten de app uitgevoerd. De catalogus is publiek; er is geen actieve betaalroute.

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

De productie-app is `nl.fabelpad.app`, versie 1.0.0 (1). Het [productiebouwbewijs](docs/ANDROID-PRODUCTIE-VALIDATIE.md) en [Play-releaseproces](docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md) beschrijven het uploadbestand, ondertekening en de afzonderlijke publicatiestappen. [mobile/VALIDATIE.md](mobile/VALIDATIE.md) bevat de toestelcontroles en hun grenzen. De webwijzigingen publiceren geen nieuwe Android-versie.

## Inrichting en release

- [Benodigde gegevens, accounts, variabelen en secrets](docs/INRICHTING.md)
- [Actueel projectprofiel](docs/PROJECTPROFIEL.md)
- [Bouw-, backup- en releaserunbook](docs/RUNBOOK.md)
- [Lokale validatie en verificatiegrenzen](docs/LOKALE-VALIDATIE.md)
- [Releasegates](.github/RELEASE-GATES.md)

De DG-webroute gebruikt Next.js, gescheiden repositoryrunners, root-owned projectadapters, systemd en Caddy. Beide doelen op `dg-vps-08` hebben actieve releases en hun eigen rollen/paden/poorten. De zes handmatige workflows bouwen, activeren of herstellen één eigen doel; zie [het tweedoelenrunbook](docs/DG-VPS-08-TWEE-OMGEVINGEN.md). Staging is via HTTPS bereikbaar; de actuele productie-openstelling staat in het statusdocument. Gewone web-CI valideert alleen; controleer vóór main-merge ook de bestaande Android-/Play- en eventuele externe integraties.
