# Fabelpad

Android-productie 1.0.0 (1), `nl.fabelpad.app`: gratis lokale leesapp zonder accounts of abonnementen. Zie het [bouwbewijs](docs/ANDROID-PRODUCTIE-VALIDATIE.md), [Play Console-invulblad](docs/GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md) en [signing-/release-runbook](docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md) voor het uploadbestand en de eenmalige Cloud-inrichting.

Repository: [fabelpad/platform](https://github.com/fabelpad/platform), integratiebranch `main`. De actuele twee-omgevingeninrichting staat in [STAGING-PRODUCTION-STATUS.md](docs/STAGING-PRODUCTION-STATUS.md).

Webstatus **23 november 2026, Europe/Amsterdam**: **[staging.fabelpad.nl](https://staging.fabelpad.nl) is actief voor eigenaaracceptatie**. Beide VPS-apps draaien de gecontroleerde bron `ec82395ba57904302bc4a93e71e5dba63def2950` met 13 avonturen, 65 hoofdstukken en drie leesniveaus; productie draait intern en haar publieke route blijft uit. De afzonderlijke Resend API-koppeling wordt via **Beheer → E-mail** beheerd. Auth blijft Supabase Custom SMTP via Resend gebruiken. Zie het [actuele releasebewijs](docs/deploy-evidence/complete-release-2026-11-23.json) en de [validatie van avonturen en leesniveaus](docs/VALIDATIE-AVONTUREN-2026-11-23.md).

Nederlandstalige interactieve verhalenwereld voor kinderen en hun ouders. De webdienst gebruikt Next.js en bevat daarnaast een afzonderlijke Expo/React Native-app.

De abonnementenuitbreiding voegt **Beheer → Abonnementen & betalingen**, Founders, kortingscodes, Mollie op het web en een afzonderlijke gekoppelde Android-variant met Google Play Billing toe. Alle vier de betaalschakelaars beginnen uit. Webgebruik op Apple-apparaten gebruikt dezelfde Mollie-route. Kortingscodes ondersteunen percentage of bedrag, per betaling of per maand, en een aantal kalendermaanden of onbeperkte duur. De bestaande lokale Android-bundels blijven bruikbaar. Zie [de beheerhandleiding](docs/BETALINGEN-BEHEER.md) voor inrichting, providerproeven en resterende Console-stappen. Code en lokale tests bewijzen op zichzelf geen live betaalroute of storepublicatie.

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

- Alle dertien avonturen met vijf hoofdstukken, twee keuzes en een speelprent per hoofdstuk: 65 hoofdstukken, 403 bereikbare hoofdstukvarianten en 416 eindroutes per leesniveau, met behouden verhaal-ID’s, route-indexen en aandenkens.
- Lokale kindprofielen, zoeken, filters, favorieten, hervatten, beloningen en verhaalgeheugen.
- Drie volledige leesniveaus, standaard 6 t/m 8 jaar; niveauwisselen behoudt route/hoofdstuk/voortgang. De hero staat boven de tekst, speelprent of keuzeknoppen eronder. De twee speciale stationsopdrachten, treinanimatie, bescherming tegen dubbele keuzes en callbackopruiming blijven behouden.
- Voltooide routes teruglezen of vanaf hoofdstuk één opnieuw spelen; de laatst voltooide route/contentversie blijft per profiel bewaard.
- Voorlezen met de aanwezige browser-/apparaatstem; stoppen bij verlaten of achtergrond. Offline Nederlandse stemmen zijn niet gegarandeerd.
- Begin van een webavontuur pinnen aan `storyId`, `contentVersion`, `picks` en revisie. Volledige releases worden lokaal gecachet; ontbrekende oude releases worden niet stilzwijgend vervangen.
- Lokale profielinstellingen en de afzonderlijke geauthenticeerde ouder-/beheeromgeving.
- Native componenten, lokale opslag, eigen profielvoortgang en dezelfde volledige catalogus in `mobile/`, zonder WebView.

Geblokkeerde lokale opslag wordt zichtbaar. Browserdownloads bevatten afbeeldingen en verhaalroutes, maar account-/navigatie-HTML wordt uit privacyoverwegingen niet gecachet. **Koud starten van de webapp zonder internet is nog niet beschikbaar.** De native app bundelt alle drie leesniveaus en de gecontroleerde illustraties; werkelijk toestelgedrag wordt afzonderlijk getest.

## Backend en webomgeving

`supabase/migrations/` bevat het PostgreSQL-contract voor oudergebonden gezinsdocumenten, revisiecontrole, expliciete beheerdersrechten, afgeschermde concepten en onveranderlijke contentreleases. Serverroutes verifiëren Supabase-sessies; RLS/RPC beperkt eigendom. De webserver heeft geen service-role key nodig. Concepten worden pas na validatie gepubliceerd. Lokale browserconcepten kunnen uitsluitend via een expliciete importactie in de beheerstudio worden overgenomen.

Voor echte verbindingen: kopieer `.env.example` naar een nog niet bestaand `.env.local` en vul de eigen publieke projectgegevens in. Bewaar secrets buiten Git. De twee bestaande GitHub environments `staging` en `production` bevatten uitsluitend de vier afgesproken variabelen. Staging gebruikt Supabase-account **fabelpad**; production gebruikt **Duindorpdoet**. Zie [supabase/README.md](supabase/README.md).

Beide Supabase-projecten hebben **12 migraties en 26 onveranderlijke verhaalreleases**: 13 oorspronkelijke releases bytegelijk behouden en 13 nieuwe releases met drie leesniveaus toegevoegd. Staging behoudt 1 Auth-gebruiker / 1 gezin, production 0 / 0; bestaande gebruikersgegevens zijn niet herschreven. De huidige appbron **`ec82395ba57904302bc4a93e71e5dba63def2950`** biedt op web en native Android alle **13 avonturen × 5 hoofdstukken × 2 keuzes**, drie volledige leesniveaus, herlezen en herstart met bewaarde laatste route. De hero staat vóór de volledige tekst, het keuzemoment eronder; keuze vijf opent de afsluiting met het bijbehorende aandenken. De schone build (**46,8 seconden**), **68/68 browsertests**, beide verplichte CI-controles, beide kandidaten en beide activeringen slagen. De native export bevat 20 gecontroleerde illustratiebestanden; native CI leverde een onafhankelijk gevalideerd **ongetekend productie-AAB**. Er is geen toesteltest, signing of Play-upload uitgevoerd. Publieke staging slaagt voor **23 HTTP/TLS- en 1817 browsercontroles**; productie-HTTPS blijft uit. Privacyversie `2026-11-22.1`, voorwaarden `2026-11-22`, eenmaal verklaren bij registratie, profieltoestemming, 210 dagen voor minimaal gehashte wisbewijzen en de bestaande mail-/bewaarroutes blijven behouden. Zie [releasebewijs](docs/deploy-evidence/complete-release-2026-11-23.json), [avonturenvalidatie](docs/VALIDATIE-AVONTUREN-2026-11-23.md), [stagingdatabase](docs/deploy-evidence/complete-database-staging-2026-11-23.json) en [productiedatabase](docs/deploy-evidence/complete-database-production-2026-11-23.json). CI- en activeringsclaims gelden uitsluitend voor deze appcommit; een latere documentatiecommit is geen opnieuw gebouwde app.

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

`check:content` controleert profielen, cloudwachtrij/conflicten, alle verhalen, tekstgroei, 403 hoofdstukvarianten en 416 eindroutes per leesniveau, speelacties, modal-scroll, cacheprivacy en toegangs-/publicatiecontracten. De native export met alle niveaus, illustraties en onveranderlijke historische releasearchieven wordt opnieuw gegenereerd en vergeleken met de vastgelegde bron.

`check:backend` voert de echte migratie lokaal uit in PostgreSQL WASM (PGlite), met beperkte Auth-stubs: twee ouders, RLS, gemanipuleerde writes, CAS/replay, beheerrechten, conceptisolatie en onveranderlijke publicaties. Server/browser/PostgreSQL gebruiken dezelfde canonieke contenthash. Dit bewijst geen hosted Supabase Auth, echte mailbox/OAuth of multi-device netwerkwerking.

Browserregressies staan in `tests/browser/`. Start eerst de gebouwde server op poort 3017 en voer `pnpm test:browser` uit. Gebruik eventueel `FABELPAD_TEST_URL` en een aanwezige Chromium via `FABELPAD_CHROMIUM_PATH`. De tests controleren echte lokale routes, lezen/hervatten, versiebehoud, dubbele tikken en opslagfouten.

## Android

De productie-app is `nl.fabelpad.app`, versie 1.0.0 (1). De huidige bron bevat ook de native leesniveau-/speelprentintegratie. De [native validatie](docs/deploy-evidence/complete-native-validation-2026-11-23.json) en [ongetekende CI-/AAB-inspectie](docs/deploy-evidence/complete-native-ci-2026-11-23.json) beschrijven de werkelijk gecontroleerde build; signing en Google Play-upload zijn niet uitgevoerd. Het [bestaande Play-releaseproces](docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md) blijft een afzonderlijke publicatiestap. [mobile/VALIDATIE.md](mobile/VALIDATIE.md) beschrijft de resterende toestelcontroles.

## Inrichting en release

- [Benodigde gegevens, accounts, variabelen en secrets](docs/INRICHTING.md)
- [Actueel projectprofiel](docs/PROJECTPROFIEL.md)
- [Bouw-, backup- en releaserunbook](docs/RUNBOOK.md)
- [Lokale validatie en verificatiegrenzen](docs/LOKALE-VALIDATIE.md)
- [Releasegates](.github/RELEASE-GATES.md)

De DG-webroute gebruikt Next.js, gescheiden repositoryrunners, root-owned projectadapters, systemd en Caddy. Beide doelen op `dg-vps-08` hebben actieve releases en hun eigen rollen/paden/poorten. De zes handmatige workflows bouwen, activeren of herstellen één eigen doel; zie [het tweedoelenrunbook](docs/DG-VPS-08-TWEE-OMGEVINGEN.md). Staging is via HTTPS bereikbaar; de actuele productie-openstelling staat in het statusdocument. Gewone web-CI valideert alleen; controleer vóór main-merge ook de bestaande Android-/Play- en eventuele externe integraties.
