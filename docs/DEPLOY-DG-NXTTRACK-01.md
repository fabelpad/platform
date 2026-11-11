# Fabelpad: voorbereiding dg-nxttrack-01

Opdracht van 11 november 2026: deployment voorbereiden, zonder eerste activatie,
verplaatsing of publieke ingebruikname. Deze pagina vervangt voor dit doel de
oudere infrastructuurplaceholders in het lokale runbook. Productie is niet ingericht.
Het validatierapport staat in [DEPLOY-VALIDATIE.md](DEPLOY-VALIDATIE.md).

## Vastgesteld en gekozen

| Onderdeel | Waarde en bron |
| --- | --- |
| Repository / integratiebranch | https://github.com/fabelpad/platform.git / main; geverifieerde origin en GitHub API |
| Voorbereidingsbranch | prep/dg-nxttrack-01-staging-20261111; eigen reviewbranch, geen merge naar main |
| Doelomgeving | staging; standaard voor een nieuwe testopstelling volgens deze opdracht |
| Doelhost | dg-nxttrack-01; hostname, machine-id en bekende SSH-hostsleutel gecontroleerd |
| Machine-id | dff5b148cd5045c2977bbe887f89551d |
| ED25519-hostsleutel | SHA256:rPmgt1Uvwb5/mSibtVL6mbomRuP9uxdGG0MIvYlUKTc |
| Beheeradres | 100.111.66.17 via Tailscale; geen publiek DNS-doel |
| Nieuwe doelidentiteit | fabelpad-nxttrack-staging |
| Eigen accounts | run-fab-nxt-stg, build-fab-nxt-stg, app-fab-nxt-stg; alle drie vrij bij inventarisatie |
| Appservice | fabelpad-nxttrack-staging.service |
| Loopbackpoort | 127.0.0.1:4176; bind-en-sluitcontrole geslaagd, opnieuw controleren vóór installatie |
| Runnerlabels | self-hosted, Linux, X64, dg-nxttrack-01, fabelpad-nxttrack-staging |
| Activatie-environment | fabelpad-nxttrack-staging; bestaat nog niet, niet automatisch aanmaken |
| Runtime | Node 24.18.0, pnpm 11.25.0, Next.js 16.3.4; bronpins en doeltoolchain gecontroleerd |
| Verplichte CI | .github/workflows/verify.yml, workflow-ID 407614165, job verify op de volledige SHA |
| Publiek domein / Supabase-project | Niet vastgesteld; geen waarden van andere projecten overnemen |

Op de host bestaat al een oudere Fabelpad-skeletinrichting met de identiteit
fabelpad-staging en de accounts run-fab-stg/app-fab-stg. Ook die blijft volledig
ongemoeid. Daarom gebruikt deze voorbereiding een aantoonbaar vrije eigen naam.

De bestaande dg-site-deploy op de host is versie 1, vast gekoppeld aan Milo en
combineert bouwen met activeren. Die interface kan deze opdracht niet uitvoeren
zonder een bestaande omgeving te raken. De afzonderlijke Fabelpad-adapter onder
scripts/deploy volgt dezelfde releasevolgorde, met een aparte bouw- en activatieroute.
Er wordt niets in de bestaande wrapper gewijzigd.

## Wat wordt waar voorbereid

| Pad | Contract |
| --- | --- |
| /usr/local/libexec/fabelpad-nxttrack-staging | Beoordeelde root-owned adapter; runner/build/app kunnen code niet wijzigen |
| /etc/dg-webservices/fabelpad-nxttrack-staging/host.json | Niet-geheime hostmetadata, root-owned; UID/GID na eigen accountaanmaak |
| /etc/dg-webservices/fabelpad-nxttrack-staging/build-configs/CONFIG_ID.env | Onveranderlijke publieke buildconfiguratie, root:build 0640 |
| /etc/dg-webservices/fabelpad-nxttrack-staging/runtime-configs/CONFIG_ID/SHA.env | Bijbehorende runtimeconfiguratie, root:app 0640; buildaccount heeft geen toegang |
| /etc/dg-webservices/fabelpad-nxttrack-staging/prepared | Runnerunit en uitgeschakelde proxysnippet; buiten actieve Caddy-import |
| /var/lib/dg-build/fabelpad-nxttrack-staging | Alleen eigen buildwerk, cache en home; geen toegang tot runtimeconfiguratie |
| /opt/actions-runner/fabelpad-nxttrack-staging | Afzonderlijke runner; registratie pas na bewezen workflowbeperking |
| /srv/sites/fabelpad-nxttrack-staging/candidates | Root verzegelt artefact en manifest na build en hercontrole |
| /srv/sites/fabelpad-nxttrack-staging/releases | Onveranderlijke combinatie van artefact, runtime.env en manifest |
| /srv/sites/fabelpad-nxttrack-staging/current en previous | Alleen de latere activatie/rollback wijzigt eigen verwijzingen |
| /srv/sites/fabelpad-nxttrack-staging/shared | Enige app-schrijfmap; releases en adapter blijven buiten app-schrijfrecht |
| /run/lock/dg-build.lock | Bestaande root:dg-build 0660 flock; niet vervangen, chmodden of verwijderen |

De installer controleert hostidentiteit, toolchain, vrije doelnaam en poort,
sudoers-syntax en root-eigendom. Standaard voert hij uitsluitend controles uit.
Bij een botsing weigert hij bestaande middelen te wijzigen. Een gedeeltelijk
mislukte installatie moet door een beheerder worden beoordeeld; opnieuw uitvoeren
is geen impliciete toestemming om bestaande middelen te herstellen of over te nemen.

De eigen installatie is inmiddels uitgevoerd: status prepared-inactive. Ook het
gecontroleerde runnerpakket staat offline klaar. Zie het validatierapport voor
account-ID's, bron-SHA en de geslaagde nameting. Voer de oorspronkelijke installer
niet opnieuw uit over deze inrichting; hij weigert terecht bestaande doelresources.

## Nog benodigde toegang en configuratie

De tijdelijke Dartflow-beheerroute is uitsluitend voor lezen gebruikt. Daarna
heeft de gebruiker het algemene account codex-dg-admin beschikbaar gesteld.
Dat account, de hostidentiteit, SSH-hostsleutel en sudo-policy zijn geverifieerd.
De lokale route staat buiten Git:
ssh -F /home/codex/.ssh/dg-nxttrack-admin.conf dg-nxttrack-01-admin.
Het validatierapport vermeldt welke eigen toevoegingen werkelijk zijn uitgevoerd.
Er worden geen SSH-sleutels of bestaande projectaccounts aangepast.

GitHub heeft nog geen Fabelpad-runners of environments. Registratie vereist:

1. Een eigen organization-runnergroep, alleen toegankelijk voor fabelpad/platform.
2. Beperking tot de twee geselecteerde workflows op refs/heads/main:
   fabelpad-dg-nxttrack-01-staging-candidate.yml en
   fabelpad-dg-nxttrack-01-staging-activate.yml. Labels alleen bieden deze bescherming
   niet. Ook een pull request binnen dezelfde repository mag geen willekeurige
   code op deze runner kunnen uitvoeren.
3. Controleer of het GitHub-abonnement geselecteerde workflows en de benodigde
   environmentbescherming ondersteunt. Organisatie-runnergroepen konden met de
   huidige rechten niet worden ingezien (403); geen scopes automatisch uitbreiden.
   Bij ontbrekende ondersteuning blijft de runner ongeregistreerd.
4. De nieuwe environment fabelpad-nxttrack-staging met vereiste reviewers,
   prevent_self_review en uitsluitend een exacte main-branchpolicy, zonder tags
   of globs. De preflight weigert ontbrekende of onvoldoende bescherming.
5. Download de runner uitsluitend via GitHub Settings → Actions → Runners / de
   gekozen eigen runnergroep, controleer de daar getoonde SHA-256 en registreer
   als run-fab-nxt-stg met de hierboven genoemde eigen labels. Een kortlevend
   registratietoken hoort niet in Git, logs of documentatie. Laat een beheerder de
   eigen runnerunit installeren; laat bestaande runners draaien zoals aangetroffen.

De geselecteerde workflowreferenties zijn exact:

~~~text
fabelpad/platform/.github/workflows/fabelpad-dg-nxttrack-01-staging-candidate.yml@refs/heads/main
fabelpad/platform/.github/workflows/fabelpad-dg-nxttrack-01-staging-activate.yml@refs/heads/main
~~~

Registreer bij de organisatie https://github.com/fabelpad in de geverifieerde eigen
runnergroep die alleen deze repository en workflowreferenties toestaat. Een gewone
repositoryrunner biedt die geselecteerde-workflowgarantie niet.

| Namen / gegevens | Moment en bron | Opslag / gevolg |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Build; apart, bevestigd Fabelpad-stagingproject in Supabase | Publiek buildbestand, ingebakken browserwaarde; nieuwe waarde vereist nieuwe build |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Build; publishable key van datzelfde project | Alleen sb_publishable_; geen secret/service-role key |
| APP_URL | Build én runtime; bevestigd eigen HTTPS-domein | Canonieke origin, gekoppeld aan configuratie-ID |
| FABELPAD_AUTH_EMAIL_ENABLED | Build én runtime; pas true na OTP/mailacceptatie | Expliciet true/false, geen verzonnen providerconfiguratie |
| FABELPAD_AUTH_GOOGLE_ENABLED | Build én runtime; pas true na OAuth/callbackacceptatie | Expliciet true/false |
| FABELPAD_DEPLOY_ENV | Build/runtime door adapter / beheerder | staging |
| FABELPAD_RELEASE_SHA | Build/runtime uit goedgekeurde release | Volledige 40-tekens SHA; nooit HEAD als bewegend releaseargument |
| PORT | Runtime uit geverifieerd hostprofiel | Eigen loopbackpoort 4176 |
| GITHUB_TOKEN | Alleen handmatige workflow, automatisch kortlevend GitHub-token | Lezen van bron/CI/environment; begrensde stdin-JSON naar root, niet naar build/app |
| CONFIG_ID | Beheerder kiest nieuwe onveranderlijke identificatie | Geen geheim; zelfde ID in build en runtime |
| Supabase-projectref, regio, databasebeheer/backup | Alleen aparte migratieprocedure | Geen databasewachtwoord/CLI-token aan next build of web-runtime |
| Google clientsecret, Auth-mailhook, Resend/worker/webhooksecret | Alleen betreffende provider/gateway/worker | Contract en exacte namen nog aan te leveren; geen websecrets verzinnen |

De huidige web-runtime heeft geen privileged Supabase-key, databasewachtwoord of
Resend-key nodig. Er hoeft geen langlevend PAT of algemeen SSH-secret in GitHub
te worden geplaatst. Een beheerder levert de gescheiden configuratiebestanden
via een afgeschermde bron, zonder waarden in procesargumenten of buildlogs.
De parser accepteert alleen de vastgelegde namen en eenvoudige NAME=value-regels.

Gebruik de lege voorbeelden onder deploy/templates. Het runtimebestand herhaalt
alle vijf waarden uit build.env.example exact, inclusief beide NEXT_PUBLIC-namen,
en voegt FABELPAD_DEPLOY_ENV, FABELPAD_RELEASE_SHA en PORT toe. Maak de eigen
CONFIG_ID-submap onder runtime-configs als root:app-fab-nxt-stg 0750; de installer
maakt alleen de bovenliggende configuratiemappen.

## Lokale en latere hostvoorbereiding

Normale lokale controle in een schone afzonderlijke checkout:

~~~bash
pnpm install --frozen-lockfile
bash scripts/local-build.sh
~~~

De reguliere build voert ook de tests van de releasecontracten en installer uit.
Alle backendtests gebruiken lokale synthetische gegevens. Er worden geen externe
databasewijzigingen, mail, Auth-providerwijzigingen of migraties uitgevoerd.
De lokale demo zonder Supabase bewijst geen stagingconfiguratie of echte login.

Gebruik de geverifieerde algemene DG-beheerroute: laat een beheerder de
beoordeelde volledige broncommit in een eigen root-owned tijdelijke werkmap op
de geverifieerde host plaatsen. Gebruik geen runnercheckout als root-bron.
Voer daar eerst onderstaande controles uit, en alleen binnen een opdracht met
bevoegde beheerroute vervolgens de toevoegingen:

~~~bash
sudo /usr/bin/python3 -I scripts/deploy/install-host.py --source-root "$PWD"
sudo /usr/bin/python3 -I scripts/deploy/install-host.py --source-root "$PWD" --apply
~~~

De apply maakt eigen accounts/paden, installeert de adapter met beperkte sudoers
en bereidt de eigen appunit voor. Hij registreert geen runner, start/enabled geen
service, wisselt geen current, herlaadt geen proxy en maakt geen publieke routing.
Controleer vóór/na dezelfde bestaande services, current-verwijzingen, proxyhashes
en bekende health-URL's; onderzoek ieder verschil. Herstel uitsluitend eigen,
aantoonbare wijzigingen.

Leg configuratie buiten de repository vast, root:build respectievelijk root:app
0640 in de bovenstaande paden. Gebruik een nieuwe CONFIG_ID bij iedere wijziging.
De runtimebestandsnaam bevat de volledige SHA; de adapter weigert een combinatie
die afwijkt van de publieke buildconfiguratie, omgeving, SHA of poort.

## Later een kandidaat bouwen

Deze stappen vereisen een aparte vrijgave en daadwerkelijk ingerichte runner en
buildconfiguratie. De nieuwe workflow moet eerst via review naar main; deze
voorbereidingsopdracht voert geen merge uit.

~~~bash
RELEASE_SHA=VOLLEDIGE_GOEDGEKEURDE_MAIN_SHA
CONFIG_ID=BEVESTIGDE_NIEUWE_CONFIG_ID
git fetch origin main
set +x
GH_TOKEN="$(gh auth token)" node scripts/deploy/verify-release-sha.mjs --sha "$RELEASE_SHA"
gh workflow run fabelpad-dg-nxttrack-01-staging-candidate.yml --repo fabelpad/platform --ref main -f release_sha="$RELEASE_SHA" -f config_id="$CONFIG_ID"
gh run list --repo fabelpad/platform --workflow fabelpad-dg-nxttrack-01-staging-candidate.yml --limit 5
gh run watch RUN_ID --repo fabelpad/platform --exit-status
~~~

Het token wordt hierboven alleen via procesomgeving gegeven, niet afgedrukt of als
argument gebruikt. Buiten Actions gebruikt de bevoegde beheerder een kortlevend
leestoken met contents/actions-read; het automatische GITHUB_TOKEN bestaat alleen
binnen de workflow. De geïnstalleerde root-adapter controleert repository, main-
afstamming, nieuwste voltooide push-CI en de geslaagde verify-job/stappen opnieuw.
Ontbrekende, overgeslagen, lopende, geannuleerde en mislukte checks worden geweigerd.
Er wordt exact de opgegeven SHA gebouwd, nooit de PR-mergecommit of bewegende main.

De kandidaat-ID is SHA-RUN_ID-RUN_ATTEMPT. Het manifest bevat SHA, configuratie-ID
en digest, lockfile-/artefactdigest, CI-run/poging/job, workflowrun en toolchain.
Het bronartefact bevat de normale Next-output (.next/server en .next/static),
public, packagebestanden en eigen node_modules, inclusief interne pnpm-symlinks.
Er is geen standalone-output en geen frameworkwissel. Installatie gebruikt het
gecommitte pnpm-lock.yaml; build is pnpm build, runtime pnpm start / vaste Node Next-CLI.
De buildroute start geen app.

Een lockconflict stopt met een herkenbare melding. Alleen bij een aangetoond
conflict mag na het vrijvallen van hetzelfde lock één begrensde nieuwe poging
worden gestart. Geen lock verwijderen en geen onbeperkte automatische retry.
Bewaar eigen mislukte werkmappen voor onderzoek; retentie/cleanup wordt niet over
bestaande omgevingen heen ingevoerd.

## Latere activatie, HTTPS en acceptatie

Voer onderstaande activerende stappen uitsluitend uit na de aparte opdracht voor
de eerste release; ze zijn in deze voorbereiding niet uitgevoerd.

1. Bevestig domeineigendom, definitieve Fabelpad-origin en publiek doel-IP bij de
   beheerder. Het Tailscale-adres is geen publiek DNS-record. Verifieer A/AAAA en
   bereikbaarheid van 80/443; wijzig geen bestaande DNS-/firewallregels.
2. Rond een eventuele aparte backend-/migratievrijgave en herstelbewijs af.
   Verifieer Auth-origins/callbacks, veilige testaccounts en providerinstellingen.
3. Controleer de eigen root-owned kandidaat en bijbehorende SHA/configuratie.
   Plaats de bijbehorende runtimeconfiguratie uit de afgeschermde bron.
4. Valideer de voorbereide eigen systemd-unit met systemd-analyze verify.
   Een beheerder installeert uitsluitend die unit en voert daemon-reload uit.
   Controleer User, Group, WorkingDirectory, EnvironmentFile en ExecStart.
   Geen app starten vóór de goedgekeurde activatie.
5. Start de activatieworkflow op main en laat de vereiste afzonderlijke reviewer
   goedkeuren:

~~~bash
CANDIDATE_ID=SHA_RUN_ID_POGING_UIT_MANIFEST
gh workflow run fabelpad-dg-nxttrack-01-staging-activate.yml --repo fabelpad/platform --ref main -f release_sha="$RELEASE_SHA" -f candidate_id="$CANDIDATE_ID" -f config_id="$CONFIG_ID"
gh run watch ACTIVATIE_RUN_ID --repo fabelpad/platform --exit-status
~~~

6. De adapter koppelt eigen app en runtimeconfiguratie onder hetzelfde releasepad,
   wisselt current onder het eigen activatielock, herstart alleen de eigen service
   en vereist loopbackhealth met de volledige SHA. Controleer aanvullend:

~~~bash
sudo systemctl status fabelpad-nxttrack-staging.service --no-pager
curl --fail --silent --show-error http://127.0.0.1:4176/api/health
sudo journalctl -u fabelpad-nxttrack-staging.service -n 80 --no-pager
~~~

7. Render de proxysnippet pas met de geverifieerde domeinnaam; de meegeleverde
   placeholder is geen geldige doelconfiguratie. Laat een beheerder uitsluitend
   de nieuwe snippet onder /etc/caddy/sites plaatsen, valideer de volledige
   bestaande Caddyconfiguratie met caddy validate --config /etc/caddy/Caddyfile
   --adapter caddyfile en herlaad Caddy pas na goedkeuring. Controleer alle bekende
   bestaande health-URL's vóór en na deze latere wijziging. Controleer TLS-uitgifte
   en de nieuwe HTTPS-health met dezelfde volledige SHA.
8. Het healthendpoint meldt process-liveness-only. Readiness vereist daarnaast
   echte login/sessieherstel, twee gescheiden ouders/kinderen, RLS bij gemanipuleerde
   kind-ID's, cloud-sync/conflicten, studio-autorisatie en mailgateway/outbox.
   De bestaande browsertests gebruiken deels mocks en vervangen deze acceptatie niet.

## Herstel en migraties

Activering en rollback gebruiken hetzelfde eigen lock. Een vorige release blijft
met zijn runtime.env en healthy-receipt behouden; current en previous worden niet
door buildjobs veranderd. Een fout na de wissel herstelt de vorige gezonde
app/configuratie en herstart die. Bij een mislukte eerste installatie stopt de
adapter alleen de eigen appservice en verwijdert uitsluitend de eigen current.
De mislukte release blijft voor onderzoek; er wordt geen andere omgeving gebruikt.

Deze automatische foutafhandeling geldt voor opgevangen fouten. Bij een afgebroken
workflow, beëindigd proces of hostuitval moet de beheerder eerst current, previous,
manifesten en servicestatus onderzoeken. De supervisor stopt achtergebleven
buildprocessen en houdt het lock vast tijdens opruiming; dat bewijst geen voltooide
approllback. Bij een onderbroken eerste installatie zonder vorige gezonde release:
stop uitsluitend fabelpad-nxttrack-staging.service en verwijder de eigen current
pas na inspectie. Bij een volgende installatie kan de gecontroleerde previous via
het onderstaande rollbackcommando worden hersteld; controleer welke gezonde
combinatie dat precies is. Hervat geen half voltooide release zonder beoordeling.

Een latere expliciete rollback naar previous gebruikt het vaste root-owned
entrypoint. Geef een kortlevend token via stdin; lees het afgeschermd in de shell
en schakel shell tracing uit. Geen token in argumenten of documentatie:
onderstaand beheercommando is voor het geverifieerde algemene beheeraccount;
env -i start de adapter als rechtstreekse rootbeheerder met een schone omgeving.
De runner gebruikt uitsluitend zijn eigen vaste sudoersregel zonder env -i.

~~~bash
set +x
read -rs GH_TOKEN
export GH_TOKEN
/opt/node-v24.18.0-linux-x64/bin/node -e 'process.stdout.write(JSON.stringify({githubToken:process.env.GH_TOKEN}))' | sudo -n /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin /usr/local/libexec/fabelpad-nxttrack-staging/rollback.mjs
unset GH_TOKEN
~~~

Voer daarna dezelfde loopback-/HTTPS-/readinesscontroles uit. Rollback weigert
een ontbrekende of ongeldige previous-combinatie en verandert geen database,
provider of proxy. Ook de terugzet-SHA moet aan het vastgelegde CI-contract voldoen.

Migraties staan bewust buiten deze workflows. Vóór toepassing: leg het juiste
aparte Supabase-project en migratiehistorie vast, maak een versleutelde backup,
controleer herstel op geïsoleerde gegevens en beoordeel compatibiliteit met de
huidige/vorige web- en mobiele versie. Gebruik eerst uitbreidende schemawijzigingen;
destructieve wijzigingen pas na afzonderlijke beoordeling. Er is geen automatisch
veilig down-migratiecommando. Bij incompatibiliteit: appverkeer beheerst stoppen
en het vastgelegde databaseherstelplan laten uitvoeren; geen live reset.
Databaseverbinding, backupdoel, encryptie-/sleutelbeheer, retentie en herstelbewijs
ontbreken nog. Bestaande databases blijven onaangeraakt.

## Concrete open stappen

| Stap | Staat klaar | Ontbreekt |
| --- | --- | --- |
| Eigen hosttoevoegingen | Uitgevoerd en nagemeten; accounts, paden, adapter, beperkte sudoers en inactieve appunit | Geen voor de uitgevoerde voorbereiding; nieuwe waarden blijven ontbreken |
| Runner | Eigen account/paden, geverifieerd offline pakket, unit en labels | Organization-rechten, geselecteerde workflows, registratie |
| Stagingbuildconfiguratie | Parser, naamallowlist, config/SHA-binding | Bevestigde APP_URL en apart Supabase-stagingproject/publishable waarden |
| GitHub releasepad | Twee handmatige workflows en SHA/CI-poort | Review/merge naar main, daarna geslaagde CI op vrijgegeven volledige SHA |
| Activeringsgoedkeuring | Environmentcontrole weigert onbeschermde targets | Nieuwe beschermde environment en afzonderlijke reviewers |
| Kandidaat op doel-VPS | Buildroute, lock, geïsoleerd buildaccount en seal voorbereid | Alle voorgaande bouwvoorwaarden; nog geen doelkandidaat aanwezig |
| Publieke acceptatie | Unit, uitgeschakelde proxytemplate, health-/readinessprocedure | Domein/publiek IP/DNS/TLS en aparte activatieopdracht |
| Database/provideracceptatie | Lokale contracttests en migratiebestanden | Nieuw project, beheer/backup/herstelcontract, echte accounts/providers |

## Bronnen voor het contract

De gecommitte .nvmrc, package.json, pnpm-lock.yaml, verify.yml, next.config.ts en
de Next-documentatie in node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md
bepalen de bouw-/startroute. Doelgegevens komen uit alleen-lezen SSH-inventarisatie.
GitHubcontroles volgen de primaire documentatie voor
[workflowruns](https://docs.github.com/en/rest/actions/workflow-runs),
[workflowjobs](https://docs.github.com/en/rest/actions/workflow-jobs),
[commitvergelijking](https://docs.github.com/en/rest/commits/commits#compare-two-commits)
en [environments](https://docs.github.com/en/rest/deployments/environments#get-an-environment).
