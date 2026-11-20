# Fabelpad — benodigde inrichting en gegevens

Bijgewerkt: **20 november 2026**. De huidige opdracht bereidt een nieuw stagingdoel op `dg-vps-08` voor. De eigenaar koppelt deze workspace en Supabase later en vult de resterende gegevens in. Een eerste activatie, een verhuizing en publieke ingebruikname vereisen een aparte opdracht.

## Alleen deze vier GitHub-variabelen

Ga later naar **fabelpad/platform → Settings → Secrets and variables → Actions → Variables**. Gebruik uitsluitend onderstaande namen voor de webdeploy. Er worden nu geen bestaande GitHub-variabelen, environments of secrets gewijzigd.

| Naam | Waarde komt uit | Gebruik en wijzigingsgevolg |
| --- | --- | --- |
| `FABELPAD_APP_ORIGIN` | Door eigenaar bevestigde canonieke origin van het nieuwe doel | Publiek; build en runtime moeten dezelfde origin hebben. Geen domein afleiden uit de VPS-naam. |
| `FABELPAD_DATA_MODE` | Expliciete keuze: `local` of `supabase` | Publiek; `local` vereist beide Supabase-waarden leeg en gebruikt geen externe accounts/data. `supabase` vereist de volgende twee waarden en afzonderlijke backendacceptatie. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase **Connect** van het bedoelde Fabelpad-project | Publiek, buildtijd; HTTPS-projectorigin zonder credentials. Verandering vereist nieuwe build. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | De publishable key van precies datzelfde project | Publiek, buildtijd; `sb_publishable_…`. Geen secret-, service-role- of databasekey. RLS begrenst gegevensrechten. |

De validator accepteert uitsluitend deze spellingen. De oude naam `APP_URL` is vervallen; neem een bestaande eigen lokale waarde bewust over naar `FABELPAD_APP_ORIGIN` en verwijder alleen die vervallen naam uit het eigen lokale bestand. Behoud overige gebruikerswijzigingen. Gebruik voor een latere echte Supabase-build geen testproject of credentials van een bestaande omgeving als tijdelijke invulling.

Deze variabelen zijn geen secrets. Zet alleen publieke waarden in deze velden. Andere configuratie staat hieronder beschreven; daarvoor zijn geen aanvullende GitHub-variabelen nodig. Deze webopdracht configureert of activeert de bestaande Android/Play-route niet.

## Hostmetadata, build en runtime

| Gegeven | Bron / opslag | Wie mag erbij |
| --- | --- | --- |
| Repository, integratiebranch, doel-ID, hostfingerprint, users, paden, loopbackpoort, runtimepaden, vereiste CI | Beoordeeld projectspecifiek hostprofiel en root-owned hostconfiguratie | Lezen waar nodig; runner/build/app kunnen privileged configuratie niet aanpassen |
| Volledige release-SHA, workflowrun, poging, kandidaat-ID | Door workflow en adapter gegenereerd | Niet-geheime releasegegevens; geen extra GitHub-variabelen |
| Onveranderlijke publieke buildconfiguratie | Eigen configuratie-ID; gecontroleerd snapshot van de vier toegestane waarden | Buildaccount mag uitsluitend deze publieke invoer lezen |
| Runtimeconfiguratie bij dezelfde release | Afgeschermde bron, root-beheerd en alleen eigen app leesbaar | Buildaccount en runner krijgen geen runtimegeheimen |
| `FABELPAD_DEPLOY_ENV`, `FABELPAD_RELEASE_SHA`, `PORT` en interne compatibiliteitsmetadata | Adapter/geverifieerd hostprofiel; geen handmatige GitHub-invoer | Alleen toegestane metadata; gelijktijdig met dezelfde release vastleggen |
| `GITHUB_TOKEN` | Automatisch kortlevend token binnen Actions, alleen bron/CI lezen | Workflow/adapter; nooit in app, artefact of log |

NEXT_PUBLIC-waarden worden tijdens `next build` ingebakken. Een later aangepast runtimebestand wijzigt de browserbundel niet. Build, publieke configuratie en runtimeconfiguratie krijgen één gecontroleerde release-identiteit. De vorige gezonde combinatie blijft beschikbaar voor rollback. Releasegegevens bevatten uitsluitend identificaties en niet-geheime hashes/metadata.

De web-runtime gebruikt gebruikerssessies en RLS/RPC. Er is geen Supabase service-role key, databasewachtwoord, Resend-key, uploadkeystore of algemeen SSH/PAT-secret nodig voor `next build` of de normale web-runtime. OAuth-/mailprovidersecrets horen uitsluitend bij de bedoelde Supabase-provider of bestaande gateway/worker, nadat hun contract is bevestigd.

## Wat de eigenaar later nog levert

| Stap | Wat staat klaar | Concreet nog nodig |
| --- | --- | --- |
| Nieuw doel / hostvoorbereiding | Gescheiden releasecontract en hostvalidatie; feitelijke toevoegingen staan in het [doelverslag](DG-VPS-08-VOORBEREIDING.md) | Alleen de daar genoemde ontbrekende toegang; geen rechten van andere projectaccounts overnemen |
| Nieuwe staging-origin | Validator, release-/configuratiebinding, voorbereide proxyroute | Bevestigde HTTPS-origin en later de juiste DNS-/hostingbevoegdheid |
| Gegevensmodus | Fail-closed selectie tussen lokale werking en echte backend | Eigenaar bevestigt de bedoelde modus; geen impliciete fallback van Supabase naar lokale accounts |
| Supabase | Bestaande migratiebestanden en lokale PostgreSQL/RLS/RPC-tests | Workspacekoppeling, nieuw project/ref/regio, beide publieke waarden en bestaande migratiehistorie |
| Runner | Eigen account/pad/labels, pakket/unit en niet-activerende route voor zover uitgevoerd | Organisatiebeheer voor runnergroepen; huidige API-toegang geeft 403/mist `admin:org`. Eigen groep met alleen deze repo én geselecteerde main-workflows eerst bewijzen, dan pas registreren/starten. |
| GitHub-omgeving | Afzonderlijke handmatige workflow en environmentcontrole | Organisatie `fabelpad` gebruikt Free; private environments/branchbeleid vereisen minimaal Team of Enterprise. Daarna nieuwe doel-environment met uitsluitend main; reviewers zijn optioneel. Geen betaling of bestaande wijziging uitgevoerd. |
| Backendmigratie | Procedure en compatibiliteitsgate | Afzonderlijke autorisatie, versleutelde backup, sleutelbeheer, retentie en aantoonbare hersteltest op geïsoleerde data |
| Auth en mail, indien gebruikt | Servergrens en lokale contracttests | Veilige testaccounts, exacte callbacks, bevestigde providerinstellingen en DG-mailgateway-/outboxcontract |
| Publieke activatie | Systemd-/proxyvoorbereiding en health-/herstelvolgorde | Aparte eerste-releaseopdracht, bevestigd publiek adres/DNS/TLS en readinessacceptatie |

Controleer na de aangekondigde Supabase-GitHubkoppeling eerst welke repository/branch is gekoppeld en of push/merge automatisch schema, Edge Functions of configuratie uitrolt. Een koppeling is geen toestemming om een bestaande database te wijzigen. De officiële [Supabase-branchingdocumentatie](https://supabase.com/docs/guides/deployment/branching) beschrijft automatische deployments; gecontroleerd op 20 november 2026. De [publieke-keydocumentatie](https://supabase.com/docs/guides/getting-started/api-keys) bevestigt dat publishable keys voor clients zijn en gegevensbeveiliging RLS vereist.

## Migraties en providergeheimen

Migraties zijn geen onderdeel van kandidaatbouw of appactivatie. Leg vóór een aparte migratie het juiste Supabase-project, de actuele migratiehistorie en alle betrokken versies vast. Maak een versleutelde backup en verifieer herstel op een geïsoleerd doel. Beoordeel compatibiliteit met actieve/vorige webreleases en de lokale native app. Gebruik eerst uitbreidende wijzigingen; een approllback herstelt geen database, Auth-provider, Edge Function of outbox.

Bewaar databasebeheer, OAuth-clientsecret, Auth-mailhooksecret, Resend-/gateway-/worker-/webhooksecrets uitsluitend in hun projectspecifieke afgeschermde bron. De precieze namen worden pas toegevoegd wanneer de bestaande dienst en het contract geverifieerd zijn. Geen fictieve envnamen of werkende secrets in voorbeelden, commits, buildlogs of procesargumenten.

## Android blijft de bevestigde lokale productie-app

`nl.fabelpad.app` 1.0.0 (1) is gebouwd en gesigneerd. Supabase, betaalproducten en accounts zijn geen voorwaarde voor deze eerste native release. Ondertekening en Play-onboarding staan in het [Play-runbook](GOOGLE-PLAY-RELEASE-RUNBOOK.md); het bestaande uploadbestand en certificaat zijn gedocumenteerd in [ANDROID-PRODUCTIE-VALIDATIE.md](ANDROID-PRODUCTIE-VALIDATIE.md). Publieke privacyhosting, echte Store-beelden, apparaatacceptatie en Play-account-/beleidstaken blijven afzonderlijke acceptatiepunten. De nieuwe webhostvoorbereiding publiceert geen Android-versie en verplaatst geen signingmateriaal.
