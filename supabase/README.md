# Fabelpad — Supabase, beheerrechten en mail

Actueel [samenvattend releasebewijs](../docs/deploy-evidence/privacy180-release-2026-11-22.json): beide CI-runs, beide kandidaatbouwen, beide activeringen en alleen staging-HTTPS.

Gecontroleerd op **22 november 2026**. Dit document betreft uitsluitend de twee onderstaande Fabelpad-projecten. De oorspronkelijke inrichting begon met lege projecten; de actuele toestand omvat tien toegepaste migraties, dertien bronverhalen, de mailbeheerfuncties en de ouder-/privacylevenscyclus. Bij de laatste livecontrole waren er **nul Auth-gebruikers, beheerders, gezinnen en Resend API-mailconfiguraties**. Een ingerichte database of Edge Function is geen actieve webrelease.

| Omgeving | Workspace-account | Project / regio | App-origin |
| --- | --- | --- | --- |
| staging | **fabelpad** | `tlwfpivafcokcjyjwgmq` / eu-west-1 | `https://staging.fabelpad.nl` |
| production | **Duindorpdoet** | `aptprpkosqctwrzeetgs` / eu-west-1 | `https://fabelpad.nl` |

De bestaande GitHub environments `staging` en `production` gebruiken uitsluitend **`FABELPAD_APP_ORIGIN`**, **`FABELPAD_DATA_MODE`**, **`NEXT_PUBLIC_SUPABASE_URL`** en **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**. De webserver werkt met publieke projectconfiguratie en de echte gebruikerssessie; hij heeft geen service-role key nodig. Geheimen voor Edge-/servicetaken blijven bij de eigen provider en in het eigen Vault. Zie [INRICHTING.md](../docs/INRICHTING.md) en de [actuele status](../docs/STAGING-PRODUCTION-STATUS.md).

## Toegepaste migraties

| Migratie | Contract | Beide projecten |
| --- | --- | --- |
| `20261104095714_family_content_contract.sql` | Eigen gezinsdocumenten, CAS-revisies, expliciete beheerders, contentconcepten en onveranderlijke verhaalreleases | Toegepast |
| `20261122140451_verified_bootstrap_admin.sql` | Bevestigde bootstrapmailbox en beperkte uitvoerrechten | Toegepast |
| `20261122150754_admin_email_settings.sql` | Afgeschermde mailinstellingen, Vault, testbewijzen en revisiecontrole | Toegepast |
| `20261122172905_parent_account_lifecycle.sql` | Volwassen ouderonboarding, documentversies, afzonderlijke profieltoestemming, activiteit, verwijdering, AVG-register en duurzame outbox | Toegepast |
| `20261122174433_lifecycle_worker_schedule.sql` | Eigen afgeschermde schedulerinrichting | Toegepast |
| `20261122175306_signed_lifecycle_worker_requests.sql` | Projectgebonden HMAC met eenmalige nonce voor onderhoudsaanvragen | Toegepast |
| `20261122175654_private_pg_net_extension.sql` | `pg_net` in het bedoelde providerschema `extensions` | Toegepast |
| `20261122182638_account_deletion_deadline_preview.sql` | Alleen-lezen verwijderdatum vóór bevestiging en atomische controle van de bevestigde minuut | Toegepast |
| `20261122190748_backup_erasure_evidence_retention.sql` | Vaste 210-dagenretentie van minimale ouder-/kindwisbewijzen, geen afhankelijke Auth-FK voor kindbewijs | Toegepast |
| `20261122190924_privacy_backup_support_update.sql` | Additieve privacyversie 2026-11-22.1; historische bytes en aanvaardingen behouden | Toegepast |

Alle tien opgesomde migratieversies komen overeen met de gecontroleerde historie van beide projecten. De twee nieuwste migraties zijn eerst op staging toegepast en geverifieerd en daarna op production; het [livebewijs](../docs/deploy-evidence/privacy180-supabase-live-2026-11-22.json) is afgerond om 19:37:06 UTC. Bij door de beheertool toegekende uitvoeringstijdstempels is uitsluitend de versie-administratie gelijkgetrokken **na vergelijking van de volledige opgeslagen SQL-SHA-256**; statements en inhoud zijn behouden. De oudere lifecycle-/scheduler-/previewhashes en controles staan in [google-legal-lifecycle-2026-11-22.json](../docs/deploy-evidence/google-legal-lifecycle-2026-11-22.json). De previewmigratie heeft SHA-256 `465155f8d009f0ddddd8eda0dfe356b903862c47739b1e7c08628d0c3a32b9cc`.

Voer reeds toegepaste migraties niet opnieuw uit met een ongecontroleerde `db push`. Controleer altijd expliciet het bedoelde hosted project, de bestaande historie en de geplande nieuwe SQL. [Officieel migratiecontract](https://supabase.com/docs/guides/deployment/database-migrations). De eerder gebruikte Supabase CLI **3.2.0** is een beheertool en geen runtimevoorwaarde; selecteer bij CLI-gebruik een hosted doel expliciet.

## Database- en rechtencontract

- `family_documents`: ouder-UUID als eigenaar; RLS op de eigen rij en gevalideerde CAS-RPC voor wijzigingen. Toegang vereist daarnaast een echte huidige sessie, actuele ouderonboarding en een actief account. Andere gezinnen en anonieme sessies krijgen geen toegang.
- `content_admins`: alleen de eigen rol lezen, geen client-write. Beheerrechten komen uit de database en worden servermatig gecontroleerd; usermetadata is geen autorisatiebron.
- `content_drafts`: beperkte beheerdertoegang, revisiecontrole en gevalideerde wijzigings-/publicatie-RPC’s.
- `content_releases`: publiek leesbaar, versiehash en onveranderlijkheid. Publicatie behoudt eerdere verhaalversies; accountverwijdering verwijdert geen publieke verhaalrelease.
- Private mail-, ouder-, toestemmings-, activiteit-, AVG-, outbox- en schedulergegevens: directe applicatietoegang geweigerd. Alleen de bedoelde beperkte functies mogen deze gegevens lezen of wijzigen. Service-only taken krijgen geen algemene browser- of Next-serverrechten.
- Juridische versies: voorwaarden en getoonde privacyversie worden met vaste documenthashes geregistreerd. Een toekomstige documentwijziging vereist een bewuste nieuwe versie; reeds aanvaarde tekst wordt niet stilzwijgend overschreven.

RLS en functiegrants zijn gecontroleerd. De security advisors melden momenteel **0 WARN, 0 ERROR en 14 INFO**. De INFO-meldingen betreffen private tabellen waarvan directe toegang bewust is geweigerd en alleen gecontroleerde functies de route vormen. Dit zijn geen nul meldingen en geen algemene compliancecertificering. Publieke catalogusdata blijft leesbaar; afgeschermde gezins-, rol-, concept- en lifecycledata is niet anoniem toegankelijk.

De **13 bestaande bronverhalen** zijn per project als onveranderlijke releases behouden, met dezelfde hashes als web/native. De export is idempotent: bestaande story/version-rijen blijven staan. Nieuwe studiocontent gebruikt de bestaande validatie- en publicatieroute. Een nieuwe export ter beoordeling maken:

```bash
node scripts/supabase-export-content.mjs --output /ABSOLUUT/NIEUW/PAD/content.sql
```

Dit schrijft alleen een bestand en voert geen SQL of mail uit. Beoordeel imports en houd rekening met de querylimiet van de beheer-API.

## Eerste beheerder en oudertoegang

**`info@dgwebservices.nl`** is de expliciete bootstrapmailbox. De trigger vertrouwt uitsluitend het werkelijke `auth.users.email`, `email_confirmed_at` en `is_anonymous`. Na echte bevestiging kan de automatische `content_admins`-rol met `grant_source=bootstrap_email` ontstaan. Een onbevestigde of anonieme gebruiker en gemanipuleerde usermetadata krijgen geen rol. Verlies van het bevestigde adres trekt de automatische rol in; afzonderlijke handmatige toekenningen blijven behouden.

De nieuwe privacyversie is **`2026-11-22.1`**, SHA-256 `c3f6186be703dda5320b70227070fea79e395eac225dbbbde0420913c57727e4`; voorwaarden blijven `2026-11-22`. De nieuwe catalogusrij laat oude downloads en echte aanvaardingen intact. Huidige onboarding en nieuwe profieltoestemming gebruiken de nieuwe privacy-informatieversie. De eigenaar bevestigde back-ups maximaal 180 dagen, Stackmail en gewone support maximaal 12 maanden na afsluiting, de toepasselijke verwerkers-/doorgifteafspraken en overgenomen Auth-templates. De eigenaarbron is [vastgelegd](../docs/deploy-evidence/privacy-owner-confirmation-2026-11-22.json).

De eigenaar heeft de OTP-route met **zes cijfers** bevestigd; publieke Auth-settings tonen in beide projecten e-mail en Google aan en Auto Confirm uit. Een echte eerste aanmelding is nog nodig. Er is geen fictieve gebruiker aangemaakt of mailbox zonder bezitsbewijs bevestigd. Voor bruikbare ouder-/beheerrechten moet het account bovendien de afzonderlijke volwassen-ouderverklaring en actuele voorwaarden afronden. De privacyverklaring wordt getoond; zij is geen toestemmingscheckbox. Iedere online kindomgeving vereist afzonderlijke oudertoestemming. Controleer na de echte aanmelding de huidige servergeverifieerde gebruiker, onboarding, eigen databasebeheerrol en studio per project. Deel geen OTP, sessie of andere inloggeheimen in chat of logs.

## Auth-mail: Supabase Custom SMTP via Resend

**De door de eigenaar ingerichte Supabase Custom SMTP via Resend blijft de actieve verzendroute. Activeer hiervoor geen Send Email Hook.** De aanwezigheid van de gedeployde `auth-email`-functie verandert die keuze niet. De OTP-/Google-UI en serverroutes zijn voorbereid; publieke providerinstellingen en eigenaarbevestiging zijn geen bewijs van interactieve aanmelding of inboxbezorging.

Supabase Auth-mail gebruikt de HTML en onderwerpen in **Authentication → Email Templates** van het eigen project. Onder `email-templates/` staan **31 geëxporteerde bestanden**: dertien staging-HTML-templates, dertien productie-HTML-templates, vier synthetische previews en een manifest. Dezelfde gedeelde renderer voedt de Fabelpad-editor. Op **Beheer → E-mailtemplates** kan een Auth-template met de huidige bewerkingen als veilige HTML worden gedownload, met het bijbehorende onderwerp en de vaste Supabase-placeholders. Neem HTML en onderwerp per project handmatig over in het Supabase Dashboard. Opslaan in de Fabelpad-editor synchroniseert ze niet automatisch naar SMTP/Auth.

`auth-email` **v3** is in beide projecten beschikbaar, maar de hook is **niet actief**. De optionele handler vereist een Standard Webhooks HMAC-handtekening, een beperkt tijdvenster en body, de juiste omgeving/project/origin en eigen verzendconfiguratie. `verify_jwt=false` staat alleen dit pre-loginprotocol toe; het is geen vrije mailendpoint. Gebruik deze reserve-integratie niet om de bestaande SMTP-route te vervangen. Zie de [actuele mailbeheerhandleiding](../docs/EMAIL-BEHEER.md) en [templatehandleiding](../docs/EMAIL-TEMPLATES.md).

## Applicatiemail: Resend API en templates in Beheer

Applicatieservicemails hebben een **afzonderlijke Resend API-koppeling** nodig. Werkende Auth-SMTP vult deze koppeling niet in. Per omgeving ontbreekt bij de laatste controle nog de API-key in het eigen Vault. Voer die na de echte beheerderaanmelding in via **Beheer → E-mailinstellingen** (`/studio/email`), controleer afzender, reply-to en tracking en voer de echte test-/opslagroute uit. Sleutels komen niet in GitHub-variabelen, broncode, documentatie of procesargumenten.

De `email-admin` Edge Function **v3** controleert zelf de echte huidige Auth-gebruiker, het actieve ouderaccount en de actuele databasebeheerrol. De browser krijgt alleen niet-geheime instellingen. Ontsleutelde configuratie en atomair opslaan zijn voor beperkte Edge-servicetaken. Opslag vereist een geaccepteerde test naar uitsluitend de aangemelde beheerder, actuele revisie en een eenmalig bewijs met vervaltijd. Een API-ontvangstbewijs is nog geen bewijs van inboxbezorging.

`/studio/email/templates` beheert de gedeelde opmaak en Auth-/applicatietemplates. Opgeslagen servicewijzigingen worden gebruikt voor nieuw aangemaakte applicatieberichten; een al vastgelegde outboxpoging behoudt zijn eigen inhoud voor betrouwbare herhaling. Er worden geen toekomstige servicemails verstuurd zonder echte gebeurtenis. Zonder werkende API-configuratie blijft servicemail onvoltooid; verklaar waarschuwingen of verwijderbevestigingen dan niet afgeleverd.

## Ouderlevenscyclus en onderhoud

`account-maintenance` **v2** is in beide projecten actief. De eigen minuuttaak `fabelpad-account-maintenance` gebruikt een **projectgebonden HMAC-SHA-256**, een kort geldigheidsvenster en een atomair eenmalige nonce. De herbruikbare sleutel blijft in Vault en staat niet in de `pg_net`-queue. De worker accepteert geen bearer-Authorizationroute; `verify_jwt=false` vervangt de eigen HMAC-controle niet. Beheer-, claim- en uitvoerfuncties blijven beperkt tot hun bedoelde rollen.

De expliciete gesigneerde proef en daaropvolgende cronaanroepen gaven in beide projecten **HTTP 200**, **`completed:0`** en **`deferred:0`**. Dit bewijst de scheduler-/authenticatieroute met een lege werkvoorraad; het bewijst geen echte mailbezorging of verwijdering. Er waren nul Auth-gebruikers. De cron is actief, maar **automatische wissing na 90 dagen staat uit**. Daarvoor zijn eerst een stagingrapport, werkende waarschuwingen en een gecontroleerde overgang vereist.

De nieuwe retentiemigratie bewaart minimale account-/kindwisbewijzen met een vaste vervaldatum na **210 dagen**. Een te korte of te lange expiry wordt geklemd; completion-/eerste registratietijd verschuift niet door retries. Kindbewijs bevat alleen gehashte technische verwijzingen en tijden, heeft RLS, geen Auth-FK en geen directe applicatierolrechten. De scheduler ruimt verlopen bewijs op. De minimale AVG-zaakmetadata heeft afzonderlijk 12 maanden na afsluiting als codebeleid; de bevestigde gewone Stackmail-supporttermijn van 12 maanden is mailboxbeleid en wordt niet door deze appcron uitgevoerd.

De app toont vóór een handmatige accountverwijdering de alleen-lezen serverpreview van de verwijderdatum tot op de minuut. De bevestigde minuut wordt in dezelfde SQL-transactie opnieuw gecontroleerd; een verlopen preview vereist nieuwe expliciete bevestiging en draait tussentijdse wijzigingen terug. Verwijdering en expliciet herstel vereisen verse authenticatie. Een gewone login herstelt een account nooit automatisch. Online profielintrekking wist uitsluitend het bedoelde kinderprofiel en blokkeert herupload onder dezelfde ingetrokken identiteit. Zie [LIFECYCLE-IMPLEMENTATIE.md](../docs/LIFECYCLE-IMPLEMENTATIE.md).

AVG-verzoeken kunnen zonder login via [de openbare supportroute](../docs/PRIVACY-SUPPORT-RUNBOOK.md) worden voorbereid. Bevoegde beheerders registreren via `/studio/privacy` minimale zaakmetadata en behandelen verificatie, termijnen en afhandeling. De app is geen gekoppelde supportinbox; de beheerpagina slaat geen volledige mailinhoud op. Een wiszaak mag pas afgerond worden na aantoonbare uitvoering in de juiste scope.

## Verificatie, publicatiegates en herstel

`pnpm check:backend` draait de werkelijke PostgreSQL/RLS/RPC-logica in PGlite, de geïnstalleerde Supabase Auth/SSR-SDK en synthetische providerantwoorden. De actuele controle omvat onder meer:

- **32 Auth-contractscenario’s**, **36 ouder-API-scenario’s** en **48 AVG-beheer-API-scenario’s**.
- Versiegebonden onboarding, eigenaarschap, sessie- en rolcontrole, profieltoestemming/intrekking, activiteit, verwijderpreview en de atomische terugdraaiing bij een veranderde minuut.
- Lifecycle-/RLS- en outboxlogica, **18 workertests** en echte pgcrypto-HMAC-uitkomsten vergeleken met Node-crypto, projectbinding en replayweigering.

`pnpm check:email` controleert exports, renderer, optionele hookhandtekeningen, ontvangers, timeout/idempotentie, Vault-/beheergrenzen en configuratietests. Deze lokale tests vervangen geen hosted gelijktijdigheid, echte provider-API, OTP-/Google-aanmelding, inboxbezorging of back-upherstelproef. Het [actuele validatierapport](../docs/VALIDATIE-GOOGLE-PRIVACY-2026-11-22.md) legt de schone exacte bronbuild en **37 geslaagde browsertests** vast; [de statuspagina](../docs/STAGING-PRODUCTION-STATUS.md) houdt CI, kandidaatbouw en activatie afzonderlijk bij.

De actuele appbron **`538c6b719e372f4dca99cfa2bc824cbf6310f5c1`** heeft geslaagde verplichte web-CI [45060149261](https://github.com/fabelpad/platform/actions/runs/45060149261) en native CI [45060149267](https://github.com/fabelpad/platform/actions/runs/45060149267), een schone volledige build en 37 geslaagde browsertests. Stagingkandidaat [45061896274](https://github.com/fabelpad/platform/actions/runs/45061896274) en productiekandidaat [45062081153](https://github.com/fabelpad/platform/actions/runs/45062081153) zijn gebouwd en gecontroleerd. Activeringen [45062096570](https://github.com/fabelpad/platform/actions/runs/45062096570) en [45062262163](https://github.com/fabelpad/platform/actions/runs/45062262163) slagen; beide eigen services draaien boot-enabled op uitsluitend `127.0.0.1:4188` en `127.0.0.1:4189`. Zie de [gezamenlijke releaseaudit](../docs/deploy-evidence/privacy180-activated-2026-11-22.json).

**Alleen staging-HTTPS is geactiveerd** voor de eigenaaracceptatie: [staging.fabelpad.nl/inloggen](https://staging.fabelpad.nl/inloggen). Production-HTTPS blijft uit. De publieke stagingproef slaagt voor 23/23 alleen-lezen controles, inclusief TLS, juiste SHA, privacy.1, historische documenthash, headers en anonieme API-weigering: [bewijs](../docs/deploy-evidence/privacy180-staging-public-2026-11-22.json). Er zijn geen echte accounts, OTP’s, Google-aanmeldingen of inboxbezorgingen als geslaagd getest.

De eerste eigenaar gebruikt **`/inloggen` → Ouderaccount maken**, leest de juridische informatie en geeft de afzonderlijke ouderverklaring en voorwaardenkeuze actief. Daarna volgt de zescijferige OTP naar `info@dgwebservices.nl`, de servergecontroleerde ouderonboarding en **Beheer → E-mailinstellingen** (`/studio/email`) voor de afzonderlijke Resend API-koppeling/test. Er bestaat geen afzonderlijke `/registreren`-route. Stagingacceptatie van login, beheer, API-mail en de hoofdflow gaat vooraf aan gecontroleerde production-HTTPS-vrijgave; production krijgt haar eigen acceptatie vóór breed online kindgebruik.

De 210-dagenbewijzen in dezelfde database vormen geen onafhankelijke hersteljournal. Vóór hersteld gebruikersverkeer moeten alle latere verwijderingen en intrekkingen volledig worden toegepast vanuit actuele afgeschermde informatie buiten het teruggezette domein, of wordt het ongedekte herstelpunt geweigerd. Providerlogcriteria en feitelijke mailboxopschoning blijven uitvoeringscontroles. De bevestigde 180-dagenback-upgrens en 12-maandensupporttermijn worden niet als door de app uitgevoerde cron geclaimd. Zie [gegevensstromen](../docs/PRIVACY-DATASTROMEN.md), [DPIA](../docs/PRIVACY-DPIA-2026-11-22.md) en [supportprocedure](../docs/PRIVACY-SUPPORT-RUNBOOK.md).

De staging-UI-controle bevestigt de knop voor een inlogcode met de Google-knop/het icoon daaronder, twee aanvankelijk lege registratiekeuzes en afgeschermde mailinstellingen voor anonieme bezoekers. Het actuele privacydocument noemt Stackmail, 180 dagen back-ups, 12 maanden support en uitgeschakelde 90-dagenautomatisering. De nieuwe en historische documenthashes zijn via HTTPS gecontroleerd. Het zescijferige invoerveld is in broncode en synthetische tests gecontroleerd; de liveproef vroeg geen OTP aan en toont daarvoor nog geen codeveld. De browserproef verstuurde geen OTP en volgde geen Google-aanmelding: [browserbewijs](../docs/deploy-evidence/privacy180-staging-browser-2026-11-22.json). Health 200 is nog steeds **`process-liveness-only`** met backend **`configured-unverified`**; de echte account-/gezins-/mailacceptatie volgt afzonderlijk.

De live anonieme aanroepen van `preview_account_deletion` en de bewaakte `request_account_deletion` zijn in beide projecten geweigerd met **HTTP 401 / SQLSTATE 42501**, gecontroleerd om **18:52 UTC**. Dit is bewijs van sessieverplichting, geen echte ouderaanvraag of verwijdering. De lokale audit staat in `/tmp/fabelpad-live-rpc-anonymous-20261122.json`.

De eigen hostadapters gebruiken de eigen werkmap bij het starten van een beperkt bouwproces. De schone nieuwe bron omvat **89 releasetests**, **19 Python-hosttests** en **37 browsertests**; de eerdere c1-build had 87 releasetests en 36 browsertests. De eigen namespace-retentietimers zijn actief om 00, 06, 12 en 18 uur, met 29-dagenretentie en maximaal 12 uur per journalbestand; zes helpertests en echte unitvalidatie slagen. Dit is geen bewijs van providerback-up- of mailboxopschoning. De kleine Caddy-headercorrectie wijzigt geen appcode: alleen de eigen stagingroute/voorbereide snippets zijn aangepast, productie blijft publiek uit. Zie de [status](../docs/STAGING-PRODUCTION-STATUS.md) en [validatie](../docs/VALIDATIE-GOOGLE-PRIVACY-2026-11-22.md).

De eerdere [eerste-inrichtingscontrole](../docs/deploy-evidence/supabase-2026-11-22.json) en [mailbeheercontrole](../docs/deploy-evidence/email-admin-2026-11-22.json) blijven historische momentopnamen. Het [eerdere lifecyclecontrolebewijs](../docs/deploy-evidence/google-legal-lifecycle-2026-11-22.json) legde de toenmalige acht migraties vast; voor de huidige tien, privacy.1 en 14 INFO geldt het [nieuwe livebewijs](../docs/deploy-evidence/privacy180-supabase-live-2026-11-22.json).

Een volgende migratie bij gebruikersdata vereist projectcontrole, een passende afgeschermde back-up, een herstelplan en voor-/achterwaartse compatibiliteit. Approllback draait database-, documentcatalogus-, Auth-, Edge-, Vault-, SMTP- of providerwijzigingen niet terug. Controleer juridische weergave en onboarding van een oudere app vóór publiek rollbackgebruik. Drop de schema’s niet automatisch bij appfalen. Een herstelde oude database mag verwijderde accounts of ingetrokken kindprofielen niet opnieuw beschikbaar maken; houd verwijderbewijzen/tombstones en de providerafhandeling in het herstelproces betrokken.

De native Android-productie-app blijft afzonderlijk: een lokale, gratis leesapp zonder cloudaccounts. Deze Supabase-inrichting activeert geen Android-login, cloudsynchronisatie, betalingen of Google Play-publicatie.
