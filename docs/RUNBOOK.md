# Fabelpad — lokaal controleren en releases voorbereiden

Bijgewerkt: **22 november 2026**. Repository: `https://github.com/fabelpad/platform.git`; integratiebranch: `main`. De actuele inrichting betreft **staging én production op dg-vps-08**, met afzonderlijke Supabase-projecten. Het hostcontract, build-/activatie-/herstelopdrachten en controles staan in [DG-VPS-08-TWEE-OMGEVINGEN.md](DG-VPS-08-TWEE-OMGEVINGEN.md). De [actuele status](STAGING-PRODUCTION-STATUS.md) benoemt de nog ontbrekende provider- en runneracceptatie.

## Lokale installatie en veilige configuratie

Gebruik Node **24.18.0** uit `.nvmrc` en pnpm **11.25.0** uit `package.json`. Web gebruikt `pnpm-lock.yaml`; `mobile/` heeft een afzonderlijk npm-lockfile.

```bash
node scripts/local-preflight.mjs
pnpm install --frozen-lockfile
cp --no-clobber .env.example .env.local
pnpm check:config
```

Kopieer het voorbeeld alleen als `.env.local` nog niet bestaat. Gebruik een eigen lokale datamodus en synthetische profielen zonder Supabase-/providercredentials van bestaande omgevingen. Voor de nieuwe webdeploy zijn slechts vier GitHub-variabelen toegestaan; zie [INRICHTING.md](INRICHTING.md). De exacte geldige datamoduswaarden staan in `.env.example` en de validator.

De preflight controleert pins, bytes en inodes. Lokale ondergrenzen zijn 4 GiB/50.000 inodes voor web en 12 GiB/100.000 voor Android. Dit vervangt geen doelhostbudget voor releases en backups. Verwijder geen actieve release, herstelpunt of onbekende map om plaats te maken.

## Webcontroles en echte Next-runtime

```bash
bash scripts/local-build.sh
pnpm start --port 3017
```

De lokale build gebruikt `flock` en voert configuratie-, TypeScript-, content-, PostgreSQL-/Auth-, e-mail-, deploy- en native runtimecontractcontroles uit, gevolgd door `pnpm build`. Het lokale standaardlock serialiseert de eigen checkout. Een doelbuild gebruikt het geverifieerde hostlock en een aparte werkmap; installeer niet gelijktijdig dependencies in dezelfde checkout.

`pnpm start` bindt de bestaande Next.js-server aan loopback. Controleer op een vrije eigen lokale poort:

```bash
curl --fail --silent --show-error http://127.0.0.1:3017/api/health
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3017/privacy
```

| Route | Acceptatiegrens |
| --- | --- |
| `/`, `/lezen`, `/ouders`, `/demo` | Website/lokale lees- en reviewfuncties; lokale data zijn geen echte cloudaccounts |
| `/inloggen`, `/gezin`, `/studio` | Echte sessie-/autorisatiegrens; alleen beschikbaar met expliciet geconfigureerde backend |
| `/privacy`, `/support`, `/account-verwijderen` | Publieke dienstpagina's; hosting en definitieve juridische gegevens afzonderlijk controleren |
| `/api/health` | Process-liveness met release-/omgevingmetadata; geen bewijs van backendreadiness |

`pnpm check:content` controleert profielen, synchronisatiecontracten, verhaalkeuzes/geheugen, catalogus, tekstgroei, speelacties, modals, cache en gedeelde content. Native content wordt met de vastgelegde content/assets gecontroleerd. Bij een bedoelde broncontentwijziging: voer `pnpm content:export` uit en beoordeel alle gegenereerde wijzigingen; bestaande verhaalreleasebestanden blijven onveranderlijk.

`pnpm check:backend` gebruikt PostgreSQL/RLS/RPC-tests in PGlite, servercontracten en 25 scenario's met de geïnstalleerde Auth/SSR-SDK en een synthetische provider. `pnpm check:email` controleert de HTML-exports, hookhandtekeningen, Resend-transport en de configuratietool. Deze controles bewijzen geen gehoste OTP-bezorging of echte synchronisatie. De oude D1/SQLite-code onder `legacy/` is historische referentie.

## Supabase en Resend afronden

Controleer eerst de mapping in [PROJECTPROFIEL.md](PROJECTPROFIEL.md). De schemawijzigingen en content zijn al in beide projecten toegepast; voer ze niet blind opnieuw uit. Volg [EMAIL-CONFIGURATIE.md](EMAIL-CONFIGURATIE.md) voor de veilige terminaltool en [EMAIL-TEMPLATES.md](EMAIL-TEMPLATES.md) voor de 13 HTML-velden per omgeving. Keys worden verborgen gevraagd en blijven uit GitHub, bestanden en uitvoer.

Test staging eerst: OTP aanvragen, bezorging controleren, code bevestigen, sessie opvragen, aangewezen beheerder en studio controleren, tweede synthetische ouder en gegevensisolatie testen, uitloggen. Herhaal afzonderlijk in production met minimale testdata. Leg geen OTP/token of echte gezinsgegevens vast. Pas daarna de eigen host-readinessontvangst aanleggen. Een account bestaat pas na de echte Auth-aanvraag; de eerste beheerder wordt pas na geverifieerd bezit toegekend.

## Schone verificatie vóór oplevering

Voer een releasecontrole uit in een aparte schone werkmap uit één vastgelegde commit. Gebruik `git archive` of een geïsoleerde worktree zonder `.env.local`, `.next`, `node_modules` of ongecommitteerde bestanden uit de ontwikkelcheckout over te nemen. Leg volledige SHA en resultaat vast. Installeer uit het gecommitte lockbestand en draai dezelfde normale projectcommando's. Een aangepaste werkboom kan aanvullend getest worden, maar telt niet als schone commitbuild.

```bash
git status --short
node scripts/local-preflight.mjs
pnpm install --frozen-lockfile
bash scripts/local-build.sh
```

Een lokale productiebundel is geen kandidaat op de doel-VPS. Pas wanneer de doelrunner, exacte main-SHA met geslaagde vereiste CI, veilige doelconfiguratie en capaciteit beschikbaar zijn, kan de afzonderlijke kandidaatworkflow bouwen. De buildroute activeert geen app.

## Native Android

De eerste native productieversie is **Fabelpad 1.0.0 (1), `nl.fabelpad.app`**, gratis en lokaal zonder accounts of abonnementen. Deze webdeployopdracht verandert die scope niet. Volg voor Android het [Play-runbook](GOOGLE-PLAY-RELEASE-RUNBOOK.md), het [productie-invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md) en het [buildbewijs](ANDROID-PRODUCTIE-VALIDATIE.md). Historische demoresultaten in `mobile/VALIDATIE.md` zijn geen actuele productiestatus.

Reguliere broncontroles:

```bash
node scripts/local-preflight.mjs --android
npm ci --prefix mobile --no-audit --no-fund
npm run check --prefix mobile
CI=1 npm run export:android --prefix mobile
```

Metro-export is een JavaScript-/assetbundel. Het gesigneerde AAB-/APK-pad vereist de gecontroleerde JDK/Android-toolchain en beschermde uploadsleutel uit het native runbook. Sleutels en wachtwoorden blijven buiten Git, bundels, uitvoer en procesargumenten. Bestaande Android-/Play-workflows blijven aanwezig en ongeconfigureerde automatische publicatie blijft uit.

## CI en latere vrijgave

`.github/workflows/verify.yml` controleert de gepinde web-/nativetoolchain op een GitHub-runner. De bestaande Android-CI voert de afzonderlijke native controles uit. Een workflowbestand is geen geslaagde run; controleer de werkelijke uitslag op de volledige commit. Op pull requests kan `github.sha` een testmerge zijn: een release vereist de vastgelegde main-push-SHA en de daarvoor verplichte CI.

Volg de [releasegates](../.github/RELEASE-GATES.md) en het [doelrunbook](DG-VPS-08-TWEE-OMGEVINGEN.md). Alle nieuwe webdeployroutes zijn handmatig, projectspecifiek en gescheiden in kandidaatbouw en activering, met exact GitHub environment `staging` of `production`. Controleer vóór main-merge ook organisatieflags voor de bestaande Play-workflow en eventuele Supabase-GitHubkoppeling op automatische migraties/Edge-deployment.

Migraties en Auth-/mailproviderwijzigingen staan los van appbuilds. De huidige twee lege projecten zijn met expliciete eigenaarstoestemming ingericht. Bij latere gebruikersdata zijn passende backup-, herstel- en compatibiliteitscontroles nodig. Een approllback herstelt alleen de eigen vorige gezonde app/configuratie; geen database, provider of proxy. Inspecteer na een onderbroken installatie eerst de eigen service, verwijzingen en manifesten. Geef alleen uitgevoerde controles als geslaagd weer.
