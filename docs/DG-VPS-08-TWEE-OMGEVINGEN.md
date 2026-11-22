# Fabelpad — staging en production op dg-vps-08

Actuele overdracht: **22 november 2026**. De eigenaar heeft uitrol naar beide Fabelpad-omgevingen toegestaan. Dit document beschrijft de bestaande doelidentiteiten, de huidige configuratieroute en de uitvoeringsvolgorde; een opdrachtvoorbeeld is geen uitgevoerde deployment.

**Huidige toestand:** beide eigen runners zijn geregistreerd voor uitsluitend repository `fabelpad/platform`, maar staan offline en hun diensten zijn inactief. Beide appservices zijn inactief. Er staan nog **geen doelkandidaten, geen releases en geen `current`-verwijzingen**. Auth gebruikt de bestaande Supabase Custom SMTP via Resend, met volgens de eigenaar zes OTP-cijfers. De publieke Auth-settings bevestigen in beide projecten e-mail en Google. Een interactieve OTP-/OAuth-proef is daarmee niet bewezen.

## Vaste doelidentiteiten

Repository: `https://github.com/fabelpad/platform.git`. Integratiebranch: **`main`**. SSH-doel: **`dg-vps-08`**, machine-id `05db94b99eca4c3d815f6585ef8ed517`. De bestaande SSH-hostkeypin gebruikt `HostKeyAlias=100.65.51.108`.

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Doel-ID / exacte runnernaam | `fabelpad-vps08-staging` | `fabelpad-vps08-production` |
| Runnerregistratie | Repositoryscope; ID 21 | Repositoryscope; ID 22 |
| Supabase-account | `fabelpad` | `Duindorpdoet` |
| Supabase-project | `tlwfpivafcokcjyjwgmq` | `aptprpkosqctwrzeetgs` |
| App-origin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Supabase-origin | `https://tlwfpivafcokcjyjwgmq.supabase.co` | `https://aptprpkosqctwrzeetgs.supabase.co` |
| Runneraccount, UID/GID | `run-fab-v08-stg`, `993/983` | `run-fab-v08-prd`, `987/980` |
| Buildaccount, UID/GID | `build-fab-v08-stg`, `990/982` | `build-fab-v08-prd`, `986/979` |
| Appaccount, UID/GID | `app-fab-v08-stg`, `988/981` | `app-fab-v08-prd`, `985/978` |
| Loopbackpoort | `127.0.0.1:4188` | `127.0.0.1:4189` |
| Appservice | `fabelpad-vps08-staging.service` | `fabelpad-vps08-production.service` |
| Runnerservice | `fabelpad-vps08-staging-runner.service` | `fabelpad-vps08-production-runner.service` |

Runnerlabels: `self-hosted`, `Linux`, `X64`, `dg-vps-08` en exact de eigen doel-ID. Registratie is repositorygebonden; de oude ontbrekende organisatierechten/runnergroep vormen geen actuele blokkade. Een label op zichzelf bewijst geen beperking: controleer bij de start nog steeds de juiste repositoryscope, runnernaam en labels.

De vier bestaande GitHub-environmentvariabelen blijven:

| Naam | Bron en gebruik |
| --- | --- |
| `FABELPAD_APP_ORIGIN` | Exact de app-origin uit de doeltabel; build en runtime |
| `FABELPAD_DATA_MODE` | `supabase` voor beide online omgevingen |
| `NEXT_PUBLIC_SUPABASE_URL` | Exact het bijbehorende Supabase-project uit de doeltabel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publieke `sb_publishable_…`-key van hetzelfde project |

Geen Resend-key, SMTP-wachtwoord, Supabase-secret of worker-token toevoegen aan deze GitHub-variabelen. Een gewijzigde ingebakken publieke waarde vereist een nieuwe kandidaat en configuratie-ID. Hostgegenereerde SHA, poort en authflags zijn geen extra GitHub-variabelen.

## Hostpaden en rechten

Vervang `<site>` alleen door een van de twee vaste doel-ID's.

| Pad | Functie |
| --- | --- |
| `/usr/local/libexec/<site>` | Root-owned adapters; niet schrijfbaar door runner, build of app |
| `/etc/dg-webservices/<site>/host.json` | Doelidentiteit, account-/pad-/workflowpins |
| `/etc/dg-webservices/<site>/installation.json` | Bewijs van de werkelijk geïnstalleerde adapterversie en modulehashes |
| `/etc/dg-webservices/<site>/build-configs/CONFIG_ID.env` | Onveranderlijk snapshot van vier publieke waarden, `root:build 0640` |
| `/etc/dg-webservices/<site>/runtime-configs/CONFIG_ID/SHA.env` | Bij de release horende runtimeconfiguratie, `root:app 0640` |
| `/etc/dg-webservices/<site>/email-readiness.json` | Rootbestand met configuratiecontrole v2, `root:root 0600`; geen inlogbewijs |
| `/etc/dg-webservices/<site>/prepared` | Voorbereide units en inactieve proxysnippet |
| `/var/lib/dg-build/<site>/{home,work}` | Gescheiden buildwerk zonder toegang tot runtimeconfiguratie |
| `/opt/actions-runner/<site>` | Eigen geregistreerde runner; dienst nog inactief |
| `/opt/dg-toolchains/<site>` | Eigen root-owned Node 24.18.0 / pnpm 11.25.0 |
| `/srv/sites/<site>/{candidates,releases,shared}` | Verzegelde kandidaten, app/config-releases en eigen appschrijfmap |

Elke runner heeft uitsluitend de drie digestgepinde `NOSETENV` sudo-opdrachten voor de eigen kandidaat-, activatie- en rollbackadapter. De gedeelde buildlock is `/run/lock/dg-build.lock`; de bestaande persistentie en andere projecten blijven ongemoeid. Activatie en rollback hebben daarnaast per doel een eigen lock en GitHub-concurrency.

Een adapterupdate gaat via `scripts/deploy/install-host.py --upgrade-adapters`: controle van eerdere hashes en identiteit, gestopte eigen runner, gedeelde buildlock en eigen activatielock, herstel van eigen vervangen bestanden bij fouten. Herhaal op deze bestaande doelen geen nieuwe installatie. Het `installation.json` op de host bepaalt welke versie daadwerkelijk geïnstalleerd is; nieuwere broncode op GitHub bewijst geen uitgevoerde hostupdate.

Het [historische hostbewijs](deploy-evidence/dg-vps-08-2026-11-22.json) legde de oorspronkelijke voorbereiding en onveranderde Caddy/SSH/Tailscale/Castiq-toestand vast. Het blijft ongewijzigd en bewijst geen latere runnerregistratie, adapterupgrade of appstart. Leg bij iedere nieuwe hostwijziging opnieuw relevante bestaande service-/release-/healthtoestand vóór en na vast.

## Auth-configuratie en bewijs v2

**Gebruik de werkende Supabase Custom SMTP-route. Activeer geen Send Email Hook.** De eerdere optionele `auth-email`-Edge Function neemt SMTP alleen over als iemand de hook actief configureert; dat is geen onderdeel van deze route. Supabase Auth-mails gebruiken de Dashboard-templates uit de 31 bestanden onder `supabase/email-templates/`: 26 doelgebonden HTML-bestanden, vier synthetische previews en een manifest.

De root-owned adapter accepteert nu versie 2 van `email-readiness.json`. Dit legt de actuele publieke providerinstellingen en de verklaring van de eigenaar over SMTP/OTP vast. De verplichte waarde `authenticationAcceptance` houdt expliciet bij dat de interactieve e-mail-/Google-acceptatie nog moet plaatsvinden. Zet geen OTP-/OAuth-test op geslaagd zonder die test uit te voeren.

Staging-JSON met de werkelijk gecontroleerde publieke providerinstellingen van **22 november 2026, 17:50:30 UTC**:

```json
{
  "version": 2,
  "environment": "staging",
  "siteId": "fabelpad-vps08-staging",
  "appOrigin": "https://staging.fabelpad.nl",
  "supabaseUrl": "https://tlwfpivafcokcjyjwgmq.supabase.co",
  "emailProviderConfigured": true,
  "googleProviderConfigured": true,
  "otpDigits": 6,
  "ownerConfigurationAttested": true,
  "authenticationAcceptance": "requires-interactive-owner-test",
  "settingsCheckedAt": "2026-11-22T17:50:30.645511+00:00"
}
```

Production-JSON; dit project is op hetzelfde moment afzonderlijk gecontroleerd:

```json
{
  "version": 2,
  "environment": "production",
  "siteId": "fabelpad-vps08-production",
  "appOrigin": "https://fabelpad.nl",
  "supabaseUrl": "https://aptprpkosqctwrzeetgs.supabase.co",
  "emailProviderConfigured": true,
  "googleProviderConfigured": true,
  "otpDigits": 6,
  "ownerConfigurationAttested": true,
  "authenticationAcceptance": "requires-interactive-owner-test",
  "settingsCheckedAt": "2026-11-22T17:50:30.645511+00:00"
}
```

Deze tijdstippen bewijzen de settingscontrole; zij zijn geen interactieve OTP-/OAuth- of bezorgtest. Auto Confirm staat in beide projecten uit. Controleer vóór een latere wijziging opnieuw het eigen project en de publieke Auth-settings, werk dan de controletijd bij en laat een bevoegde beheerder het beoordeelde JSON-bestand plaatsen:

```bash
set -euo pipefail
DEPLOY_ENV=staging # kies staging of production expliciet
case "$DEPLOY_ENV" in staging|production) ;; *) exit 64 ;; esac
SITE="fabelpad-vps08-$DEPLOY_ENV"
sudo install -o root -g root -m 0600 \
  "/PAD/NAAR/BEOORDEELD/$DEPLOY_ENV-email-readiness.json" \
  "/etc/dg-webservices/$SITE/email-readiness.json"
sudo stat -c '%U:%G %a %n' "/etc/dg-webservices/$SITE/email-readiness.json"
```

De adapter vereist exacte overeenkomst van omgeving, site-ID, app-origin en Supabase-origin met de eigen vier publieke configuratiewaarden. Verkeerde projecten, ontbrekende providerflags, een ander aantal OTP-cijfers of een gefingeerde acceptatiestatus worden geweigerd. Het oude v1-formaat blijft alleen bruikbaar voor werkelijk bewezen legacy-hookacceptatie; gebruik het niet om de huidige SMTP-inrichting om te zetten in een hookclaim.

Na passend v2-bewijs maakt de kandidaatadapter naast de vier publieke waarden automatisch `FABELPAD_DEPLOY_ENV`, `FABELPAD_RELEASE_SHA`, `PORT`, `FABELPAD_AUTH_EMAIL_ENABLED=true` en **`FABELPAD_AUTH_GOOGLE_ENABLED=true`**. Beide loginopties verschijnen daardoor in de juiste omgeving. Hergebruik geen reeds vastgelegde configuratie-ID voor gewijzigde waarden of nieuwe authflags.

## Gates en runnerstart

1. Integreer de beoordeelde bron veilig in `main`, na controle van automatische push-/tag-/Supabase-integraties. Gebruik exact de volledige geïntegreerde SHA.
2. Laat op die SHA de twee verplichte pushcontroles slagen: **`verify`** uit `verify.yml` en **`Native Android-controles`** uit `fabelpad-android-ci.yml`. Oude runs, PR-runs, ontbrekende of overgeslagen verplichte stappen tellen niet.
3. Controleer de vier waarden per bestaand environment, de v2-doelpins en de geïnstalleerde adapterversie. Houd staging en production gescheiden.
4. Controleer op de host capaciteit, vrije doelpoort, locks, eigen runnerregistratie en repository-/workflowtoegang. Start alleen de betreffende eigen runner.
5. Bouw staging en production afzonderlijk. Een kandidaatbuild activeert niets. Rond de toepasselijke configuratie-, privacy- en operationele gates af vóór gebruik van de kandidaat.

```bash
set -euo pipefail
DEPLOY_ENV=staging
case "$DEPLOY_ENV" in staging|production) ;; *) exit 64 ;; esac
SITE="fabelpad-vps08-$DEPLOY_ENV"
sudo test -f "/opt/actions-runner/$SITE/.runner"
sudo systemctl enable --now "$SITE-runner.service"
sudo systemctl is-active "$SITE-runner.service"
```

Controleer via GitHub dat exact dezelfde runnernaam online is in repository `fabelpad/platform`, met de vaste labels. De registratie is al uitgevoerd; voer daarvoor geen nieuwe registratie of tokenaanvraag uit. Bovenstaande dienststart is een volgende uitvoeringsstap, geen historische startclaim.

## Kandidaat bouwen

De zes handmatige workflows heten `fabelpad-dg-vps-08-<omgeving>-candidate.yml`, `-activate.yml` en `-rollback.yml`. Zij pinnen repository, `refs/heads/main`, omgeving en host. Hostadapters controleren SHA/CI, actuele workflowrun/poging, hosted preflight, eigen actieve job en runneridentiteit opnieuw.

```bash
set -euo pipefail
DEPLOY_ENV=staging # staging eerst; production daarna afzonderlijk
case "$DEPLOY_ENV" in staging|production) ;; *) exit 64 ;; esac
RELEASE_SHA=VOLLEDIGE_GOEDGEKEURDE_MAIN_SHA
CONFIG_ID=NIEUWE_CONFIGURATIE_ID
gh workflow run "fabelpad-dg-vps-08-$DEPLOY_ENV-candidate.yml" \
  --repo fabelpad/platform --ref main \
  -f release_sha="$RELEASE_SHA" -f config_id="$CONFIG_ID"
gh run list --repo fabelpad/platform \
  --workflow "fabelpad-dg-vps-08-$DEPLOY_ENV-candidate.yml" --limit 5
gh run watch BOUW_RUN_ID --repo fabelpad/platform --exit-status
```

SHA: exact 40 kleine hextekens. Configuratie-ID: 1–63 kleine letters/cijfers/streepjes, beginnend met letter of cijfer. De kandidaat-ID is `SHA-RUN_ID-RUN_ATTEMPT`. Controleer het manifest op eigen omgeving, SHA, twee CI-bewijzen, configuratie- en artefactdigest.

Installatie gebruikt `pnpm install --frozen-lockfile --prod=false --package-import-method=copy`; daarna de normale projectchecks en `pnpm build`. Output bevat `.next`, `public` en de benodigde `node_modules`. Startcontract: `pnpm start`, door systemd met gepinde Nodebinary op de eigen loopbackpoort. De build voert geen automatische migraties of gebruikersmail uit.

Lifecycle-migratie `20261122172905_parent_account_lifecycle.sql` is in beide Supabase-projecten toegepast; er waren nul Auth-gebruikers. De Edge Functions `email-admin` v2 en `account-maintenance` v1 zijn in beide projecten actief; ongesigneerde probes geven HTTP401 zonder mailverzending. De eigen scheduler wordt afzonderlijk ingericht en geverifieerd. Bulkverwijdering na 90 dagen blijft standaard uit totdat stagingrapport, waarschuwingen, overgang en Resend API-servicemail aantoonbaar kloppen. De werkende SMTP-inrichting vervangt die API-key niet.

## Activatie, gebruikersproef en HTTPS

```bash
set -euo pipefail
CANDIDATE_ID=EXACTE_KANDIDAAT_ID
gh workflow run "fabelpad-dg-vps-08-$DEPLOY_ENV-activate.yml" \
  --repo fabelpad/platform --ref main \
  -f release_sha="$RELEASE_SHA" -f candidate_id="$CANDIDATE_ID" -f config_id="$CONFIG_ID"
gh run list --repo fabelpad/platform \
  --workflow "fabelpad-dg-vps-08-$DEPLOY_ENV-activate.yml" --limit 5
gh run watch ACTIVATIE_RUN_ID --repo fabelpad/platform --exit-status
```

Controleer vooraf de eigen unit met `systemd-analyze verify`, de eigen versiegebonden runtimeconfiguratie en de toepasselijke GitHub-environmentbescherming. Controleer daarna de service en eigen loopback `/api/health` op poort 4188 of 4189. Verwacht `ok=true`, `service=fabelpad`, `runtime=nextjs-node`, de juiste omgeving en exacte vrijgegeven SHA. Dit is liveness/configuratie, geen database-, mail- of loginacceptatie.

Test afzonderlijk met synthetische gegevens: e-mailcode van zes cijfers, Google-login, actuele voorwaarden en lege afzonderlijke oudercheckboxes, optionele toestemming per profiel, intrekken op een ander apparaat, eerste beheerderrol, leesvoortgang, uitloggen en expliciet verwijderen/herstellen. Een login herstelt een geblokkeerd account nooit. Bewaar geen OTP, echte persoonsgegevens of sessietokens in testuitvoer.

De domeinen wezen bij de eerdere controle naar `204.168.128.28`, hetzelfde publieke adres als op de doelhost. Verifieer DNS opnieuw vóór routing; een Tailscale-adres is geen publiek DNS-doel. Valideer de eigen Caddy-snippet samen met de bestaande configuratie vóór installatie/reload, behoud bestaande sites en vergelijk hun health vóór en na. Controleer TLS, publieke `/api/health` en de volledige gebruikersflow via HTTPS. Een `.caddy.disabled` is geen actieve route.

**Productiegate:** ontbrekende projectfeiten over hosting, support, maximale back-uprotatie en internationale toegang/doorgifte blijven een blokkade voor productie-openstelling van online kinderdata. Werk de privacyversie en DPIA hiermee af vóór die verwerking; geen huidige versie overschrijven nadat iemand haar heeft aanvaard. Zie [PRIVACY-DATASTROMEN.md](PRIVACY-DATASTROMEN.md), [PRIVACY-DPIA-2026-11-22.md](PRIVACY-DPIA-2026-11-22.md) en [STAGING-PRODUCTION-STATUS.md](STAGING-PRODUCTION-STATUS.md). De lokale gratis leesroute en voorbereide kandidaten staan los van die productie-openstelling. Er is geen actieve betaalroute.

## Rollback en eerste-installatiefout

Bepaal op de VPS de werkelijke vorige gezonde SHA uit `/srv/sites/<site>/previous/manifest.json`. Gebruik die eerdere SHA en dezelfde omgeving:

```bash
set -euo pipefail
PREVIOUS_SHA=VOLLEDIGE_SHA_VAN_VORIGE_GEZONDE_RELEASE
gh workflow run "fabelpad-dg-vps-08-$DEPLOY_ENV-rollback.yml" \
  --repo fabelpad/platform --ref main -f release_sha="$PREVIOUS_SHA"
gh run list --repo fabelpad/platform \
  --workflow "fabelpad-dg-vps-08-$DEPLOY_ENV-rollback.yml" --limit 5
gh run watch ROLLBACK_RUN_ID --repo fabelpad/platform --exit-status
```

Rollback herstelt app én de bijbehorende runtimeconfiguratie onder hetzelfde doelgebonden activatielock, met hercontrole van CI en health. Zonder vorige gezonde release stopt een mislukte eerste installatie alleen de eigen app en verwijdert de eigen `current`-verwijzing. Er bestaat nu nog geen vorige gezonde release; geen live rollbacktest is geclaimd.

Een approllback draait geen database-, Vault-, SMTP- of templateswijzigingen terug. Houd migraties compatibel en leg back-up, herstel en heruitvoering van verwijdertombstones afzonderlijk vast. Herstel nooit verwijderde accounts door een oude databasekopie opnieuw voor gebruikers open te stellen. De actuele testuitkomsten en uitgevoerde hostwijzigingen worden bij de feitelijke release als nieuw bewijs toegevoegd; historische bewijsbestanden blijven intact.


Actuele hostaanvulling (22 november 2026, na bovenstaande controles): de twaalf root-owned adapters zijn voor beide doelen bijgewerkt; beide eigen runnerservices zijn gestart en de repository-API meldt runners **21** en **22** als **online**. Het v2-configuratiebewijs staat voor beide doelen in de eigen `email-readiness.json`, `root:root 0600`, met providercontroletijd `2026-11-22T17:50:30.645511+00:00`. Dit is geen interactieve OTP-/Google-acceptatie. Er is hiermee geen app of publieke route geactiveerd.
