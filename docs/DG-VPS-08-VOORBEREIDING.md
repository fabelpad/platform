# Fabelpad — deployvoorbereiding dg-vps-08

Opdracht en controledatum: **20 november 2026**. Doel: een nieuwe **staging**-inrichting voor Fabelpad voorbereiden. Geen eerste activatie, verhuizing, publieke route, databasewijziging of Android-publicatie. De bestaande omgeving op `dg-nxttrack-01` en alle andere omgevingen blijven ongemoeid.

**Status:** de lokale build is getest en de doelhost is **prepared-inactive** ingericht. De doelconfiguratie en GitHubvoorwaarden zijn nog niet compleet; daarom is het nieuwe doel nog niet buildklaar voor een vrijgegeven kandidaat. Een lokale build en een kandidaat op de doelhost zijn afzonderlijke resultaten. Er staat **geen kandidaat op de doel-VPS**: de vier doelwaarden, vrijgegeven volledige main-SHA met CI en geregistreerde beveiligde doelrunner zijn nog niet compleet.

## Geverifieerd doel en eigen identiteit

| Onderdeel | Waarde / bron |
| --- | --- |
| Repository / integratiebranch | `https://github.com/fabelpad/platform.git` / `main`; Git-remote en bestaande workflows |
| Reviewbranch | `codex/dg-vps-08-staging-prep-20261120` |
| Omgeving | Nieuwe stagingopstelling volgens opdracht; geen bestaande omgeving verplaatsen |
| SSH-doel | `dg-vps-08`; via geverifieerde Tailscale-peer `dg-vps-08.tail4ca740.ts.net` / `100.65.51.108` |
| SSH-hostcontrole | Bestaande gepinde ED25519-hostsleutel, strict checking en remote hostname gecontroleerd; sleutel niet vervangen |
| Host / machine-id | `dg-vps-08` / `05db94b99eca4c3d815f6585ef8ed517` |
| OS / architectuur | Ubuntu `24.04.5`, `x86_64` |
| Beheerroute | Algemeen beheeraccount `codex`, bestaande sleutelbron buiten Git; sudo beschikbaar voor eigen nieuwe projecttoevoegingen |
| Eigen doel-ID | `fabelpad-vps08-staging` |
| Eigen runner / build / app | `run-fab-v08-stg` UID/GID `993/983`; `build-fab-v08-stg` `990/982`; `app-fab-v08-stg` `988/981` |
| Exacte GitHub-runnernaam | `fabelpad-vps08-staging`; adapter weigert een andere runneridentiteit |
| Eigen appservice | `fabelpad-vps08-staging.service`, geïnstalleerd; disabled/inactive/dead, niet gestart |
| Eigen loopbackpoort | `127.0.0.1:4188`; bind-en-sluitcontrole geslaagd, opnieuw controleren vóór start |
| Runnerlabels | `self-hosted`, `Linux`, `X64`, `dg-vps-08`, `fabelpad-vps08-staging` |
| Activatie-environment | `fabelpad-vps08-staging`; nieuwe aparte environment, geen bestaande wijzigen |
| Node / pnpm | Node `24.18.0`, pnpm `11.25.0` daadwerkelijk geïnstalleerd en geverifieerd; eigen root-owned toolchain onder `/opt/dg-toolchains/fabelpad-vps08-staging` |
| Publieke origin / doel-IP | Niet vastgesteld; Tailscale-adres is geen publiek DNS-doel |
| Supabase-project / regio | Nog door eigenaar te koppelen en bevestigen |

De eigen runnerunit is eveneens geïnstalleerd en disabled/inactive/dead. Het officiële runnerpakket **2.338.2** is op checksum gecontroleerd en de versie is onder het eigen runneraccount uitgevoerd. De standaard `bin/runsvc.sh` staat klaar met de root-owned servicewrapper. `.runner` ontbreekt: er is niet geregistreerd of gestart.

De beheerroute gebruikt strict host checking en de bestaande gepinde sleutel:

```bash
set -euo pipefail
ssh -i /home/codex/.ssh/dg_vps_08_ed25519 -o IdentitiesOnly=yes -o HostKeyAlias=100.65.51.108 -o StrictHostKeyChecking=yes codex@dg-vps-08.tail4ca740.ts.net
```

Dit is geen nieuw runner-SSH-secret. De self-hosted runner werkt lokaal op de doelhost met uitsluitend eigen vaste privileged entrypoints.

## Nulmeting en bescherming bestaande host

Alleen-lezen inventarisatie bevestigde 16 GB RAM, 8 CPU's, ongeveer 286 GB vrije ruimte en 19,7 miljoen vrije inodes. `/srv` en `/opt` bevatten nog geen apps, releasepaden of runners. Caddy `2.11.9` draait; `/etc/caddy/Caddyfile` is 88 bytes, importeert `/etc/caddy/sites/*.caddy` en heeft een bestaande `:80`-response. De sitesmap is leeg. Bestaande publieke domeinen en health-URL's zijn niet vastgesteld.

Bij de eerste inventarisatie was geen geïnstalleerde DG-deploywrapper of gedeeld DG-buildlock aangetroffen. Tijdens deze opdracht is daarnaast door een andere voorbereiding een CastIQ-inrichting verschenen. Die is vanaf dat moment een bestaande omgeving en blijft uitsluitend referentie. Deze Fabelpad-voorbereiding introduceert een eigen beoordeelde adapter; ze claimt geen bestaand Fabelpad-wrappercontract.

Het inmiddels bestaande gedeelde `/run/lock/dg-build.lock` is opnieuw gecontroleerd als `root:dg-build 0660`, met bestaande persistentie in `/etc/tmpfiles.d/castiq-staging-build-lock.conf`. De bestaande regel `f /run/lock/dg-build.lock 0660 root dg-build -` is semantisch passend. De Fabelpad-installer hergebruikt dit lock en die persistentie uitsluitend zoals aangetroffen; hij wijzigt geen lockinhoud, rechten, groep, bestaande groepsleden of tmpfiles-bestand. Hij vervangt geen gedeelde inrichting door een eigen variant. Gedeelde SSH-, firewall-, netwerk-, pakket- en Caddyinstellingen blijven staan.

Voor en na eigen hosttoevoegingen worden hostname/machine-id, bestaande service/PID, proxyhash/imports, luisterpoorten, releaseverwijzingen en runnerstatus met dezelfde alleen-lezen controles vergeleken. Een verschil wordt onderzocht; uitsluitend eigen aantoonbare wijzigingen worden hersteld. De feitelijke nameting staat onder **Validatie en overdracht**.

De aanvullende nulmeting direct vóór de Fabelpad-installatie legt `castiq-staging-runner` vast als `active/running`, PID `29204`, actief sinds 19:37:42 CET. `castiq-staging` en `castiq-staging-worker` zijn `inactive/dead`, PID `0`. De bestaande groep `dg-build` heeft GID `984` en bestaand lid `castiq-build`. De eerdere Caddy-/SSH-/Tailscale-status, proxyhashes, standaard-HTTP-response en bestaande `current`-verwijzingen bleven bij deze hercontrole gelijk. De later verschenen CastIQ-middelen zijn dus verklaarde externe toevoegingen, geen Fabelpadwijzigingen.

## Paden en rechten

| Pad | Contract |
| --- | --- |
| `/usr/local/libexec/fabelpad-vps08-staging` | Root-owned beoordeelde adapter; runner/build/app kunnen code niet wijzigen |
| `/etc/dg-webservices/fabelpad-vps08-staging/host.json` | Root-owned niet-geheime doelmetadata, vaste repository/branch/accounts/poort/toolchain |
| `/etc/dg-webservices/fabelpad-vps08-staging/installation.json` | Niet-geheim installatiebewijs, inclusief gebruikte bestaande lockpersistentie; geen claim van appactivatie |
| `/etc/dg-webservices/fabelpad-vps08-staging/build-configs/CONFIG_ID.env` | Onveranderlijke publieke buildconfiguratie, root:build `0640` |
| `/etc/dg-webservices/fabelpad-vps08-staging/runtime-configs/CONFIG_ID/SHA.env` | Gekoppelde runtimeconfiguratie, root:app `0640`; build en runner kunnen niet lezen |
| `/etc/dg-webservices/fabelpad-vps08-staging/prepared` | Eigen voorbereide runnerunit en uitgeschakelde proxysnippet; buiten actieve proxyimport |
| `/var/lib/dg-build/fabelpad-vps08-staging` | Eigen buildwerk, home en cache; geen runtimegeheimen |
| `/opt/actions-runner/fabelpad-vps08-staging` | Eigen runner; pas registreren na geselecteerde-workflowbeperking |
| `/opt/dg-toolchains/fabelpad-vps08-staging/node-v24.18.0-linux-x64/bin/node` | Eigen vaste Nodebinary, root-owned |
| `/opt/dg-toolchains/fabelpad-vps08-staging/pnpm/11.25.0/lib/node_modules/pnpm/bin/pnpm.mjs` | Eigen vaste pnpm-entrypoint, root-owned |
| `/srv/sites/fabelpad-vps08-staging/candidates` | Verzegelde kandidaat en buildmanifest; geen activatie |
| `/srv/sites/fabelpad-vps08-staging/releases` | Onveranderlijke combinatie van app, runtimeconfiguratie en manifest |
| `/srv/sites/fabelpad-vps08-staging/current`, `previous` | Alleen latere activering/rollback mag eigen verwijzingen wisselen |
| `/srv/sites/fabelpad-vps08-staging/shared` | Enige eigen appschrijfmap; release en configuratie blijven read-only |

De runner krijgt uitsluitend beperkte sudo voor vaste projectspecifieke entrypoints. Het algemene beheeraccount mag de nieuwe voorbereiding uitvoeren, maar die beheerdersrechten worden niet aan runner, build of app doorgegeven.

## Vier configuratiewaarden en releasebinding

Zie [INRICHTING.md](INRICHTING.md) voor bron en betekenis. De webroute leest alleen `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` uit GitHub-variabelen. Geen extra repositoryvariabelen voor host, poort, environment, SHA, configuratie-ID of providerflags. Vaste metadata komt uit het hostprofiel, SHA/runmetadata wordt gegenereerd.

De kandidaat krijgt een onveranderlijk snapshot van de publieke buildconfiguratie. Het buildaccount krijgt geen runtimegeheimen. De latere runtimeconfiguratie moet exact bij de kandidaat, SHA, doelomgeving en poort passen. Wijziging van publieke ingebakken waarden vereist een nieuwe build/configuratie-ID; niet slechts een herstart. Releasegegevens bevatten hashes/identificaties, geen waarden uit geheime bronnen.

## Routes, GitHub en runnerregistratie

De volgende workflows zijn uitsluitend handmatig (`workflow_dispatch`); bestaande workflows blijven behouden:

| Bestand | Invoer | Effect |
| --- | --- | --- |
| `.github/workflows/fabelpad-dg-vps-08-staging-candidate.yml` | `release_sha`, `config_id` | Bouwt/verzegelt een nieuwe kandidaat; geen service, current-wissel of proxy |
| `.github/workflows/fabelpad-dg-vps-08-staging-activate.yml` | `release_sha`, `candidate_id`, `config_id` | Latere afzonderlijke activatie met de exact-main-environment en eventuele bestaande goedkeuringsregels |
| `.github/workflows/fabelpad-dg-vps-08-staging-rollback.yml` | `release_sha` van de echte vorige gezonde release | Later herstel van precies die vorige app/configuratie |

De route vereist **beide** actuele main-pushcontroles op precies dezelfde SHA: `verify` uit `verify.yml` en `Native Android-controles` uit `fabelpad-android-ci.yml`. Ook alle stappen van de verplichte jobs moeten geslaagd zijn. De optionele signing-/Play-job mag bij uitgeschakelde publicatie overgeslagen zijn. Ontbrekende, lopende, overgeslagen, geannuleerde, neutrale of mislukte verplichte controles worden geweigerd. De root-owned adapter herhaalt GitHub-afstamming en CI-controle vóór build, verzegeling en activering; hij voert geen Git-configuratie uit een runnercheckout als root uit. Daarnaast bindt hij iedere opdracht aan de actuele handmatige main-workflowrun/poging, volledig geslaagde hosted preflight en de werkelijk lopende eigen job op runnernaam `fabelpad-vps08-staging`. Een nagemaakte of oude vrijgaveticket is onvoldoende.

Later via GitHub, na veilige review van deze branch:

1. Controleer vóór merge dat geen bestaande workflow of Supabase-integratie door de gekozen ref een omgeving verandert. Merge niet zolang die veiligheid niet vaststaat. Daarna moeten beide vereiste main-pushchecks op de vrij te geven volledige SHA slagen.
2. Maak een **nieuwe** organisatierunnergroep die alleen `fabelpad/platform` en onderstaande drie geselecteerde workflowreferenties toestaat. Labels alleen zijn onvoldoende. Als abonnement/rechten selected-workflowbescherming niet ondersteunen, blijft de runner ongeregistreerd; verzwak de route niet tot een algemene repositoryrunner.
3. Maak later een **nieuwe** environment **`fabelpad-vps08-staging`** met onder deployment branches uitsluitend één regel: type **Branch**, naam **`main`**. Geen tags of globs. Eventuele door de eigenaar ingestelde reviewers worden gerespecteerd; deze opdracht introduceert geen verplichte extra reviewer of self-reviewregel. Bestaande environments blijven ongewijzigd. De hosted preflight weigert een ontbrekende/onvoldoende beschermde environment voordat de self-hosted activatiejob die kan refereren.
4. Registreer later het officiële, op checksum gecontroleerde eigen runnerpakket via GitHub Settings → Actions → Runners, in de gecontroleerde runnergroep, onder Linux-account `run-fab-v08-stg`, in `/opt/actions-runner/fabelpad-vps08-staging`, met **runnernaam `fabelpad-vps08-staging`** en de vastgelegde labels. Kortlevende registratietokens blijven buiten logs, bestanden en argumentgeschiedenis. Start uitsluitend de eigen runnerunit, pas nadat groep-/workflowbeperking bewezen is. Een runner starten activeert geen app.
5. Vul de vier publieke webvariabelen uit [INRICHTING.md](INRICHTING.md) in. `FABELPAD_DATA_MODE` is exact **`local`** of **`supabase`**. `local` vereist beide Supabase-waarden leeg; `supabase` vereist beide echte waarden van het bedoelde nieuwe project. Een staging-origin is altijd een bevestigde HTTPS-origin, ook als er nog geen publieke route is.

De alleen-lezen GitHub-inventarisatie bevestigt eigenaarstype **Organization**, organisatie **`fabelpad`**, huidig abonnement **GitHub Free** en een lege environmentlijst. De runnergroepen-API gaf **HTTP 403**; de bestaande toegang mist `admin:org`. Er zijn geen rechten uitgebreid, tokens vernieuwd, environments aangemaakt of betalingen gedaan.

Voor deze **private organisatierepository** zijn environments met branchbeleid volgens de actuele [GitHub-documentatie](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) minimaal een **GitHub Team**-mogelijkheid (of Enterprise). De eigenaar moet zelf het geschikte abonnement/toegang regelen; GitHub Pro is een persoonlijk abonnement en lost dit voor deze organisatie niet op. Reviewer-/wachttimerregels zijn aanvullende bescherming en worden niet als extra vereiste ingevoerd. Gecontroleerd op 20 november 2026.

Een bevoegde organisatiebeheerder moet daarna **Organization → Settings → Actions → Runner groups** kunnen openen en de repository- én selected-workflowbeperking aantoonbaar instellen. Laat ondersteuning van de exacte selected-workflowoptie controleren; alleen een Team-upgrade voor environments bewijst niet dat die runneroptie beschikbaar is. De [officiële Enterprise Cloud-runnerdocumentatie](https://docs.github.com/en/enterprise-cloud%40latest/actions/how-tos/manage-runners/self-hosted-runners/manage-access) beschrijft **Workflow access → Selected workflows**. Zonder werkende beperking blijft het uitgepakte runnerpakket met voorbereide unit **ongeregistreerd en gestopt**. Geef geen token in de chat; de beheerder gebruikt eigen veilige organisatieaanmelding of passende, begrensde beheertoegang.

De geselecteerde workflowreferenties zijn exact:

```text
fabelpad/platform/.github/workflows/fabelpad-dg-vps-08-staging-candidate.yml@refs/heads/main
fabelpad/platform/.github/workflows/fabelpad-dg-vps-08-staging-activate.yml@refs/heads/main
fabelpad/platform/.github/workflows/fabelpad-dg-vps-08-staging-rollback.yml@refs/heads/main
```

## Installatie van alleen de nieuwe hostvoorbereiding

De beheerder plaatst de beoordeelde bron in een eigen root-owned tijdelijke werkmap op de geverifieerde host, nooit een runnercheckout als root-bron. De installer valideert host/machine-id, toolchain, vrije doelnaam/poort, sudoers en paden. Standaard controleert hij alleen:

```bash
set -euo pipefail
sudo /usr/bin/python3 -I scripts/deploy/install-host.py --source-root "$PWD"
sudo /usr/bin/python3 -I scripts/deploy/install-host.py --source-root "$PWD" --apply
```

`--apply` voegt uitsluitend eigen accounts, paden, root-owned adapter, beperkte sudoers en voorbereide units toe. Hij registreert geen runner, start/enabled geen app, wisselt geen `current`, herlaadt geen proxy en maakt geen publieke route. Hij weigert botsende bestaande resources. Na een geslaagde installatie niet opnieuw over dezelfde inrichting uitvoeren; bij gedeeltelijk falen eerst de eigen toestand beoordelen. Het installatiebewijs is op **20 november 2026 om 18:39:44 UTC** voltooid: status **prepared-inactive**. De geïnstalleerde modulehashes komen overeen met de beoordeelde lokale bron. De eigen app- én runnerunit staan geïnstalleerd maar disabled/inactive/dead. Voer de oorspronkelijke installer niet opnieuw uit over deze resources; de botspreventie weigert dat terecht. Zie de nameting hieronder.

## Later: exacte kandidaat bouwen

Voer dit pas uit nadat de voorbereide workflows veilig in `main` staan, beide vereiste controles op de vrijgegeven volledige SHA groen zijn, de beveiligde eigen runner werkt en de vier juiste doelwaarden zijn ingevoerd. `CONFIG_ID` is een nieuwe niet-geheime identificatie van 1–63 kleine letters/cijfers/streepjes, beginnend met letter/cijfer. Hergebruik mag alleen met exact dezelfde publieke waarden. Geen extra GitHub-variable nodig.

```bash
set -euo pipefail
RELEASE_SHA=VOLLEDIGE_GOEDGEKEURDE_MAIN_SHA
CONFIG_ID=BEVESTIGDE_NIEUWE_CONFIG_ID
git fetch origin main
set +x
GH_TOKEN="$(gh auth token)" node scripts/deploy/verify-release-sha.mjs --sha "$RELEASE_SHA"
gh workflow run fabelpad-dg-vps-08-staging-candidate.yml --repo fabelpad/platform --ref main -f release_sha="$RELEASE_SHA" -f config_id="$CONFIG_ID"
gh run list --repo fabelpad/platform --workflow fabelpad-dg-vps-08-staging-candidate.yml --limit 5
gh run watch BOUW_RUN_ID --repo fabelpad/platform --exit-status
```

Het token wordt alleen via procesomgeving aan de verificatie doorgegeven. Binnen Actions wordt het automatisch kortlevende token gebruikt. Geen token als argument of uitvoer. Het workflowtoken heeft alleen `contents: read` en `actions: read`.

De adapter snapshot de vier publieke variabelen via stdin naar nieuwe root-owned build- en runtimeconfiguratiebestanden; bestaande waarden worden niet overschreven. De runtime krijgt automatisch `staging`, dezelfde volledige SHA en poort `4188`. Auth-providerflags blijven standaard uit. Activering van OTP/Google vereist later een afzonderlijk gecontroleerd hostconfiguratiecontract en provider-/callback-/mailacceptatie; alleen URL/key invullen schakelt die providers niet aan.

De kandidaat-ID is **`SHA-RUN_ID-RUN_ATTEMPT`**. Het manifest bindt bron-SHA, beide CI-runs/pogingen/jobs, configuratie-ID/digest, lockfile-/artefactdigest, workflowrun en toolchain. Het buildaccount installeert met het gecommitte lockbestand en `--package-import-method=copy`; cachewijzigingen kunnen de verzegelde kandidaat niet wijzigen. De buildworker draait preflight, strikte stagingconfiguratiecheck, `typecheck`, `check:content`, `check:backend`, `check:native`, `check:deploy` en `build`. Bouwopdracht blijft **`pnpm build`**; runtime blijft **`pnpm start`**, met de vaste Nodebinary in systemd.

De huidige scripts voeren geen externe migraties, mail of providerwijzigingen uit. Lokale PostgreSQL-tests gebruiken synthetische gegevens. Bij een aangetoond lockconflict mag na vrijgave van hetzelfde lock hoogstens één begrensde nieuwe poging volgen. Geen lock verwijderen, parallelle build forceren of bestaande releases opruimen. Een nieuwe workflowpoging krijgt een nieuwe kandidaat-ID.

## Later: activeren, HTTPS en verifiëren

De volgende activerende stappen horen uitsluitend bij een **aparte eerste-releaseopdracht**. Ze zijn tijdens voorbereiding niet uitgevoerd.

1. Verifieer domeineigendom, de canonieke origin, publiek doeladres en A/AAAA-records. Het Tailscale-adres is geen publiek DNS-doel. De bestemming voor nieuwe publieke DNS is nog niet vastgesteld; daarom staat hier geen fictief record. Laat bestaande DNS/firewall/routing staan.
2. Rond indien nodig de afzonderlijke Supabase-/migratie-/provideracceptatie af, met veilige testaccounts en backup-/herstelbewijs. Geen schemawijziging als onderdeel van appactivatie.
3. Controleer kandidaatmanifest en exacte configuratie-ID/SHA. Valideer de eigen systemd-unit; controleer User/Group, vaste toolchain, WorkingDirectory, EnvironmentFile en loopbackpoort:

```bash
set -euo pipefail
sudo systemd-analyze verify /etc/systemd/system/fabelpad-vps08-staging.service
sudo systemctl cat fabelpad-vps08-staging.service
sudo systemctl show fabelpad-vps08-staging.service --property=User,Group,WorkingDirectory,EnvironmentFiles,ActiveState,SubState --no-pager
```

4. Start de afzonderlijke activatieworkflow op `main` en laat eventuele ingestelde goedkeuringsregels doorlopen:

```bash
set -euo pipefail
CANDIDATE_ID=SHA_RUN_ID_POGING_UIT_MANIFEST
gh workflow run fabelpad-dg-vps-08-staging-activate.yml --repo fabelpad/platform --ref main -f release_sha="$RELEASE_SHA" -f candidate_id="$CANDIDATE_ID" -f config_id="$CONFIG_ID"
gh run list --repo fabelpad/platform --workflow fabelpad-dg-vps-08-staging-activate.yml --limit 5
gh run watch ACTIVATIE_RUN_ID --repo fabelpad/platform --exit-status
```

5. De adapter bundelt app en runtimeconfiguratie, serialiseert activering/rollback met hetzelfde eigen lock, wisselt alleen de eigen `current`, herstart uitsluitend de eigen service en vereist loopbackhealth met de exacte SHA. Controleer op de doelhost:

```bash
set -euo pipefail
sudo systemctl status fabelpad-vps08-staging.service --no-pager
readlink /srv/sites/fabelpad-vps08-staging/current
curl --fail --silent --show-error http://127.0.0.1:4188/api/health
sudo journalctl -u fabelpad-vps08-staging.service -n 80 --no-pager
```

6. Render pas daarna de afzonderlijke proxysnippet uit `deploy/host/fabelpad-vps08-staging.caddy.disabled` met de geverifieerde domeinnaam. De placeholder is geen bruikbare doelconfiguratie. Laat een beheerder de **nieuwe** snippet eerst buiten `/etc/caddy/sites/*.caddy` voorbereiden en samen met de bestaande Caddyconfiguratie valideren. Controleer alle bestaande services/health vóór de wijziging. Dit beheerderscommando maakt uitsluitend nieuwe voorbereide bestanden; het weigert bestaande bestanden te overschrijven:

```bash
set -euo pipefail
FABELPAD_APP_ORIGIN=BEVESTIGDE_HTTPS_ORIGIN
sudo /usr/bin/python3 -I - "$FABELPAD_APP_ORIGIN" <<'PY'
import os, re, sys
from pathlib import Path
from urllib.parse import urlsplit
origin = urlsplit(sys.argv[1])
if (origin.scheme != 'https' or origin.username or origin.password or origin.port
        or origin.path not in ('', '/') or origin.query or origin.fragment
        or not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+', origin.hostname or '')):
    raise SystemExit('Verwacht de bevestigde HTTPS-origin zonder poort of pad.')
root = Path('/etc/dg-webservices/fabelpad-vps08-staging/prepared')
template = (root / 'fabelpad-vps08-staging.caddy.disabled').read_text()
rendered = template.replace('__VERIFIED_FABELPAD_DOMAIN__', origin.hostname)
if '__VERIFIED_FABELPAD_DOMAIN__' in rendered or rendered == template:
    raise SystemExit('Ongeldige of ontbrekende proxyplaceholder.')
files = {
    root / 'fabelpad-vps08-staging.rendered.caddy': rendered,
    root / 'caddy-validation.conf': 'import /etc/caddy/Caddyfile\nimport /etc/dg-webservices/fabelpad-vps08-staging/prepared/fabelpad-vps08-staging.rendered.caddy\n',
}
if any(p.exists() for p in files):
    raise SystemExit('Eigen voorbereide bestanden bestaan al; inspecteer ze eerst.')
for target, content in files.items():
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    with os.fdopen(fd, 'w') as stream:
        stream.write(content)
PY
sudo caddy validate --config /etc/dg-webservices/fabelpad-vps08-staging/prepared/caddy-validation.conf --adapter caddyfile
```

Alleen als die validatie en de voorafgaande acceptatie slagen, voegt de beheerder het **nieuwe** eigen bestand onder de bestaande import toe. Ook dit weigert overschrijven. Valideer vervolgens de volledige bestaande configuratie en herlaad pas na geslaagde validatie:

```bash
set -euo pipefail
sudo /usr/bin/python3 -I - <<'PY'
import os
from pathlib import Path
source = Path('/etc/dg-webservices/fabelpad-vps08-staging/prepared/fabelpad-vps08-staging.rendered.caddy')
target = Path('/etc/caddy/sites/fabelpad-vps08-staging.caddy')
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
with os.fdopen(fd, 'wb') as stream:
    stream.write(source.read_bytes())
PY
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Als validatie na de eigen toevoeging faalt: herlaad niet; verwijder/herstel uitsluitend de eigen aantoonbare nieuwe snippet en valideer opnieuw. Wijzig geen gedeelde Caddyopties of bestaande sites. De precieze domeinnaam/DNS-/certificaatbestemming blijft open totdat de eigenaar die bevestigt.

7. Controleer DNS, certificaat en publieke health op de bevestigde origin. Gebruik dezelfde `$RELEASE_SHA` als bij de kandidaat; vergelijk de volledige `revision`, `environment=staging`, `service=fabelpad` en `ok=true`:

```bash
set -euo pipefail
FABELPAD_APP_ORIGIN=BEVESTIGDE_HTTPS_ORIGIN
curl --fail --silent --show-error "$FABELPAD_APP_ORIGIN/api/health"
curl --fail --silent --show-error --output /dev/null "$FABELPAD_APP_ORIGIN/privacy"
curl --fail --silent --show-error --output /dev/null "$FABELPAD_APP_ORIGIN/support"
```

8. **Readiness:** bij `local` controleer eerste start, lezen/verhaalkeuze, profielscheiding, bewaren/hervatten, ouderlinks en verwijderen met synthetische profielen. Bij `supabase` daarnaast echte login/sessieherstel, twee gescheiden ouders/gezinnen, gemanipuleerde kind-ID's/RLS, synchronisatie/conflicten, studio-autorisatie en de werkelijke mailgateway/outbox. `configured-unverified` en een health-200 bewijzen dit niet. Controleer na de proxywijziging ook opnieuw de bekende bestaande omgevingen.

## Later: rollback en mislukte eerste installatie

Bewaar de vorige gezonde app én runtimeconfiguratie samen. De app hoeft niet als buildaccount te kunnen schrijven. Activering en rollback gebruiken dezelfde concurrencygroep en hetzelfde root-owned activatielock. De vorige release moet een passend `healthy.json` hebben. Rollback controleert SHA/CI/environment opnieuw en weigert een andere terugzet-SHA dan de werkelijk vastgelegde vorige gezonde release.

Lees eerst alleen de metadata van de vorige combinatie op de doelhost:

```bash
set -euo pipefail
readlink /srv/sites/fabelpad-vps08-staging/previous
sudo /usr/bin/python3 -I -c 'import json; from pathlib import Path; p=Path("/srv/sites/fabelpad-vps08-staging/previous/manifest.json"); d=json.loads(p.read_text()); print(d["sha"],d["configId"],d["id"])'
```

Start na een aparte herstelopdracht de handmatige rollbackworkflow met precies die SHA en doorloop eventuele ingestelde goedkeuringsregels:

```bash
set -euo pipefail
PREVIOUS_SHA=VOLLEDIGE_SHA_UIT_HET_VORIGE_GEZONDE_MANIFEST
gh workflow run fabelpad-dg-vps-08-staging-rollback.yml --repo fabelpad/platform --ref main -f release_sha="$PREVIOUS_SHA"
gh run list --repo fabelpad/platform --workflow fabelpad-dg-vps-08-staging-rollback.yml --limit 5
gh run watch ROLLBACK_RUN_ID --repo fabelpad/platform --exit-status
```

Voer daarna dezelfde loopback-/publieke health- en readinesscontroles uit. Rollback wijzigt geen database, provider, DNS of proxy.

Bij een opgevangen activatiefout herstelt de adapter de vorige gezonde eigen app/configuratie. Bij een mislukte **eerste** installatie zonder vorige release stopt hij alleen de eigen appservice en verwijdert uitsluitend de eigen `current`; de mislukte release blijft voor onderzoek. Bij beëindigde workflow, hostuitval of procesafbreking is deze foutafhandeling niet vanzelf bewezen: inspecteer eerst eigen `current`, `previous`, manifesten, locks en service. Stop zo nodig uitsluitend `fabelpad-vps08-staging.service`; hervat of verwijder verwijzingen pas na beoordeling. Neem geen andere appomgeving over om de eerste installatie te redden.

## Migraties apart

Bestaande databases blijven tijdens deze voorbereiding onaangeraakt. Vóór een afzonderlijke migratie: bevestig het juiste nieuwe Supabase-project/ref/regio, inventariseer migratiehistorie, maak een versleutelde backup, leg retentie/sleutelbeheer vast en bewijs herstel op geïsoleerde data. Beoordeel compatibiliteit met huidige/vorige webrelease en ondersteunde native versies. Start met uitbreidende wijzigingen; geen live reset of aangenomen veilige down-migratie. Approllback herstelt geen database, Edge Function, Auth-provider of mailcontract. Databasebeheer-/backuptoegang gaat niet naar build, runner of app.

## Validatie en overdracht

| Resultaat | Status / bewijs |
| --- | --- |
| Geïsoleerde broncontrole vóór eindcommit | `pnpm install --frozen-lockfile` en `bash scripts/local-build.sh` geslaagd in een afzonderlijke schone bronkopie; geen bestaande omgevingsconfiguratie of data overgenomen |
| Release-/installercontracttests | Definitieve route: 82 Node-tests en 13 synthetische hosttests geslaagd; geen echte appactivatie/rollback uitgevoerd |
| Lokale Next-runtime / browser | Productiebundel op eigen loopbackpoort 3017: health HTTP 200 en alle 6 Playwrightscenario's geslaagd; routingscheiding, verhaalbewaring/versies/dubbeltikken, telefoon/opslagfouten, stationsacties, gezin-UI en studio-UI. De laatste twee gebruiken gemockte sessies; geen echte Supabase-login bewezen. Eigen testserver daarna gestopt. |
| Lokale schone eindcommitbuild | Nog uit te voeren op de definitieve voorbereidingscommit; bovenstaande werkboomvalidatie wordt niet als eindcommitbuild gepresenteerd |
| Nieuwe hosttoevoegingen | Installer v2 voltooid 20 november 2026 18:39:44 UTC: `prepared-inactive`; eigen accounts/paden, root-owned adapter, beperkte sudoers, toolchain, pakket en beide inactieve units geïnstalleerd; modulehashes gecontroleerd |
| Rechten | Alle tests geslaagd: uitsluitend drie vaste sudo-entrypoints met digest/NOSETENV; runner kan build/runtimeconfig niet lezen, build kan runtime niet lezen; geen van de drie schrijft adapter/unit/releases; app schrijft alleen `shared` |
| Gedeeld lock / bestaande groep | Lock, bestaande tmpfiles en `dg-build` GID 984/lid `castiq-build` ongewijzigd hergebruikt |
| Hostnameting | Bestaande service-PID/status, standaard-HTTP/bodyhash, proxy-/SSH-configuratie en current-verwijzingen gelijk; uitsluitend externe CastIQ-unithashwijziging vastgesteld en onderzocht, hieronder toegelicht |
| Runnerregistratie | Officieel runnerpakket 2.338.2 met checksum/versie geverifieerd, bestanden en unit aanwezig; `.runner` ontbreekt, niet geregistreerd/gestart. Groep en selected-workflowbeperking nog te bewijzen; runnergroepen-API HTTP 403 door ontbrekende organisatietoegang |
| GitHub environment | Geen aanwezig; private organisatie gebruikt GitHub Free, minimaal Team voor environment/branchbeleid nodig; geen betaling/wijziging uitgevoerd |
| Vier doelwaarden | Door eigenaar later in te voeren |
| Kandidaat op doel-VPS | **Nee**; geen build zonder exacte main-SHA/CI, veilige doelconfiguratie en beveiligde geregistreerde runner |
| Eerste appstart / current-wissel / activering | **Niet uitgevoerd** |
| Publieke route / DNS / TLS / proxyreload | **Niet uitgevoerd** |
| Supabase-migratie / providerwijziging | **Niet uitgevoerd** |

### Geconstateerd verschil en onderzoek

De hashes van de bestaande CastIQ app- en workerunits veranderden tussen nulmeting en nameting. Onderzoek bevestigde wijzigingstijd **18:39:35 UTC**, negen seconden vóór voltooiing van het installatiebewijs om 18:39:44 UTC. De eigen appunit is aantoonbaar later geschreven; dit tijdsverschil bewijst niet het exacte startmoment van de installer of wie de andere units wijzigde. De Fabelpad-installer heeft een vaste eigen schrijfset waarin geen CastIQ-unit voorkomt. Beide CastIQ-services bleven `inactive/dead`, PID `0`; de bestaande runner bleef met PID `29204` draaien. De wijziging valt buiten de eigen schrijfset; de externe actor is niet vastgesteld. Er is geen bestand van die omgeving teruggezet of aangepast.

| Referentiebestand | Voor → na (SHA-256) |
| --- | --- |
| CastIQ appunit | `ddf940bcf04afa6c0d0817a9ac85bd585d0f08a86b8cb56f985694f11692d6bb` → `a16d927eb7f9c765d4fda52b0e6de8869613a71f1589ec44adf87411adb00dca` |
| CastIQ workerunit | `fab98afb96254901ed8851b1ff3582d4808ca721be1c313a655b9ee38537f0e4` → `b1bfc083595033f5683969fb7ea1ce38feec3a4b9e2505228ca19b6216a9b181` |

Het geschoonde voor-/nabewijs en installatiebewijs staan in [dg-vps-08-2026-11-20.json](deploy-evidence/dg-vps-08-2026-11-20.json); geen secrets of runtimewaarden in deze uitvoer. Er zijn geen bestaande services of runners herstart en geen publieke routes gewijzigd.

De opdrachten hierboven verwijzen naar de voorbereide scripts en drie concrete handmatige workflows. Open doelwaarden en GitHubregistratie blijven blokkades voor een doelbuild; publieke activatie blijft een latere afzonderlijke opdracht.
