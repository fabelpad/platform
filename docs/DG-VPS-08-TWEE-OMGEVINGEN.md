# Fabelpad — staging en production op dg-vps-08

Actuele overdracht: **22 november 2026**. De eigenaar heeft uitrol naar beide Fabelpad-omgevingen toegestaan. Dit document beschrijft de bestaande doelidentiteiten, de huidige configuratieroute en de uitvoeringsvolgorde; een opdrachtvoorbeeld is geen uitgevoerde deployment.

**Actuele uitvoering, 22 november 2026:** beide doelen draaien de gecontroleerde SHA `003670aad04ecdf761b21627d8624dea50403ae5` met hun eigen runtimeconfiguratie (`regprof-20261122-stg` en `regprof-20261122-prd`). Staging is bereikbaar op **https://staging.fabelpad.nl**; de publieke productieroute blijft uit. Beide verplichte CI-controles, beide kandidaatbouwen en beide appactiveringen slagen. De gezamenlijke audit bevestigt behoud van de vorige 538-app/configuratie en zes bestaande services. De publieke stagingcontrole slaagt voor 23 HTTP/TLS- en 67 mobiele browsercontroles. Beide Supabase-projecten bevatten elf geverifieerde migraties; registratieverklaringen worden eenmaal bewaard en JSONB-profielantwoorden correct herkend. Zie [status en run-ID’s](STAGING-PRODUCTION-STATUS.md), [het uitrolbewijs](deploy-evidence/registration-release-2026-11-22.json) en [de inhoudelijke validatie](VALIDATIE-REGISTRATIE-PROFIEL-2026-11-22.md). Auth gebruikt de bestaande Supabase Custom SMTP via Resend met volgens de eigenaar zes OTP-cijfers. Nieuwe interactieve OTP-/Google-registratie en de aparte Resend API-bezorging blijven afzonderlijke acceptatiecontroles.

**Historische toestand vóór de eerste kandidaatbouw:** de rechtenaudit van 22 november 2026 om 18:17 UTC bevestigde twaalf correcte root-owned adapters per doel en gescheiden runner-, build- en apprechten. De appservices waren toen inactief, zonder kandidaten, releases of `current`-verwijzingen. Deze momentopname wordt niet als huidige toestand gebruikt.

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
| `/opt/actions-runner/<site>` | Eigen geregistreerde runner; dienst actief en enabled |
| `/opt/dg-toolchains/<site>` | Eigen root-owned Node 24.18.0 / pnpm 11.25.0 |
| `/srv/sites/<site>/{candidates,releases,shared}` | Verzegelde kandidaten, app/config-releases en eigen appschrijfmap |

De applicaties gebruiken afzonderlijke journaldnamespaces met `MaxRetentionSec=29day`, `MaxFileSec=12h`, maximaal 100 MB en zonder syslog-/kernel-/consoleforwarding. Per doel is een eigen root-owned `<site>-log-retention.service` met `.timer` ingericht en enabled/actief: iedere dag om 00:00, 06:00, 12:00 en 18:00 lokale servertijd, maximaal één minuut schedulingmarge, persistent na uitval. De oneshot voert uitsluitend `journalctl --namespace=<site> --rotate --vacuum-time=29days` uit. Een ontbrekende eigen journalmap wordt overgeslagen; de timer start geen app. De marge tot de in de privacytekst genoemde 30 dagen houdt rekening met de periodieke uitvoering en de rotatieperiode van twaalf uur. Dit geldt uitsluitend voor de eigen Fabelpad-applicatielogs; de uitvoering van provider-, back-up- en supportretentie blijft een afzonderlijke operationele controle.

De expliciete rotatie is nodig omdat vacuum alleen gearchiveerde bestanden verwijdert. De namespaceoptie begrenst zowel de rotatieverbinding als de geselecteerde journalbestanden; er wordt geen gedeeld journal opgeschoond. Gecontroleerd op 22 november 2026 tegen [officiële journalctl-documentatie](https://www.freedesktop.org/software/systemd/man/255/journalctl.html) en de op de host gebruikte [systemd 255-bron voor namespaceverbinding en rotatie](https://github.com/systemd/systemd/blob/v255/src/journal/journalctl.c). `scripts/deploy/configure-private-logging.py --self-test` controleert zes guardrailscenario’s; de echte gegenereerde unitparen zijn met `systemd-analyze verify` gevalideerd. Het [releasebewijs](deploy-evidence/google-legal-lifecycle-2026-11-22.json) bevat de uitgevoerde hosttoepassing en helperhash.

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

Controleer via GitHub dat exact dezelfde runnernaam online is in repository `fabelpad/platform`, met de vaste labels. De registratie is al uitgevoerd; voer daarvoor geen nieuwe registratie of tokenaanvraag uit. Beide eigen runnerservices zijn al enabled en actief; de opdracht is alleen nodig wanneer een latere statuscontrole uitwijst dat de eigen runner is gestopt.

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

Alle elf gecommitte migraties zijn in beide Supabase-projecten toegepast en gecontroleerd. De finale alleen-lezen controle bevestigt staging 1 Auth-gebruiker / 1 geldig gezin / 1 aanvaarding en production 0 / 0 / 0; deze wijziging heeft geen echte gebruikersdata geschreven of historische registratieverklaringen ingevuld. De Edge Functions `email-admin` v3, `auth-email` v3 en `account-maintenance` v2 blijven actief. De Auth-hook blijft uit. De eigen minuuttaak `fabelpad-account-maintenance` is behouden en ruimt ook verlopen registratiebewijzen op. De eerdere HMAC-200/lege-werkvoorraadproef blijft historisch bewijs; deze uitrol claimt geen echte mailaflevering of accountverwijdering. Bulkverwijdering na 90 dagen blijft uit totdat stagingrapport, waarschuwingen, overgang en Resend API-servicemail aantoonbaar kloppen. De werkende SMTP-inrichting vervangt die API-koppeling niet. Zie [finale databasecontrole](deploy-evidence/registration-database-final-2026-11-22.json).

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

Test afzonderlijk met synthetische gegevens: e-mailcode van zes cijfers, Google-login, aanvankelijk lege afzonderlijke registratiekeuzes en geen herhaling na verificatie, afzonderlijke toestemming per online profiel, intrekken op een ander apparaat, eerste beheerderrol, leesvoortgang, uitloggen en expliciet verwijderen/herstellen. Een login herstelt een geblokkeerd account nooit. Bewaar geen OTP, echte persoonsgegevens of sessietokens in testuitvoer.

De domeinen wezen bij de eerdere controle naar `204.168.128.28`, hetzelfde publieke adres als op de doelhost. Verifieer DNS opnieuw vóór routing; een Tailscale-adres is geen publiek DNS-doel. Valideer de eigen Caddy-snippet samen met de bestaande configuratie vóór installatie/reload, behoud bestaande sites en vergelijk hun health vóór en na. Controleer TLS, publieke `/api/health` en de volledige gebruikersflow via HTTPS. Een `.caddy.disabled` is geen actieve route.

**Productiegate:** supportleverancier, supporttermijn, maximale back-upbewaring en verwerkers-/doorgifteafspraken zijn door de eigenaar bevestigd en verwerkt in privacyversie `2026-11-22.1`. Vraag die feiten niet opnieuw. Rond de staging-aanmeld-/beheer-/mailacceptatie af vóór de publieke productieroute wordt vrijgegeven. Vervolledig vóór online verwerking van echte kindgegevens het toepasselijke hosting-/landenregister en providerlogcriteria en beoordeel de uitvoering in de DPIA. Herstelverkeer uit back-ups vereist daarnaast volledig actueel wis-/intrekkingsbewijs; weiger ongedekte herstelpunten. Zie [PRIVACY-DATASTROMEN.md](PRIVACY-DATASTROMEN.md), [PRIVACY-DPIA-2026-11-22.md](PRIVACY-DPIA-2026-11-22.md) en [STAGING-PRODUCTION-STATUS.md](STAGING-PRODUCTION-STATUS.md). Er is geen actieve betaalroute.

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

Rollback herstelt app én de bijbehorende runtimeconfiguratie onder hetzelfde doelgebonden activatielock, met hercontrole van CI en health. De huidige vorige procesgezonde combinatie is in beide doelen SHA `538c6b719e372f4dca99cfa2bc824cbf6310f5c1`: stagingkandidaat `538c6b719e372f4dca99cfa2bc824cbf6310f5c1-45061896274-1` met `privacy180-20261122-stg`, productiekandidaat `538c6b719e372f4dca99cfa2bc824cbf6310f5c1-45062081153-1` met `privacy180-20261122-prd`. Vul alleen bij een echte herstelopdracht die volledige SHA in als `PREVIOUS_SHA`. Er is geen live rollback uitgevoerd. Deze vorige versie kent dezelfde privacy.1 en voorwaarden, maar brengt ook het oude dubbele registratie-/JSONB-profielgedrag terug. Controleer daarom de volledige gebruikersflow vóór terugkeer; een health 200 bewijst die niet. De nieuwe SQL-migratie is additief en wordt bij approllback behouden. Zonder vorige gezonde release stopt een mislukte eerste installatie alleen de eigen app en verwijdert de eigen `current`-verwijzing.

Een approllback draait geen database-, Vault-, SMTP- of templateswijzigingen terug. Houd migraties compatibel en leg back-up, herstel en heruitvoering van verwijdertombstones afzonderlijk vast. Herstel nooit verwijderde accounts door een oude databasekopie opnieuw voor gebruikers open te stellen. De actuele testuitkomsten en uitgevoerde hostwijzigingen worden bij de feitelijke release als nieuw bewijs toegevoegd; historische bewijsbestanden blijven intact.


## HTTPS: staging actief, productie later activeren

De gecontroleerde bestanden staan buiten de actieve Caddy-import:

- `/etc/dg-webservices/fabelpad-vps08-staging/prepared/fabelpad-vps08-staging.caddy.ready` → `staging.fabelpad.nl`, loopback 4188.
- `/etc/dg-webservices/fabelpad-vps08-production/prepared/fabelpad-vps08-production.caddy.ready` → `fabelpad.nl`, loopback 4189.

Staging is op 22 november 2026 gecontroleerd toegevoegd als `/etc/caddy/sites/fabelpad-vps08-staging.caddy` en Caddy is herladen. Het certificaat is uitgegeven en strikt gecontroleerd. De actieve stagingroute heeft tevens `X-Robots-Tag: noindex, nofollow, noarchive`. De productiesnippet is niet geïnstalleerd en productie is niet publiek geactiveerd. DNS is niet gewijzigd; de staging-A-verwijzing is opnieuw gecontroleerd tegen `204.168.128.28`. Het gedeelde Caddyfile en de bestaande standaard-HTTP-antwoorden bleven gelijk.

De eigen actieve en voorbereide snippets gebruiken `header >Referrer-Policy "no-referrer"`, zodat de header na de upstreamresponse wordt gezet. Zonder `>` kon Next.js de waarde overschrijven. Beide voorbereide validatiebestanden zijn ververst met de huidige andere routes en opnieuw gecontroleerd. Zie [Caddy header/defer](https://caddyserver.com/docs/caddyfile/directives/header), gecontroleerd 22 november 2026, en [het correctiebewijs](deploy-evidence/privacy180-proxy-header-fix-2026-11-22.json). De eerste mislukte headerassertie blijft als historische momentopname bewaard; de eindcontrole slaagt voor alle 23 HTTP/TLS-controles.

**De onderstaande publieke activering is nog uitsluitend voor productie nodig en wordt hier niet uitgevoerd.** Rond eerst de echte staging-aanmeld-/beheer-/mailproef af. Geef daarna de productieroute gecontroleerd vrij en voer daar de eigen eerste beheerder-/mail-/authacceptatie uit vóór algemene ingebruikname of online verwerking van echte kindgegevens. Een optionele API-bootstrap via eigen Edge Secrets kan vooraf, zonder publieke app. Deze opdrachten horen op de geverifieerde doelhost; zij publiceren productie. Controleer vóór uitvoering opnieuw de actuele DNS, exact-SHA-health en samengestelde proxyconfiguratie:

```bash
set -euo pipefail
DEPLOY_ENV=production
case "$DEPLOY_ENV" in staging) APP_PORT=4188; PUBLIC_ORIGIN=https://staging.fabelpad.nl ;; production) APP_PORT=4189; PUBLIC_ORIGIN=https://fabelpad.nl ;; *) exit 64 ;; esac
SITE="fabelpad-vps08-$DEPLOY_ENV"
READY="/etc/dg-webservices/$SITE/prepared/$SITE.caddy.ready"
DEST="/etc/caddy/sites/$SITE.caddy"
sudo test -f "$READY"
sudo test ! -e "$DEST"
sudo systemd-analyze verify "/etc/systemd/system/$SITE.service"
curl --fail --silent --show-error "http://127.0.0.1:$APP_PORT/api/health"
# Controleer omgeving en exact vrijgegeven SHA in deze healthresponse.
# Controleer DNS opnieuw vóór onderstaande publieke wijziging.
sudo caddy validate --config "/etc/dg-webservices/$SITE/prepared/validation.Caddyfile" --adapter caddyfile
sudo install -o root -g root -m 0644 "$READY" "$DEST"
if ! sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  sudo rm -- "$DEST"
  exit 1
fi
sudo systemctl reload caddy
curl --fail --silent --show-error --retry 5 --retry-delay 3 "$PUBLIC_ORIGIN/api/health"
curl --fail --silent --show-error "$PUBLIC_ORIGIN/api/auth/session"
```

Controleer daarna geldig HTTPS, Google/zes-cijferige OTP, de openbare juridische routes en eerste echte ouder-/beheerderonboarding op de publieke origin. Vergelijk de bestaande sites en gedeelde services met de toestand vóór deze eigen routingwijziging. Bij een fout in de eerste publieke routing verwijder je uitsluitend het zojuist toegevoegde eigen `$DEST`, valideer je `/etc/caddy/Caddyfile` opnieuw en herlaad je Caddy. Bewaar de gezonde eigen loopbackrelease voor onderzoek; wijzig geen andere proxysnippet. Een first-install-fout heeft nog geen vorige apprelease om naar terug te rollen.
