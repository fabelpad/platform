# Fabelpad — verificatie van OTP en twee omgevingen

Uitgevoerd op **22 november 2026** op de development-VPS. Geteste applicatiebron: **`070a039e1de4c39fac12d79d293104a0e89c8f00`**. De daaropvolgende bewijscommit wijzigt uitsluitend documentatie. Een latere CI-fix ruimt alleen ongebruikte pakketten op de tijdelijke hosted runner op; applicatiecode en buildconfiguratie blijven gelijk.

## Schone lokale builds

Elke werkmap is uit `git archive` van die volledige SHA gemaakt, zonder `.env.local`, oude `.next` of overgenomen `node_modules`. Installatie: **`pnpm install --frozen-lockfile`**. Toolchain: **Node 24.18.0 / pnpm 11.25.0 / Next 16.3.4**.

| Werkmap / configuratie | Uitgevoerd | Resultaat |
| --- | --- | --- |
| `/tmp/fabelpad-otp-clean-20261122-MkuAsP`, expliciete lokale modus | `bash scripts/local-build.sh` | Geslaagd, alle normale controles en Next-productiebundel |
| `/tmp/fabelpad-staging-clean-20261122-YLeLNH`, vier echte publieke stagingwaarden uit GitHub | Configuratievalidator voor staging + `pnpm build` | Geslaagd |
| `/tmp/fabelpad-production-clean-20261122-O8ejiq`, vier echte publieke productionwaarden uit GitHub | Configuratievalidator voor production + `pnpm build` | Geslaagd |

De twee doelbuilds gebruiken elk het eigen project; de bijbehorende Supabase-URL is in de eigen gecompileerde servercode teruggevonden. Er zijn geen runtimegeheimen in build/werkmap opgenomen. E-mail/Google staan tijdens deze lokale configuratiebuilds uit; echte providerreadiness is nog niet beschikbaar. Een geslaagde lokale productiebundel bewijst geen mailbezorging, publieke dienst of kandidaat op dg-vps-08.

Buildoutput: `.next/server`, `.next/static`, `public` en benodigde packagebestanden/dependencies. Startopdracht blijft `pnpm start --port <poort>`, met loopbackbinding.

## Geslaagde controles

| Controle | Resultaat / grens |
| --- | --- |
| Preflight, configuratie, TypeScript | Geslaagd onder gepinde toolchain; lokale preflight 22,55 GB vrij en ruim 14 miljoen inodes |
| Content-/profiel-/synchronisatiecontracten | Geslaagd, waaronder 13 verhalen / 403 scènes / 416 eindroutes en versiebehoud |
| PostgreSQL/PGlite | Beide echte migraties, RLS/RPC/CAS, publicatie, bootstrapbevestiging/intrekking en behoud handmatige rollen geslaagd |
| Auth/SSR-SDK | 25 geïsoleerde scenario's geslaagd met geïnstalleerde Supabase-SDK en synthetische provider |
| E-mail | 33 Node-tests geslaagd: templates, HMAC, tijdvenster, ontvangers, cross-environmentweigering, idempotentie, timeouts, standalone OTP-tool |
| Mailconfiguratie | 17 nagebootste HTTP-tests geslaagd, inclusief bescherming actieve secrets en herstel bij Auth-updatefouten |
| Deployroute | 86 Node-tests + 19 installer-/upgradetests geslaagd |
| Native runtimecontract | Geslaagd; geen nieuwe APK/AAB gebouwd voor deze webwijziging |
| Deno 2.9.8 | `deno check --config supabase/functions/auth-email/deno.json supabase/functions/auth-email/index.ts` geslaagd |
| Browser | Alle 9 Playwright/Chromium-scenario's geslaagd tegen de gebouwde lokale Next-server; 10,2 seconden |
| Lokale HTTP | `/api/health` geeft200 met exacte bron-SHA en lokale modus; `/privacy` geeft200 |

De browserscenario's omvatten bestaande lees-/opslag-/gezins-/studioflows, OTP met veilige studioterugkeer, bevestigingslinks die geen token op GET gebruiken, opgeschoonde URL en correcte beschikbaarheidsfout bij een mislukte sessieaanvraag. Auth-/cloudscenarios gebruiken synthetische, onderschepte providerantwoorden. Er is geen echte mail verzonden en geen echte mailboxcode gebruikt.

De configuratietool kreeg daarna expliciete startlimieten van 30 Auth-mails per uur en 60 seconden per gebruiker, zodat een nieuw project niet op de ingebouwde testlimiet blijft staan. De 17 configuratietests zijn opnieuw geslaagd, inclusief terugzetten van oorspronkelijke limieten bij fouten. De 33 Node-mailtests zijn opnieuw geslaagd. Dit wijzigt geen appcode of Next-buildinvoer en voert geen live providerwijziging uit. Resend-dag-/maandquota en latere gewenste capaciteit blijven afzonderlijk te controleren.

## Live database en host

[Supabase-bewijs](deploy-evidence/supabase-2026-11-22.json): beide schema's en 13 bronreleases toegepast, RLS aan, catalogus HTTP 200, anonieme afgeschermde tabellen HTTP 401, securityadvisors zonder meldingen, 0 Auth-gebruikers. `auth-email` v1 deployed maar ongeconfigureerd; POST retourneert 503 zonder te verzenden.

[Hostbewijs](deploy-evidence/dg-vps-08-2026-11-22.json): twee eigen doelen voorbereid, 4188/4189 vrij, rechten gescheiden, runners ongeregistreerd en alle eigen app-/runnerdiensten disabled/inactive. Relevante bestaande diensten/configuraties/healthresponses/currentlinks vóór en na gelijk. Geen doelkandidaat of actieve Fabelpad-release.

## Open acceptatie

De eerste PR-verificatie stopte bij de capaciteitspreflight: de tijdelijke GitHub-runner had 12.884.598.784 bytes vrij, net onder 12 GiB. De workflow ruimt nu, na controle op `RUNNER_ENVIRONMENT=github-hosted`, uitsluitend de ongebruikte `/usr/share/dotnet` en `/opt/ghc` op. Dit is dezelfde bestaande stap als in Android-CI, zonder verlaging van de capaciteitsdrempel of wijziging op de VPS. De opvolgende GitHub-run is het verificatiebewijs voor deze CI-wijziging.

Afgeschermde Resend-key, geverifieerd verzenddomein en Supabase Auth-/secretbeheer ontbreken. Daardoor zijn echte OTP-bezorging, accountaanmaak van de aangewezen beheerder en root-readiness nog niet uitgevoerd. Runnergroepbeheer ontbreekt eveneens. Main-integratie vereist daarnaast controle van geërfde organisatie-Playflags en eventuele Supabase-GitHub-integratie; de huidige toegang toont die niet volledig.

De werkwijze en exacte vervolgopdrachten staan in [mailconfiguratie](EMAIL-CONFIGURATIE.md), [tweedoelenrunbook](DG-VPS-08-TWEE-OMGEVINGEN.md) en [actuele status](STAGING-PRODUCTION-STATUS.md). Deze resultaten geven geen toestemming of bewijs voor een nog niet uitgevoerde release.

## Lokale logidentificaties

Logs staan onder `/tmp/fabelpad-otp-20261122/`; er staan geen providersecrets of ontvangen OTP's in.

| Bestand | SHA256 |
| --- | --- |
| `clean-install.log` | `cb464ce871d6e4db277eae3740c42f3cc38c171d57edd9e28bbd7084ecc5f445` |
| `clean-build.log` | `3874699326484c7292c50958fc7959ed7a5e0e216a454e355711fa9065be0b57` |
| `staging-build.log` | `1e71d3ba4bf5ee9bc9d05fb38ba2417a72db50f08be6e7dfa2757c8ad01b898c` |
| `production-build.log` | `e32a16f9a540804dfd7e9dec27d66330f5062596988cfc6fd0a5a71d42c5cf51` |
