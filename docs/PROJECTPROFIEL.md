# Fabelpad — projectprofiel

Bijgewerkt: **20 november 2026**. Actuele opdracht: de bestaande applicatie voorbereiden voor een **nieuw stagingdoel op `dg-vps-08`**, zonder eerste activatie, verhuizing of publieke ingebruikname. Eerdere voorbereiding op `dg-nxttrack-01` is uitsluitend referentie; bestaande omgevingen blijven ongewijzigd.

## Project en bron

| Onderdeel | Vastgesteld / bron |
| --- | --- |
| Product | Fabelpad; webplatform en afzonderlijke native Android-app in dezelfde repository |
| Repository | [`fabelpad/platform`](https://github.com/fabelpad/platform); `origin=https://github.com/fabelpad/platform.git` |
| Toegestane integratiebranch | `main`; huidige normale verificatie en native workflows gebruiken deze branch |
| Voorbereidingsbranch | `codex/dg-vps-08-staging-prep-20261120`; eigen reviewbranch, geen activatie |
| Werkcheckout | `/home/codex/repos/fabelpad` |
| Webtoolchain | Node `24.18.0` (`.nvmrc`), pnpm `11.25.0` (`packageManager`), `pnpm-lock.yaml` |
| Webruntime | Next.js `16.3.4`, React/React DOM `19.2.6`; bestaande native Node-server blijft behouden |
| Installatie / build / start | `pnpm install --frozen-lockfile` / `pnpm build` / `pnpm start`; Next bindt aan loopback |
| Buildoutput | `.next/server`, `.next/static`, `public`, packagebestanden en bijbehorende `node_modules`; geen standalone-output ingesteld |
| Verificatie | `.github/workflows/verify.yml`, verplichte job `verify`; native Android-controles blijven afzonderlijk bestaan |
| Broncontent | Dertien gebundelde verhalen; gedeelde contentexport voor native, met behoud van bestaande verhaalversies |
| Doelomgeving | Nieuwe stagingopstelling volgens de opdracht; geen productieautorisatie |
| Doelhost | `dg-vps-08`; Tailscale-identiteit en gepinde SSH-hostsleutel gecontroleerd; verdere gegevens in [DG-VPS-08-VOORBEREIDING.md](DG-VPS-08-VOORBEREIDING.md) |

Een commit op een reviewbranch is geen vrijgegeven release. De kandidaatroute vereist een volledige SHA op `main` met de vastgelegde geslaagde CI. Checkout-SHA, build-SHA, workflowrun en runtime-SHA worden afzonderlijk vastgelegd. Ontbrekende of overgeslagen verplichte controles gelden niet als geslaagd.

## Configuratiecontract

De eigenaar staat voor deze webdeploy uitsluitend deze vier **GitHub Actions-variabelen** toe:

| Naam | Bron / fase |
| --- | --- |
| `FABELPAD_APP_ORIGIN` | Door eigenaar bevestigde canonieke origin; build- en runtimeconfiguratie |
| `FABELPAD_DATA_MODE` | Expliciete keuze voor lokale werking of Supabase; build/runtime moeten overeenkomen |
| `NEXT_PUBLIC_SUPABASE_URL` | Publieke HTTPS-origin van het bedoelde nieuwe Fabelpad-Supabase-project; buildtijd |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key van hetzelfde project; buildtijd, nooit secret/service-role |

Voor dit webdoel worden geen aanvullende GitHub-variabelen voor host, site-ID, environment, runnerlabels, poort, Nodepad, SHA, configuratie-ID of providerflags geïntroduceerd. Vaste doelmetadata staat in het beoordeelde hostprofiel. SHA/runmetadata komt uit de workflow. Runtimegeheimen horen in afzonderlijke root-beheerde bronnen buiten Git en buildtoegang. Zie [INRICHTING.md](INRICHTING.md). Bestaande, ongeconfigureerde Android/Play-workflows blijven behouden; deze webopdracht zet ze niet aan.

De twee `NEXT_PUBLIC_SUPABASE_*`-waarden worden in de browserbuild ingebakken. Bij wijziging is een nieuwe build nodig. Ook een andere datamodus of app-origin krijgt een nieuwe configuratie-identificatie en kandidaat; de releaseprocedure accepteert geen los aangepaste runtimeconfiguratie boven op een oude build. Een ingevulde URL/key bewijst geen beschikbare database, RLS of werkende login.

## Native productie is een afzonderlijke release

De eigenaar bevestigde op 18 november een **gratis, volledige lokale leesapp zonder accounts, synchronisatie, advertenties of abonnementen** voor de eerste Android-release. Die app vereist geen Supabase, Resend of Play Billing. De webvoorbereiding verandert dit productbesluit niet.

| Native onderdeel | Bevestigd |
| --- | --- |
| Project / lockfile | `mobile/`, eigen `package-lock.json`; Expo/React Native, geen WebView |
| Definitieve Android-identiteit | `nl.fabelpad.app`, productievariant; pakketnaam door eigenaar bevestigd |
| Geleverde versie | `1.0.0` / versionCode `1`, AAB uit schone broncommit `8dcb98c4287dc78421b092ee395ace05f492baaa` |
| Ondertekening | Eigen beschermde uploadsleutel; publieke certificaat- en buildcontroles vastgelegd |
| Beleid / acceptatie | [Productie-invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md), [Play-runbook](GOOGLE-PLAY-RELEASE-RUNBOOK.md) en [bouwbewijs](ANDROID-PRODUCTIE-VALIDATIE.md); latere emulatorsmoke in de private release; een build bewijst geen Play-publicatie |

## Omgevingsgrenzen

De nieuwe inrichting op `dg-vps-08` krijgt een eigen identiteit, accounts, releasepaden en vrije loopbackpoort. Bestaande services, runners, releases, GitHub environments, secrets, proxy, DNS en databases zijn uitsluitend referentie. Er wordt niets uit `dg-nxttrack-01` verhuisd of hergebruikt als tijdelijke productieconfiguratie.

De canonieke staging-origin, Supabase-projectidentiteit, eventuele provideracceptatie en latere publieke route zijn nog door de eigenaar te leveren of te bevestigen. `fabelpad.nl` en `support@fabelpad.nl` zijn bevestigd voor publieke productcommunicatie; dat bepaalt geen nieuw stagingdomein en bewijst geen hostingroute naar deze VPS.

De oorspronkelijke [prototypeoverdracht](FABELPAD-CODEX-OVERDRACHT.md), [lokale validatie van november](LOKALE-VALIDATIE.md) en voorbereiding op `prep/dg-nxttrack-01-staging-20261111` bevatten historische voorstellen. Voor het nieuwe doel gelden dit profiel, [releasegates](../.github/RELEASE-GATES.md) en het [DG-vps-08-runbook](DG-VPS-08-VOORBEREIDING.md).
