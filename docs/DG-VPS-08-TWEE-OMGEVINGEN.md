# Fabelpad — staging en production op dg-vps-08

Gecontroleerd op **22 november 2026**. Dit document vervangt voor deze twee doelen de uitgangspunten van de stagingvoorbereiding van 20 november. De eigenaar heeft wijzigingen in beide Fabelpad-omgevingen en bijbehorende Supabase-accounts toegestaan. Deze hostvoorbereiding heeft geen app of publieke route geactiveerd.

**Feitelijke status:** beide doelen zijn op de VPS voorbereid; beide appservices en runnerservices zijn `disabled/inactive`. De runners zijn **niet geregistreerd**. Op beide doelen staan **nul kandidaten en nul releases**, zonder `current`-verwijzing. E-mail-OTP heeft nog geen geverifieerd readinessbewijs op de host. Een voorbereide host bewijst geen werkende Supabase-/Resend-koppeling of geslaagde doelbuild.

Het gecommitteerde [controlebewijs](deploy-evidence/dg-vps-08-2026-11-22.json) bevat hostidentiteit, feitelijke accounts, versies, modulehashes, rechtencontroles en de vergelijking van bestaande omgevingen. Het bevat geen configuratiewaarden of credentials.

## Twee vaste identiteiten

Repository: `https://github.com/fabelpad/platform.git`. Integratiebranch: **`main`**. SSH-doel: **`dg-vps-08`**, machine-id `05db94b99eca4c3d815f6585ef8ed517`. Strict host checking gebruikte de bestaande gepinde sleutel via `HostKeyAlias=100.65.51.108`.

| Onderdeel | Staging | Production |
| --- | --- | --- |
| Bestaande GitHub environment | **`staging`** | **`production`** |
| Doel-ID / exacte runnernaam | `fabelpad-vps08-staging` | `fabelpad-vps08-production` |
| Supabase-account volgens eigenaar | `fabelpad` | `Duindorpdoet` |
| Eigen runneraccount, UID/GID | `run-fab-v08-stg`, `993/983` | `run-fab-v08-prd`, `987/980` |
| Eigen buildaccount, UID/GID | `build-fab-v08-stg`, `990/982` | `build-fab-v08-prd`, `986/979` |
| Eigen appaccount, UID/GID | `app-fab-v08-stg`, `988/981` | `app-fab-v08-prd`, `985/978` |
| Eigen loopbackpoort | `127.0.0.1:4188` | `127.0.0.1:4189` |
| Appservice | `fabelpad-vps08-staging.service` | `fabelpad-vps08-production.service` |
| Runnerservice | `fabelpad-vps08-staging-runner.service` | `fabelpad-vps08-production-runner.service` |

Beide poorten zijn vóór en na voorbereiding daadwerkelijk met een tijdelijke loopback-bind gecontroleerd als vrij. Dit reserveert de poort niet permanent; controleer haar opnieuw vóór een eerste start.

De GitHub-environments **`staging`** en **`production`** bestaan en hebben volgens de alleen-lezen controle door de hoofdagent ieder de vier afgesproken variabelen. Een nieuwe environment met de naam van een VPS-doel-ID is niet nodig. De host-ID en de GitHub-environmentnaam hebben verschillende functies.

Alleen deze vier GitHub-environmentvariabelen worden gebruikt:

| Naam | Bron en fase |
| --- | --- |
| `FABELPAD_APP_ORIGIN` | De bevestigde HTTPS-origin van dit doel; build- en runtimeconfiguratie |
| `FABELPAD_DATA_MODE` | Voor de gevraagde cloud-/OTP-inrichting exact `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | Het Supabase-project van dezelfde omgeving; publieke build- en runtimewaarde |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key van dat project; `sb_publishable_…`, geen secret/service-role key |

De kandidaatjobs verwijzen naar de juiste environment en lezen daardoor de omgevingswaarden. Ze voegen geen repositoryvariabelen toe. SHA, omgeving, poort, workflowrun en authflags worden door het gecontroleerde releasecontract bepaald. Wijziging van een ingebakken publieke waarde vereist een nieuwe kandidaat en configuratie-ID.

## Feitelijk voorbereide host

Vervang in onderstaande paden `<site>` uitsluitend door een van de twee vaste doel-ID's:

| Pad | Rechten en functie |
| --- | --- |
| `/usr/local/libexec/<site>` | Root-owned adapters; runner, build en app kunnen ze niet schrijven |
| `/etc/dg-webservices/<site>/host.json` | Root-owned hostidentiteit, accounts, paden en pins; geen secrets |
| `/etc/dg-webservices/<site>/installation.json` | Installatiebewijs met modulehashes; staging bevat tevens de adapterupgrade |
| `/etc/dg-webservices/<site>/build-configs/CONFIG_ID.env` | Onveranderlijk snapshot van de vier publieke waarden, `root:build 0640` |
| `/etc/dg-webservices/<site>/runtime-configs/CONFIG_ID/SHA.env` | Versiegebonden runtimeconfiguratie, `root:app 0640` |
| `/etc/dg-webservices/<site>/email-readiness.json` | Nog ontbrekend rootbewijs van de werkelijk geverifieerde OTP-/mailroute |
| `/etc/dg-webservices/<site>/prepared` | Eigen voorbereide units en uitgeschakelde proxysnippet |
| `/var/lib/dg-build/<site>/{home,work}` | Gescheiden buildwerk; geen toegang tot runtimeconfiguratie |
| `/opt/actions-runner/<site>` | Eigen uitgepakte runnerbinary; niet geregistreerd of gestart |
| `/opt/dg-toolchains/<site>` | Eigen root-owned Node-/pnpm-toolchain |
| `/srv/sites/<site>/{candidates,releases,shared}` | Verzegelde kandidaten, gekoppelde app/config-releases en enige appschrijfmap |

Node **24.18.0** en pnpm **11.25.0** zijn per doel aanwezig. De productie-toolchain is gekopieerd van de bestaande root-owned Fabelpad-stagingtoolchain, nadat haar volledige inhoud was vergeleken met de officiële archieven. Daarna is dezelfde vergelijking voor productie herhaald: **5.162 bestanden en symlinks**, plus daadwerkelijke versiecontroles. De officiële archivechecksums en manifestdigest staan in het controlebewijs. Er is geen gedeeld pakket of systeem-PATH aangepast.

De officiële runnerbinary **2.338.2** is voor productie op archivechecksum gecontroleerd. `bin/runsvc.sh` is volgens het runnercontract naar de eigen runnerroot gekopieerd. De eigen production-runnerunit is gevalideerd en als nieuwe unit geïnstalleerd. `systemctl daemon-reload` heeft de nieuwe unit zichtbaar gemaakt; geen service is gestart.

De stagingadapters zijn met `--upgrade-adapters` bijgewerkt. Dit controleert de bestaande installatie-identiteit en alle eerdere modulehashes, vereist een gestopte eigen runner, houdt het bestaande gedeelde buildlock en eigen activatielock vast en herstelt eigen vervangen bestanden bij een vervangingsfout. De productie-inrichting is als nieuwe toevoeging gemaakt. Er zijn geen bestaande appreleases of runtimeconfiguraties gewijzigd.

Rechtencontroles onder elk van de zes accounts bevestigen dat alleen het buildaccount zijn buildconfiguratiedirectory kan betreden, alleen het appaccount zijn runtimeconfiguratiedirectory en geen van de drie rollen privileged code kan schrijven. Iedere runner heeft precies drie `NOSETENV`, digestgepinde sudo-opdrachten voor zijn eigen kandidaat-, activatie- en rollbackadapter; geen algemene sudo.

De buildroute gebruikt het bestaande gedeelde `/run/lock/dg-build.lock` en de bestaande persistentie in `/etc/tmpfiles.d/castiq-staging-build-lock.conf`. Die inrichting is behouden. De eigen activatie-/rollbacklocks staan onder de afzonderlijke configuratieroots.

## Behoud van bestaande omgevingen

De nameting vergeleek de nulmeting van **15:04:34 CET** met **15:08:00 CET** op 22 november. Er zijn **geen verschillen** gevonden in de opgenomen bestaande services, processen, configuratiehashes, HTTP-responses of releaseverwijzingen:

- Caddy, SSH, Tailscale en de Castiq-stagingrunner bleven actief met dezelfde PID's.
- Castiq-staging en de Castiq-worker bleven inactief.
- De hashes van Caddy-, SSH-, Castiq-unit- en bestaande buildlockpersistentieconfiguratie bleven gelijk.
- De standaard-HTTP-response en de actieve Caddy-configuratiehash bleven gelijk.
- Er waren vóór en na geen `current`-verwijzingen onder de onderzochte releasepaden.

Er is geen Caddy-reload, DNS-wijziging, appstart of databasehandeling uitgevoerd door deze hostvoorbereiding. Supabase CLI is niet gebruikt voor hostinstallatie of deployment; die route gebruikt Node, Python, systemd en de bestaande Caddy-proxy.

## Gates vóór een kandidaat

1. Review en integreer de twee-omgevingenwijziging veilig in `main`. Controleer vooraf opnieuw alle bestaande push-/tagworkflows en eventuele Supabase-GitHub-integratie op neveneffecten.
2. Laat op exact dezelfde volledige main-SHA beide verplichte pushcontroles slagen: job **`verify`** uit `verify.yml` en **`Native Android-controles`** uit `fabelpad-android-ci.yml`. Een oudere groene run, PR-run of overgeslagen verplichte stap telt niet. De optionele signing-/Play-job mag ontbreken wanneer publicatie is uitgeschakeld.
3. Verifieer de juiste vier waarden per bestaande GitHub environment en de Supabase-projectidentiteit per account. Verifieer dat staging en productie gescheiden projecten en app-origins gebruiken.
4. Maak de Supabase-/Resend-route daadwerkelijk werkend: juiste Site URL/redirects, Send Email Hook, geverifieerd verzenddomein, secrets uitsluitend bij de server-/Edge Function en een geslaagde synthetische OTP-/verzendtest. Geef het buildaccount en de runner geen Resend API-key of hook signing secret.
5. Plaats pas daarna per doel het hieronder beschreven readinessbewijs. De kandidaatadapter weigert te bouwen zonder passend bewijs.
6. Registreer en start uitsluitend de betreffende eigen runner nadat de actuele GitHub-repository-/runnergroep-/workflowtoegang is gecontroleerd. De runners staan nu nog ongeregistreerd en uit. Er is geen opnieuw geverifieerde uitspraak over abonnement of runnergroeptoegang in dit document.

De workflows zijn alleen handmatig en staan vast op `fabelpad/platform`, `refs/heads/main` en de eigen hostidentiteit. De root-owned adapters controleren opnieuw de exacte SHA/CI, actuele workflowrun/poging, geslaagde hosted preflight, eigen actieve job, runnernaam en labels. Een runnerlabel bewijst op zichzelf geen toegangsbeperking. Registreer niet als een onbetrouwbare PR of andere repository deze privileged runner zou kunnen gebruiken.

Runnerlabels per doel: `self-hosted`, `Linux`, `X64`, `dg-vps-08`, gevolgd door exact de eigen doel-ID. Het registratietoken blijft buiten broncode, uitvoer, bestanden en procesargumenten. Gebruik de ondersteunde geheime runnerinvoer `ACTIONS_RUNNER_INPUT_TOKEN` via een beheerproces; plaats geen token in een kopieerbaar shellcommando of chat.

Pas na gecontroleerde registratie en toegangsbeperking, op de VPS voor het gekozen doel:

```bash
set -euo pipefail
DEPLOY_ENV=staging # kies bewust staging of production
case "$DEPLOY_ENV" in staging|production) ;; *) exit 64 ;; esac
SITE="fabelpad-vps08-$DEPLOY_ENV"
sudo test -f "/opt/actions-runner/$SITE/.runner"
sudo systemctl enable --now "$SITE-runner.service"
sudo systemctl is-active "$SITE-runner.service"
```

Controleer tevens via GitHub dat exact dezelfde runnernaam online is, in de bedoelde scope met de juiste labels. Deze startopdrachten zijn tijdens de voorbereiding **niet uitgevoerd**.

## OTP-readinessbewijs en onveranderlijke runtime

Een beheerder plaatst na echte verificatie `/etc/dg-webservices/<site>/email-readiness.json` als **`root:root 0600`**, met uitsluitend deze niet-geheime metadata. Onderstaande invulwaarden zijn geen bewijs; vervang ze door de gecontroleerde waarden en tijd:

```json
{
  "version": 1,
  "environment": "staging",
  "siteId": "fabelpad-vps08-staging",
  "provider": "resend",
  "emailOtpVerified": true,
  "sendEmailHookVerified": true,
  "appOrigin": "DE_EXACTE_FABELPAD_APP_ORIGIN",
  "supabaseUrl": "DE_EXACTE_NEXT_PUBLIC_SUPABASE_URL",
  "verifiedAt": "ISO_TIJD_VAN_GESLAAGDE_VERIFICATIE"
}
```

Voor productie worden `environment` en `siteId` exact `production` en `fabelpad-vps08-production`. De adapter weigert een andere omgeving, origin, project, provider of ontbrekende geslaagde verificatie. Neem geen e-mailadres, ontvangen OTP, API-key, token of e-mailinhoud in het bewijs op. Beide readinessbestanden ontbreken nog volgens de hostnameting.

Na passend bewijs maakt de kandidaatadapter een nieuw onveranderlijk snapshot met de vier publieke waarden plus automatisch `FABELPAD_DEPLOY_ENV`, `FABELPAD_RELEASE_SHA`, `PORT`, `FABELPAD_AUTH_EMAIL_ENABLED=true` en `FABELPAD_AUTH_GOOGLE_ENABLED=false`. Deze extra namen zijn hostgegenereerde runtimeconfiguratie, geen extra GitHub-variabelen. Eerder gebruikte configuratie-ID's worden niet stilzwijgend overschreven. Een nieuwe configuratie of herbevestigde mailinrichting krijgt een nieuwe configuratie-ID.

## Kandidaat bouwen, afzonderlijk activeren en herstellen

De zes workflows heten `fabelpad-dg-vps-08-<omgeving>-candidate.yml`, `-activate.yml` en `-rollback.yml`, met `<omgeving>` exact `staging` of `production`. Elke app/configuratiecombinatie blijft bij één release horen. De gedeelde buildlock begrenst builds; het eigen activatielock en de GitHub-concurrency voorkomen gelijktijdige activatie en rollback binnen hetzelfde doel.

Voer onderstaande stappen pas uit nadat bovenstaande gates aantoonbaar zijn afgerond. Een workflow dispatch is een werkelijke opdracht; de voorbeelden zijn geen reeds uitgevoerde release.

```bash
set -euo pipefail
DEPLOY_ENV=staging # test staging eerst; kies production daarna afzonderlijk
case "$DEPLOY_ENV" in staging|production) ;; *) exit 64 ;; esac
RELEASE_SHA=VOLLEDIGE_GOEDGEKEURDE_MAIN_SHA
CONFIG_ID=NIEUWE_NIET_GEHEIME_CONFIGURATIE_ID
gh workflow run "fabelpad-dg-vps-08-$DEPLOY_ENV-candidate.yml" \
  --repo fabelpad/platform --ref main \
  -f release_sha="$RELEASE_SHA" -f config_id="$CONFIG_ID"
gh run list --repo fabelpad/platform \
  --workflow "fabelpad-dg-vps-08-$DEPLOY_ENV-candidate.yml" --limit 5
gh run watch BOUW_RUN_ID --repo fabelpad/platform --exit-status
```

`release_sha` bestaat uit exact 40 kleine hextekens. `config_id` bestaat uit 1–63 kleine letters/cijfers/streepjes en begint met een letter/cijfer. De workflow meldt de kandidaat-ID **`SHA-RUN_ID-RUN_ATTEMPT`**. Een geslaagde kandidaatbuild start geen app en wijzigt geen `current`. Bekijk het kandidaatmanifest voor exact dezelfde omgeving, SHA, beide CI-bewijzen, configuratiedigest en artefactdigest.

Installatie: `pnpm install --frozen-lockfile --prod=false --package-import-method=copy`. De worker draait de normale projectchecks en **`pnpm build`**. Output bevat onder meer `.next`, `public` en de benodigde `node_modules`. Startcontract blijft **`pnpm start`**; de eigen systemd-unit start de gepinde Nodebinary met Next op de vaste loopbackpoort. Er zijn geen automatische migraties of mailverzendingen in deze buildroute.

Na afzonderlijke beoordeling van de verzegelde kandidaat en juiste runtimeconfiguratie:

```bash
set -euo pipefail
CANDIDATE_ID=EXACTE_KANDIDAAT_ID_UIT_DE_BOUWROUTE
gh workflow run "fabelpad-dg-vps-08-$DEPLOY_ENV-activate.yml" \
  --repo fabelpad/platform --ref main \
  -f release_sha="$RELEASE_SHA" -f candidate_id="$CANDIDATE_ID" -f config_id="$CONFIG_ID"
gh run list --repo fabelpad/platform \
  --workflow "fabelpad-dg-vps-08-$DEPLOY_ENV-activate.yml" --limit 5
gh run watch ACTIVATIE_RUN_ID --repo fabelpad/platform --exit-status
```

De activatie gebruikt exact environment `staging` of `production` en respecteert aanwezige GitHub-bescherming. De adapter controleert een bestaande expliciete branchpolicy; bij ontbreken ervan blijven de vaste workflow- en hostcontroles op `main` verplicht. Er wordt geen environment aangemaakt of betaald abonnement verondersteld.

Controleer vóór activering de eigen unit met `systemd-analyze verify` en `systemctl show`. Controleer na activering op de VPS de eigen service en `http://127.0.0.1:4188/api/health` voor staging, of `http://127.0.0.1:4189/api/health` voor production. De JSON moet `ok=true`, `service=fabelpad`, `runtime=nextjs-node`, de juiste `environment` en exact de vrijgegeven `revision` geven. Dit is process/configuratie-liveness, geen volledige database- of mailreadiness.

Test afzonderlijk de eerste OTP-aanvraag, codebevestiging, ingelogde sessie, uitloggen, beheerdersrol van het aangewezen account en de belangrijkste lees-/beheerflow met synthetische gegevens. Controleer ook verlopen/hergebruikte OTP's, geweigerde toegang tot beheerfuncties en scheiding tussen staging en productie. Sla geen OTP's of echte persoonsgegevens in testuitvoer op.

Een publieke route vereist daarnaast een bevestigde origin, geverifieerd publiek bestemmingsadres, passende DNS, een afzonderlijke eigen Caddy-snippet en geldige TLS. De aanwezige `.caddy.disabled` is geen actieve route. Valideer de nieuwe snippet samen met de bestaande Caddyconfiguratie vóór installatie/reload en controleer bestaande healthchecks vóór en na. Activeer pas een publieke route wanneer deze netwerkgegevens en opdracht zijn bevestigd. Controleer daarna publieke `/api/health`, certificaat en volledige OTP-/appflow via HTTPS. Het Tailscale-adres is geen publiek DNS-doel.

Voor rollback bepaalt een beheerder op de VPS eerst de echte vorige gezonde SHA uit `/srv/sites/<site>/previous/manifest.json`. Gebruik die SHA en de eerder gekozen omgeving:

```bash
set -euo pipefail
PREVIOUS_SHA=VOLLEDIGE_SHA_VAN_DE_ECHTE_VORIGE_GEZONDE_RELEASE
gh workflow run "fabelpad-dg-vps-08-$DEPLOY_ENV-rollback.yml" \
  --repo fabelpad/platform --ref main -f release_sha="$PREVIOUS_SHA"
gh run list --repo fabelpad/platform \
  --workflow "fabelpad-dg-vps-08-$DEPLOY_ENV-rollback.yml" --limit 5
gh run watch ROLLBACK_RUN_ID --repo fabelpad/platform --exit-status
```

Rollback herstelt app én bijbehorende runtimeconfiguratie samen, onder hetzelfde eigen activatielock. De adapter accepteert alleen de opgeslagen vorige gezonde release en controleert CI en health opnieuw. Bij een mislukte eerste installatie zonder vorige release stopt hij uitsluitend de eigen app en verwijdert hij de eigen `current`-verwijzing. Er is nu nog geen vorige gezonde release; een live rollbacktest is niet uitgevoerd. Databasemigraties en herstel zijn afzonderlijke handelingen: vooraf compatibiliteit, back-up en herstelprocedure vastleggen; een approllback draait geen schemawijzigingen terug.

## Installercontract en overdracht

De beoordeelde root-owned installatiebron van deze uitvoering staat op `/var/tmp/fabelpad-two-env-20261122`. De code in Git gebruikt expliciet de doelomgeving. Voor een nog niet bestaand doel is de vorm:

```bash
sudo /usr/bin/python3 -I scripts/deploy/install-host.py \
  --environment production --source-root /PAD/NAAR/BEOORDEELDE/BRON
```

`--apply` voert de nieuwe voorbereiding uit. Beide vaste doelen bestaan nu; herhaal de nieuwe installatie daar niet. Een latere adapterupdate gebruikt eerst dezelfde opdracht met `--environment staging` of `production` plus `--upgrade-adapters`, standaard als dry-run en pas na beoordeling met `--apply`. De eigen runner moet daarvoor gestopt zijn; de adapterupdate wijzigt geen appservice, proxy of releaseverwijzing.

Uitgevoerde verificatie: **86 releasetests en 19 install-/upgradetests geslaagd**, versiecontroles op de host, beide vrijebindcontroles, zes accountisolatiecontrolesets en identieke voor-/nameting van bestaande omgevingen. De checksums in het JSON-bewijs beschrijven de daadwerkelijk geïnstalleerde adapterversie; latere codewijzigingen vereisen opnieuw beoordeling en een gecontroleerde update.

Open vóór een eerste doelbuild: geïntegreerde workflowcode en exacte groene main-SHA, gecontroleerde runnerregistratie/toegang, geverifieerde Supabase-/Resend-inrichting en twee echte readinessbewijzen. De vier GitHub-waarden bestaan reeds per environment; hun aanwezigheid alleen bewijst geen geldige providerconfiguratie. Een kandidaatbuild op de doel-VPS blijft een afzonderlijk nog niet uitgevoerd resultaat.
