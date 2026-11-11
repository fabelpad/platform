# Lokaal bouwen en later releasen

Dit runbook beschrijft de lokale bouwroute. De repository `https://github.com/fabelpad/platform.git` is als `origin` gekoppeld; integratiebranch is `main`. Voor de voorbereidingsopdracht van 11 november 2026 geldt aanvullend [DEPLOY-DG-NXTTRACK-01.md](DEPLOY-DG-NXTTRACK-01.md): afzonderlijke kandidaatbouw en latere activatie op dg-nxttrack-01, zonder nu een omgeving te activeren. De lokale demo blijft zonder externe accounts uitvoerbaar.

## Voorcontrole en installatie

Gebruik Node `24.18.0` uit `.nvmrc` en pnpm `11.25.0` uit `package.json`. Web gebruikt `pnpm-lock.yaml`; `mobile/` gebruikt een eigen npm-lockfile en valt niet onder een pnpm-monorepo-installatie.

```bash
node scripts/local-preflight.mjs
pnpm install --frozen-lockfile
cp --no-clobber .env.example .env.local
pnpm check:config
```

Kopieer het voorbeeld alleen als `.env.local` nog niet bestaat. Laat beide publieke Supabase-waarden leeg om zonder accounts te bouwen. Email- en Google-login blijven uit tot hun echte providers werken. De demo heeft geen productierechten.

De preflight controleert exacte Node/pnpm-pins, vrije bytes en inodes. De lokale webdrempel is 4 GiB/50.000 inodes; `--android` gebruikt 12 GiB/100.000. Dit zijn lokale ondergrenzen, geen capaciteitsschatting voor backups en meerdere releases. Controleer opnieuw vóór grote installaties, Android SDK, builds en backups. Verwijder geen actieve releases, herstelpunten of onbekende bestanden om ruimte te maken.

## Web controleren en starten

```bash
bash scripts/local-build.sh
pnpm dev
```

Het bouwscript gebruikt Linux `flock`, voert preflight/configuratie/TypeScript/domeincontroles uit en maakt een echte Next.js-productiebuild. Het standaardlock serialiseert deze checkout; wijs `FABELPAD_BUILD_LOCK` pas naar het bestaande hostbrede lock zodra dat contract bekend is. Installeer dependencies niet gelijktijdig met een build in dezelfde checkout.

Gebruik na een geslaagde build voor de productie-runtime lokaal:

```bash
pnpm start
```

Next.js bindt aan loopback; standaardpoort 3000. Een bezette poort kan expliciet met `PORT` worden gewijzigd. Noteer de werkelijk geteste URL in het validatierapport.

| Route | Bedoeling |
| --- | --- |
| `/` | Publieke website en directe demoroute |
| `/lezen` | Kinderleesapp met lokale demo-opslag |
| `/demo` | Reviewroute met de prototype-schermschakelaar |
| `/ouders` | Lokale ouderdemo; geen Supabase-autorisatie |
| `/inloggen` | Echte Supabase-login, afgeschermd zolang configuratie ontbreekt |
| `/gezin` | Echte gezin-/cloudgrens met geverifieerde sessie |
| `/studio` | Servergecontroleerde contentbeheergrens |
| `/privacy`, `/support`, `/account-verwijderen` | Dienstpagina's; definitieve organisatie-/beleidsgegevens nog nodig |

`pnpm check:content` voert de bestaande profiel-, cloud-sync-, verhaalgeheugen-, catalogus-, tekstgroei-, speelactie-, modal-, cache- en platformcontroles uit. De native content wordt opnieuw uit dezelfde verhaalbron gegenereerd en bytegewijs met de vastgelegde content/assetsmapping vergeleken. Bij bewuste broncontentwijzigingen: `pnpm content:export`, de wijziging beoordelen en alle gewijzigde content/assets vastleggen.

`pnpm check:backend` vervangt de oude D1/SQLite-backendcontrole door PostgreSQL-/RLS-/RPC-contracttests op PGlite en afzonderlijke servercontractcontroles. Het lokale Auth-schema is een teststub; deze controles bewijzen geen gehoste Supabase Auth, Edge Functions of externe synchronisatie. Nieuwe migraties onder `supabase/migrations/` moeten op de bedoelde echte database worden toegepast en met meerdere accounts worden getest.

De oude SQLite-adapter en `family-backend-check.mjs` zijn niet actief in de Next.js-runtime of huidige controles. De oorspronkelijke D1-adapter en migratie staan als historische referentie onder `legacy/d1/`. De oude regressiecontrole blijft uitvoerbaar met `node scripts/family-backend-check.mjs`; dit is geen Supabase-migratiepad.

## Native lokaal

```bash
node scripts/local-preflight.mjs --android
pnpm content:export
npm ci --prefix mobile --no-audit --no-fund
npm run check --prefix mobile
CI=1 npm run export:android --prefix mobile
```

Bij een hostbrede npm-cachefout kan `npm_config_cache` naar een eigen tijdelijke cache worden gezet; wijzig of verwijder de gedeelde cache niet. Metro levert een JavaScript-/assetexport. Een APK vraagt de passende JDK, Android SDK/NDK, gegenereerde Gradle wrapper en het native buildpad uit [mobile/README.md](../mobile/README.md). Toestelresultaten en APK/AAB-bewijs worden afzonderlijk in [mobile/VALIDATIE.md](../mobile/VALIDATIE.md) genoteerd.

Productievariant vereist de expliciete definitieve package-ID. Uploadkeys, wachtwoorden en Play API-credentials blijven buiten Git, de appbundel en logs. Een lokaal gegenereerde debugkey is geen productie-uploadkey.

## CI

`.github/workflows/verify.yml` installeert de gepinde toolchain, controleert capaciteit, gebruikt beide lockfiles en draait webcontroles, productiebuild, native TypeScript en Metro-export. De workflow heeft alleen leestoegang op broncode en bevat geen deploy-/Supabase-/Play-credentials. Voor pull requests is `github.sha` de werkelijk uitgecheckte testcommit; leg bij een release de volledige uiteindelijke bron-SHA apart vast.

Een workflowbestand alleen bewijst geen geslaagde GitHub-run. De push naar de opgegeven repository start de verificatieworkflow; controleer de uitslag op de volledige gepushte SHA via GitHub Actions.

## Later: DG-release en acceptatie

Volg eerst [.github/RELEASE-GATES.md](../.github/RELEASE-GATES.md). Voor **fabelpad-nxttrack-staging** geldt de concrete procedure uit [DEPLOY-DG-NXTTRACK-01.md](DEPLOY-DG-NXTTRACK-01.md); de oude stappen hieronder blijven een algemene acceptatielijst. De aangetroffen `dg-site-deploy` is alleen voor Milo en wordt niet gebruikt of aangepast. De nieuwe Fabelpad-adapter bouwt kandidaten en activeert die afzonderlijk. Docker, Workers en een alternatieve mailgateway zijn geen onderdeel van dit releasepad.

1. Leg één volledige bron-SHA vast en vereis groene CI op precies die commit. Controleer de runner, Linux-gebruiker, workspace, wrapperversie en configallowlists.
2. Controleer bytes/inodes en het hostbrede build-lock. Maak vóór migraties de voorgeschreven versleutelde databasebackup en toon herstelbewijs aan.
3. Controleer migratiehistorie en compatibiliteit. Pas schema-/Edge-/workerwijzigingen via het vastgestelde contract toe; reset geen database om afwijkingen te verbergen.
4. Laat de stagingrunner dezelfde SHA met **stagingconfiguratie** bouwen en via de werkelijke wrapperinterface activeren. Leg release-ID, run-ID/poging, toolchain, configuratieversie en backendversies vast.
5. Controleer volledige runtime-SHA, healthcontract, Auth/sessieherstel, twee gescheiden ouders/kinderen, manipulatie van kind-ID's, echte syncconflicten, concept-/publicatiebeheer en mailworkerstatus. Een health-200 bewijst alleen dat endpoint.
6. Bouw productie later binnen de dan geautoriseerde scope opnieuw uit dezelfde SHA met **productieconfiguratie**. Een nieuwe mergecommit is niet dezelfde bron-SHA; forcepush is geen herstelprocedure.

Staging- en productiewaarden van `NEXT_PUBLIC_SUPABASE_*` worden tijdens hun eigen `next build` ingebakken. Omgevingsconfiguratie achteraf veranderen vervangt de reeds gebouwde browserwaarden niet.

## Fouten, backup en rollback

- Lokaal: stop het betreffende eigen proces en lees de foutuitvoer. Verwijder geen demo-/profielopslag om een opslagfout te verbergen. Gebruik herkenbare testprofielen en behoud een export wanneer gegevens nodig blijven.
- Ontbrekende Supabase-configuratie: de demo blijft bruikbaar; echte serverroutes moeten expliciet onbeschikbaar zijn. Gebruik geen demo-login als echte beheertoegang.
- Releasefalen: noteer welke app-, database-, Edge- en providerstappen werkelijk zijn uitgevoerd. Stop vervolgstappen en volg het geverifieerde rollbackcontract van de wrapper.
- Een approllback draait database, Edge Functions, mailcontracten of providerconfiguratie **niet automatisch terug**. Controleer de nog actieve app tegen de reeds gewijzigde backend.
- Voor het nieuwe doel staan het concrete approllbackcommando en de releasepaden in [DEPLOY-DG-NXTTRACK-01.md](DEPLOY-DG-NXTTRACK-01.md). Databasebackuppaden, encryptiesleutelbeheer, retentie en herstelbewijs ontbreken nog; approllback vervangt dat contract niet.

Geef een controle alleen als geslaagd weer met het bijbehorende commando, de werkelijk geteste commit/werkboom, datum en resultaat. Markeer niet-uitgevoerde tests expliciet; een bundel is geen toesteltest of Play-release.
