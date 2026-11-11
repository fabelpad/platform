# Deploymentvoorbereiding: validatie 11 november 2026

**Lokale build geslaagd. Geen kandidaatbuild op de doel-VPS.**
De stagingconfiguratie ontbreekt nog; het nieuwe stagingdoel is daarom niet
buildklaar verklaard. Er is geen app geactiveerd en geen domein gepubliceerd.
De procedure en alle open voorwaarden staan in
[DEPLOY-DG-NXTTRACK-01.md](DEPLOY-DG-NXTTRACK-01.md).

## Bron, toolchain en lokale build

| Controle | Werkelijk resultaat |
| --- | --- |
| Volledige geteste broncommit | ef7c707b7eddbb780e3cb5274268770ff4eb8e71 |
| Reviewbranch | prep/dg-nxttrack-01-staging-20261111 |
| Ongewijzigde integratiebranch bij start | main, 1b68678a77d935f5382b4b11bca676dc0941af91 |
| Node / pnpm / Next | 24.18.0 / 11.25.0 / 16.3.4 |
| Schone afzonderlijke werkmap | /dev/shm/fabelpad-nxttrack-prep-20261111-5rh7uY/checkout |
| Installatie | pnpm install --frozen-lockfile --prefer-offline --package-import-method copy --store-dir /home/codex/.local/share/pnpm/store/v11 |
| Dependencybron | Gecommitte pnpm-lock.yaml; 86 pakketten hergebruikt, geen overgenomen node_modules of Next-buildcache |
| Veiligheidscontrole pnpm | Supply-chainbeleid geslaagd; de eerste offline poging miste metadata, hervat met normale metadata-opvraag zonder beleid uit te schakelen |
| Normaal bouwcommando | bash scripts/local-build.sh; exit 0 |
| Configuratie | local, eigen loopback APP_URL, providers uit, geen Supabase-credentials |
| Capaciteit vóór build | 6.261.612.544 vrije bytes, 2.887.977 inodes; normale preflight geslaagd |
| Next-buildoutput | .next/server, .next/static, .next/BUILD_ID; public en eigen node_modules voor runtime |
| Next BUILD_ID | nsSv5FtQhMnyxqP_SqE3B |
| Runtimeproef | pnpm start, uitsluitend 127.0.0.1:3017; na validatie gestopt |
| Health | 200, volledige geteste SHA, environment local, backend not-configured, process-liveness-only |
| Browser | pnpm test:browser tegen deze productiebuild: 6/6 geslaagd |

De development-rootpartitie had minder dan 1 GiB vrij; de normale capaciteitspoort
weigerde daar terecht. Er zijn geen onbekende bestanden, gedeelde caches of andere
projecten verwijderd. De schone build draaide op de uitvoerbare eigen tmpfs-werkmap
met aparte tijdelijke/cachepaden en Node-geheugenlimiet 1024 MiB.

De normale build omvatte:

- Configuratie- en TypeScriptcontrole.
- Alle bestaande domeinchecks en de deterministische web/native-contentvergelijking:
  13 verhalen, 403 scènes, 416 eindroutes.
- Lokale PostgreSQL/RLS/RPC- en servercontracttests op PGlite, met synthetische Auth.
- Native runtimecontracten.
- 59 Node-release-/CI-/hersteltests en 9 Python-installercontroles.
- Een echte Next.js-productiebuild.

Actionlint slaagt voor alle workflows met de twee expliciete custom runnerlabels.
Bash-syntax en git diff --check slagen. De bestaande verify.yml is ongewijzigd
(Git-blob 6944a1584a7ccbee9a8b0336050d632c47a3cc2b).
De releasecontroles testen ook ontbrekende/lopende/mislukte CI, verkeerde SHA/repo,
archiefpaden, configuratiekoppeling, symlinks/hardlinks, eerste-installatiefouten en
het vasthouden van het buildlock tijdens het stoppen van achtergebleven processen.
Er is geen live activatie of live rollback uitgevoerd.

De strikte stagingcontrole is werkelijk uitgevoerd en weigert met exit 78:
APP_URL, NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ontbreken.
Er zijn geen nepwaarden of credentials van bestaande omgevingen ingevuld.
Gehoste Supabase Auth/RLS, OAuth, mailgateway, echte synchronisatie en zakelijke
readiness blijven ongetest. Browsermocks leveren geen bewijs daarvan.

## Uitgevoerde hostvoorbereiding

Host en sleutel zijn geverifieerd zoals vastgelegd in het doelrunbook. Na de
gebruikersmelding dat codex-dg-admin klaarstond, is uitsluitend de algemene
beheerroute voor de eigen toevoegingen gebruikt. De tijdelijke Dartflow-route is
alleen voor inventarisatie gebruikt.

De root-owned bronbundel kwam uit dezelfde volledige geteste broncommit. Transport
en controle zijn geslaagd:

- Eigen tijdelijke bronmap op de doelhost:
  /var/tmp/fabelpad-hostprep-ef7c707b7edd-fKefUE.
- SHA-256 van het getransporteerde tarbestand:
  1b55cb9d85fd9baaf317f6b99331ca499cf66a5fd4c5b1f48188e88b7b6ff23b.
- Echte installer-dry-run: geslaagd; daarna expliciete apply: prepared-inactive.
- visudo valideerde de drie digest-gepinde regels; systemd-analyze verify
  valideerde de eigen appunit.

| Toevoeging | Werkelijk voorbereid |
| --- | --- |
| run-fab-nxt-stg | UID 979, GID 973; alleen eigen groep, nologin |
| build-fab-nxt-stg | UID 978, GID 972; alleen eigen groep, nologin |
| app-fab-nxt-stg | UID 977, GID 971; alleen eigen groep, nologin |
| Eigen site/config/build/runnerpaden | Aangemaakt volgens het doelrunbook |
| Privileged adapter | 12 root-owned modules, hashes in de installatiebon |
| Sudoers | Alleen vaste kandidaatbouw, activatie en rollback; geen algemene sudo |
| Appunit | Bestand geïnstalleerd, zonder daemon-reload, enable of start |
| Runnerunit / proxy | Alleen eigen prepared-bestanden, buiten actieve proxy-import |
| Build-/runtimeconfiguratie | Afgeschermde gescheiden mappen, geen waarden of secrets geplaatst |
| Gedeeld buildlock | Bestaande eigenaar, groep, modus en werking behouden |
| Kandidaten/releases/current | Geen kandidaat, geen actieve release, geen current/previous |
| GitHub-runners/environments | Geen aangemaakt of gewijzigd |

De host-installatiebon staat onder
/etc/dg-webservices/fabelpad-nxttrack-staging/installation.json; de configuratie en
privileged code zijn niet door runner, buildaccount of app schrijfbaar.

## Bestaande omgevingen en gelijktijdige wijzigingen

Er zijn afzonderlijke metingen vóór en na de eigen toevoegingen. De eerste
inventarisatie was om 09:23 UTC; direct vóór onze installatie is om 09:37:33 UTC
opnieuw gemeten. In de tussenliggende tijd activeerden twee afzonderlijke
Dartflow-workflows hun eigen omgevingen:

- Staging: run 42995422162, service gestart 09:30:07 UTC, geslaagde run afgerond
  09:30:18 UTC.
- Productie: run 42995766522, service gestart 09:32:39 UTC, geslaagde run afgerond
  09:32:50 UTC.

Beide gebruikten SHA 4634852c17cc7737bec246c0b48310e975a36920 en waren vóór onze
eerste hostschrijfhandeling actief. Hun nieuwe toestand is als referentie behouden.
De bekende publieke productiehealth gaf 401; die wordt niet als publieke readiness
gerapporteerd. Er is geen poging gedaan een externe wijziging terug te draaien.

De nameting om 09:41:31 UTC vergelijkt de direct vooraf vastgelegde toestand:
existingEnvironmentDifferences=[] en ownPreparationFailures=[].
Alle gecontroleerde bestaande units/PID's, runnerregistraties, releaseverwijzingen,
proxy-/wrapperbestanden, rechten en healthidentiteiten zijn behouden. Milo en
Dartflow-staging geven dezelfde health-200; Dartflow-productie geeft dezelfde
loopback-200 en reeds aanwezige publieke 401. Ook de oudere Fabelpad-skeletinrichting
is ongewijzigd.

Alle twaalf geïnstalleerde modulehashes en de sudoersregels passen bij de beoordeelde
bron; negen daadwerkelijke toegangsproeven bevestigen de scheiding van de accounts.
De eigen appservice is inactive/dead/disabled met PID 0. Er zijn geen kandidaat,
release, current, previous, configuratiewaarden of actieve proxysnippet. Poort 4176
is nog vrij.

Het officiële actions/runner-pakket 2.338.2 voor Linux x64 is als eigen runneruser
gedownload, tweemaal op SHA-256 gecontroleerd en veilig uitgepakt:

| Controle | Resultaat |
| --- | --- |
| Grootte | 228.071.396 bytes |
| SHA-256 | baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40 |
| Plaats | /opt/actions-runner/fabelpad-nxttrack-staging |
| Eigenaar | run-fab-nxt-stg 979:973, hoofdmap 0700 |
| Bibliotheken | Vijf alleen-lezen linkercontroles geslaagd, geen ontbrekende libraries |
| Ontvangstbewijs | .package-receipt.json, modus 0600, onder dezelfde eigen map |
| Registratie / start | Niet uitgevoerd; geen .runner, credentials, runnerunit of processen |

De officiële bron is de
[actions/runner-uitgave 2.338.2](https://github.com/actions/runner/releases/tag/v2.338.2).
GitHub meldt nog nul repositoryrunners. Een uitgepakt pakket bewijst geen online
runner of succesvolle doelbuild.

Gedetailleerde geschoonde meetbestanden, buildlog en installatiebon staan lokaal
onder artifacts/deploy-prep-2026-11-11/ en bevatten geen secretwaarden. De belangrijkste
bestanden zijn local-result.json, local-build.log, host-installation.json,
target-final-comparison.json, target-role-access-checks.json en target-final.json.
Het lokale proefproces is gestopt; de reguliere developmentomgeving is niet
gewijzigd. Latere documentatiecommits wijzigen de geteste/ geïnstalleerde code niet.

## Nog geblokkeerd

1. Geen organisatiebevoegdheid/bewijs voor een runnergroep met uitsluitend de twee
   geselecteerde main-workflows. De runner blijft ongeregistreerd.
2. Geen bevestigde Fabelpad-HTTPS-origin of apart Supabase-stagingproject met
   publishable waarden. Er is daarom geen veilige echte stagingbuildconfiguratie.
3. Nieuwe beschermde activatie-environment en afzonderlijke reviewers ontbreken.
4. De voorbereidingscode staat op een reviewbranch. Merge naar main en een
   geslaagde push-CI op de uiteindelijke volledige SHA zijn latere voorwaarden.
5. Domein/publiek IP/DNS/TLS, provideracceptatie, databasebackup/herstel en
   migratievrijgave ontbreken. Deze voorbereiding wijzigt geen database.

Een echte kandidaatbuild op dg-nxttrack-01 is niet gestart. De volledige latere
build-, activatie-, verificatie- en rollbackcommando's staan in het doelrunbook.
