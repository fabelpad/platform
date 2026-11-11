# Afzonderlijke hostvoorbereiding

Deze installatie geldt uitsluitend voor het nieuwe doel
`fabelpad-nxttrack-staging` op de geverifieerde host `dg-nxttrack-01`, machine-ID
`dff5b148cd5045c2977bbe887f89551d`, met loopbackpoort `4176`.
De oudere Fabelpad-inrichting `fabelpad-staging` blijft onaangeraakt.

De afzonderlijke hostvoorbereiding is op **11 november 2026 uitgevoerd** uit
broncommit `ef7c707b7eddbb780e3cb5274268770ff4eb8e71`, na een geslaagde schone lokale
build en alle lokale controles. De nieuwe appservice is **inactief en disabled**;
configuratie, doelkandidaat, `current`, runnerregistratie en publieke routing
ontbreken nog. De onafhankelijke nameting bevestigde dezelfde bestaande
omgevingen en overeenkomende hashes/rechten van alle twaalf adaptermodules.

De tijdelijke Dartflow-beheersleutel is alleen voor inventaris gebruikt. Het
daarna door de gebruiker gereedgezette algemene beheeraccount `codex-dg-admin`
is geverifieerd, inclusief hostidentiteit, bestaande hostkey en sudo-policy,
en gebruikt voor uitsluitend de nieuwe hostinrichting. De lokale
verbindingsconfiguratie staat buiten Git:

```text
ssh -F /home/codex/.ssh/dg-nxttrack-admin.conf dg-nxttrack-01-admin
```

Gebruik die algemene route voor een latere beheeropdracht. Vervang of verruim
geen bestaande SSH-policy en gebruik de tijdelijke toegang van een ander
project niet voor Fabelpad-mutaties.

## Wat de installer voorbereidt

`scripts/deploy/install-host.py` controleert standaard alleen. Ook de controle
vereist root op de juiste host om de private registermetadata betrouwbaar te
inspecteren. Alleen de expliciete optie `--apply` maakt nieuwe resources.

| Onderdeel | Nieuw doel |
| --- | --- |
| Runneraccount | `run-fab-nxt-stg`, UID `979`, GID `973`, uitsluitend eigen groep |
| Buildaccount | `build-fab-nxt-stg`, UID `978`, GID `972`, uitsluitend eigen groep |
| Appaccount | `app-fab-nxt-stg`, UID `977`, GID `971`, uitsluitend eigen groep |
| Appboom | `/srv/sites/fabelpad-nxttrack-staging/{candidates,releases,shared}` |
| Buildboom | `/var/lib/dg-build/fabelpad-nxttrack-staging/{home,work}` |
| Lege runnerdirectory | `/opt/actions-runner/fabelpad-nxttrack-staging` |
| Vertrouwde adapter | `/usr/local/libexec/fabelpad-nxttrack-staging` |
| Profiel/configuratie | `/etc/dg-webservices/fabelpad-nxttrack-staging` |
| Appunit | `fabelpad-nxttrack-staging.service`, geïnstalleerd zonder start, enable of daemon-reload |
| Proxy | Alleen `.caddy.disabled` onder de eigen `prepared`-map; buiten de actieve import |
| Runnerunit | Alleen voorbereid onder de eigen `prepared`-map; niet geïnstalleerd of geregistreerd |

Alle accounts krijgen een `nologin`-shell en geen aanvullende groepen. Alleen de
rootdispatcher gebruikt de bestaande gedeelde buildlock. De installer gebruikt geen bestaande
projectaccounts en weigert als een van de eigen accounts, groepen, directories,
units of sudoersregels al bestaat. Een gedeeltelijke mislukking vraagt inspectie
van uitsluitend de zojuist gemaakte eigen resources; de installer voert geen
automatische opruiming of reparatie uit.

Het aanwezige `/run/lock/dg-build.lock` moet exact een root-owned regulier
bestand `root:dg-build 0660` zijn. De installer wijzigt of vervangt deze lock niet.
De releaseadapter gebruikt dezelfde exclusieve nonblocking `flock`-werking als
de bestaande hostroute. De geïnstalleerde, uitsluitend op Milo gerichte
`/usr/local/bin/dg-site-deploy` blijft ongewijzigd.

## Uitvoering na gecontroleerde beheerstoegang

Controleer de volledige commit en bronbundel voordat die als root wordt
uitgevoerd. Gebruik een afzonderlijke werkmap met de beoordeelde volledige
commit-SHA; de placeholder hieronder is geen shellvariabele of vastgesteld pad.

```text
sudo /usr/bin/python3 -I /BEOORDEELDE-BUNDEL/scripts/deploy/install-host.py --source-root /BEOORDEELDE-BUNDEL
sudo /usr/bin/python3 -I /BEOORDEELDE-BUNDEL/scripts/deploy/install-host.py --source-root /BEOORDEELDE-BUNDEL --apply
```

De eerste opdracht moet zonder afwijkingen slagen. Bij `--apply` controleert de
installer opnieuw vóór iedere voorbereidende reeks: de hostidentiteit, vrije
poort, conflicterende namen, vertrouwde ouders, native Node/pnpm en de bestaande
lock. `visudo -cf /dev/stdin` valideert de drie digest-gepinde, precies begrensde
sudoersregels vóór installatie. `systemd-analyze verify` valideert de eigen
appunit; er volgt geen `systemctl start`, `enable`, `restart` of `daemon-reload`.

De adapter bestaat uit de vaste bestanden uit `MODULES` in de installer.
Alleen `candidate-build.sh`, `activate.mjs` en `rollback.mjs` krijgen een
sudoersregel. Activering accepteert uitsluitend de vaste kandidaat- en
configuratieargumenten; rollback accepteert geen argumenten en gebruikt alleen
het eigen vorige gezonde app/configuratiepaar. `--profile`, shellcommando's en
willekeurige paden zijn niet toegestaan. Kortlevende API-credentials gaan naar
de begrensde JSON-invoer van de adapter, zonder env-behoud of procesargumenten.

## Configuratie blijft nog leeg

Het hostprofiel bevat uitsluitend openbare metadata en krijgt `root:root 0644`.
Code en bovenliggende directories zijn root-owned en niet door runner, build
of app schrijfbaar. Build- en runtimeconfiguratie blijven gescheiden:

```text
build-configs/                         root:build-fab-nxt-stg 0750
  <config-id>.env                      root:build-fab-nxt-stg 0640
runtime-configs/                       root:app-fab-nxt-stg   0750
  <config-id>/                        root:app-fab-nxt-stg   0750
    <volledige-SHA>.env                root:app-fab-nxt-stg   0640
```

De installer maakt alleen de bovenste directories. Er worden geen `.env`-
bestanden, tijdelijke providergegevens of verzonnen waarden geplaatst. De
buildconfiguratie bevat alleen de toegestane publieke waarden. De runtimegroep
geeft het buildaccount geen leesrecht. De latere release koppelt
`current/artifact` en `current/runtime.env` als één versie. De app kan release,
`current`, configuratie en adapter niet aanpassen; alleen de eigen `shared`-map
is schrijfbaar.

## Runner pas na geverifieerde GitHub-beperking

De installer downloadt of registreert geen runner en start geen runnerunit.
Vóór registratie is bewijs nodig dat de runner alleen door deze repository en
de twee beoordeelde handmatige workflows gebruikt kan worden. Gebruik daarvoor
een runnergroep met een passende, aantoonbaar afgedwongen selectie van
workflows. Alleen unieke labels beperken onbeoordeelde PR-workflows niet.
Ontbreekt die GitHub-functie of het benodigde beheerrecht, dan blijft registratie
geblokkeerd; gebruik geen brede repositoryrunner als vervanging.

De officiële GitHub-release-API bevestigde op 11 november 2026 de stabiele
uitgave [v2.338.2](https://github.com/actions/runner/releases/tag/v2.338.2),
gepubliceerd op 26 oktober 2026. Het Linux x64-asset
`actions-runner-linux-x64-2.338.2.tar.gz` heeft asset-ID `678460500`, omvang
`228071396` bytes en de door de API geleverde digest:

```text
sha256:baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40
```

Bron: de [officiële release-API](https://api.github.com/repos/actions/runner/releases/424372770).
Dit pakket is inmiddels uitsluitend als `run-fab-nxt-stg` in de eigen nieuwe
runnerdirectory geplaatst en uitgepakt. De onafhankelijke nameting op
11 november 2026, **10:41 CET**, heeft de werkelijke archiefdigest, omvang en
eigendom van alle pakketbestanden bevestigd. De registratie- en credentialfiles
ontbreken; er is geen runnerunit geïnstalleerd en er draait geen proces onder
de nieuwe runneridentiteit. De GitHub-repository meldde bij de laatste
alleen-lezen controle nul runners. Er zijn geen algemene
dependency-installaties uitgevoerd.

Na verificatie van de GitHub-beperking gebruikt een beheerder het gecontroleerde
Linux x64-pakket via de officiële `actions/runner`-release/GitHub-setup.
Controleer het bestand buiten bestaande runnerdirectories, pak het uitsluitend
als `run-fab-nxt-stg` uit in de nieuwe runnerdirectory en gebruik de interactieve
`config.sh`-wizard. Geef registratiecredentials via de prompt; zet ze niet in
commandoregels, documentatie, logs of bestanden in de repository.

Voorgestelde registratiegegevens, pas na bevestiging van die beperking:

```text
Organization: https://github.com/fabelpad
Runner group: NOG TE VERIFIËREN eigen groep met repository- en selected-workflowbeperking
Runner: dg-nxttrack-01-fabelpad-nxttrack-staging
Custom labels: dg-nxttrack-01,fabelpad-nxttrack-staging
Workfolder: _work
```

De voorbereide runnerunit mag pas daarna worden beoordeeld en apart
geïnstalleerd. Controleer vóór een latere testopdracht de daadwerkelijke
repository, workflowbron, runnernaam, host en gebruikersidentiteit. De huidige
voorbereiding bewijst geen geregistreerde, online of beperkte runner.

## Proxy blijft uitgeschakeld

`fabelpad-nxttrack-staging.caddy.disabled` bevat een oningevulde domeinmarker.
`render_proxy()` in de installer weigert ontbrekende waarden, URL's, wildcards
en ingevoegde Caddyconfiguratie. De functie valideert het formaat; de beheerder
moet apart eigendom, bedoelde bestemming en DNS bevestigen. De voorbereiding
roept de renderer niet aan en schrijft niets onder `/etc/caddy/sites`.

Een latere afzonderlijke activatieopdracht moet eerst het gezonde app- en
configuratiepaar opleveren en daarna de volledige Caddyconfiguratie valideren,
de geverifieerde DNS/TLS-volgorde volgen en HTTPS/health/readiness controleren.
Er is nu geen nieuw Fabelpad-domein vastgesteld of gepubliceerd.

De betekenisvolle installercontroles draaien lokaal met een volledig nagebootst
bestandssysteem en accountregister:

```bash
python3 scripts/deploy/install-host.test.py
```

Deze tests creëren geen Linux-gebruikers en passen geen echte hostbestanden aan.
