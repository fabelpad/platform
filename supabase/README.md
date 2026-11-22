# Fabelpad — Supabase, beheerrechten en mail

## Voorbereide privacyactualisering — nog niet live toegepast

De eigenaar bevestigt maximaal 180 dagen voor back-ups, Stackmail, maximaal 12 maanden na afsluiting voor gewone supportmail, de verwerkers-/doorgifteafspraken en overgenomen Auth-templates. Nieuwe bronmigraties `20261122190748_backup_erasure_evidence_retention.sql` en `20261122190924_privacy_backup_support_update.sql` bereiden respectievelijk vaste 210-dagenbewaring van minimale wisbewijzen en privacyversie `2026-11-22.1` voor. De tweede migratie voegt een onveranderlijke documentrij toe en laat oude documenten/aanvaardingen intact; huidige onboarding en nieuwe profieltoestemming gebruiken de nieuwe informatieversie. Voorwaarden blijven `2026-11-22`.

De bestaande acht live migraties en loopbackapp `c1a9829…` zijn niet door deze bronwijziging vervangen. Voer de nieuwe migraties pas via de gecontroleerde releaseprocedure uit en leg de eigen live verificatie vast. Een retentiefix binnen dezelfde database is geen onafhankelijke hersteljournal: weiger hersteld gebruikersverkeer zonder volledige actuele verwijder-/intrekkingsdekking. Zie [eigenaarbevestiging en versie](../docs/PRIVACY-AANVULLING-180-DAGEN.md).


Gecontroleerd op **22 november 2026**. Dit document betreft uitsluitend de twee onderstaande Fabelpad-projecten. De oorspronkelijke inrichting begon met lege projecten; de actuele toestand omvat acht toegepaste migraties, dertien bronverhalen, de mailbeheerfuncties en de ouder-/privacylevenscyclus. Bij de laatste livecontrole waren er **nul Auth-gebruikers, beheerders, gezinnen en Resend API-mailconfiguraties**. Een ingerichte database of Edge Function is geen actieve webrelease.

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

De acht hierboven opgesomde toegepaste migratieversies komen overeen met de gecontroleerde historie van beide projecten. De twee nieuwe, bovenaan beschreven bronmigraties zijn daarvan afzonderlijk en nog niet live toegepast. Bij door de beheertool toegekende uitvoeringstijdstempels is uitsluitend de versie-administratie gelijkgetrokken **na vergelijking van de volledige opgeslagen SQL-SHA256**; statements en inhoud zijn behouden. De vijf laatste migraties zijn de nieuwe ouder-/lifecycle-/scheduler-/previewwijzigingen. Hun exacte hashes en controles staan in [google-legal-lifecycle-2026-11-22.json](../docs/deploy-evidence/google-legal-lifecycle-2026-11-22.json). De previewmigratie heeft SHA-256 `465155f8d009f0ddddd8eda0dfe356b903862c47739b1e7c08628d0c3a32b9cc`.

Voer reeds toegepaste migraties niet opnieuw uit met een ongecontroleerde `db push`. Controleer altijd expliciet het bedoelde hosted project, de bestaande historie en de geplande nieuwe SQL. [Officieel migratiecontract](https://supabase.com/docs/guides/deployment/database-migrations). De eerder gebruikte Supabase CLI **3.2.0** is een beheertool en geen runtimevoorwaarde; selecteer bij CLI-gebruik een hosted doel expliciet.

## Database- en rechtencontract

- `family_documents`: ouder-UUID als eigenaar; RLS op de eigen rij en gevalideerde CAS-RPC voor wijzigingen. Toegang vereist daarnaast een echte huidige sessie, actuele ouderonboarding en een actief account. Andere gezinnen en anonieme sessies krijgen geen toegang.
- `content_admins`: alleen de eigen rol lezen, geen client-write. Beheerrechten komen uit de database en worden servermatig gecontroleerd; usermetadata is geen autorisatiebron.
- `content_drafts`: beperkte beheerdertoegang, revisiecontrole en gevalideerde wijzigings-/publicatie-RPC’s.
- `content_releases`: publiek leesbaar, versiehash en onveranderlijkheid. Publicatie behoudt eerdere verhaalversies; accountverwijdering verwijdert geen publieke verhaalrelease.
- Private mail-, ouder-, toestemmings-, activiteit-, AVG-, outbox- en schedulergegevens: directe applicatietoegang geweigerd. Alleen de bedoelde beperkte functies mogen deze gegevens lezen of wijzigen. Service-only taken krijgen geen algemene browser- of Next-serverrechten.
- Juridische versies: voorwaarden en getoonde privacyversie worden met vaste documenthashes geregistreerd. Een toekomstige documentwijziging vereist een bewuste nieuwe versie; reeds aanvaarde tekst wordt niet stilzwijgend overschreven.

RLS en functiegrants zijn gecontroleerd. De security advisors melden momenteel **0 WARN, 0 ERROR en 13 INFO**. De INFO-meldingen betreffen private tabellen waarvan directe toegang bewust is geweigerd en alleen gecontroleerde functies de route vormen. Dit zijn geen nul meldingen en geen algemene compliancecertificering. Publieke catalogusdata blijft leesbaar; afgeschermde gezins-, rol-, concept- en lifecycledata is niet anoniem toegankelijk.

De **13 bestaande bronverhalen** zijn per project als onveranderlijke releases behouden, met dezelfde hashes als web/native. De export is idempotent: bestaande story/version-rijen blijven staan. Nieuwe studiocontent gebruikt de bestaande validatie- en publicatieroute. Een nieuwe export ter beoordeling maken:

```bash
node scripts/supabase-export-content.mjs --output /ABSOLUUT/NIEUW/PAD/content.sql
```

Dit schrijft alleen een bestand en voert geen SQL of mail uit. Beoordeel imports en houd rekening met de querylimiet van de beheer-API.

## Eerste beheerder en oudertoegang

**`info@dgwebservices.nl`** is de expliciete bootstrapmailbox. De trigger vertrouwt uitsluitend het werkelijke `auth.users.email`, `email_confirmed_at` en `is_anonymous`. Na echte bevestiging kan de automatische `content_admins`-rol met `grant_source=bootstrap_email` ontstaan. Een onbevestigde of anonieme gebruiker en gemanipuleerde usermetadata krijgen geen rol. Verlies van het bevestigde adres trekt de automatische rol in; afzonderlijke handmatige toekenningen blijven behouden.

De eigenaar heeft de OTP-route met **zes cijfers** bevestigd; publieke Auth-settings tonen in beide projecten e-mail en Google aan en Auto Confirm uit. Een echte eerste aanmelding is nog nodig. Er is geen fictieve gebruiker aangemaakt of mailbox zonder bezitsbewijs bevestigd. Voor bruikbare ouder-/beheerrechten moet het account bovendien de afzonderlijke volwassen-ouderverklaring en actuele voorwaarden afronden. De privacyverklaring wordt getoond; zij is geen toestemmingscheckbox. Iedere online kindomgeving vereist afzonderlijke oudertoestemming. Controleer na de echte aanmelding de huidige servergeverifieerde gebruiker, onboarding, eigen databasebeheerrol en studio per project. Deel geen OTP, sessie of andere inloggeheimen in chat of logs.

## Auth-mail: Supabase Custom SMTP via Resend

**De door de eigenaar ingerichte Supabase Custom SMTP via Resend blijft de actieve verzendroute. Activeer hiervoor geen Send Email Hook.** De aanwezigheid van de gedeployde `auth-email`-functie verandert die keuze niet. De OTP-/Google-UI en serverroutes zijn voorbereid; publieke providerinstellingen en eigenaarbevestiging zijn geen bewijs van interactieve aanmelding of inboxbezorging.

Supabase Auth-mail gebruikt de HTML en onderwerpen in **Authentication → Email Templates** van het eigen project. Onder `email-templates/` staan **31 geëxporteerde bestanden**: dertien staging-HTML-templates, dertien productie-HTML-templates, vier synthetische previews en een manifest. Dezelfde gedeelde renderer voedt de Fabelpad-editor. Op **Beheer → E-mailtemplates** kan een Auth-template met de huidige bewerkingen als veilige HTML worden gedownload, met het bijbehorende onderwerp en de vaste Supabase-placeholders. Neem HTML en onderwerp per project handmatig over in het Supabase Dashboard. Opslaan in de Fabelpad-editor synchroniseert ze niet automatisch naar SMTP/Auth.

`auth-email` **v3** is in beide projecten beschikbaar, maar de hook is **niet actief**. De optionele handler vereist een Standard Webhooks HMAC-handtekening, een beperkt tijdvenster en body, de juiste omgeving/project/origin en eigen verzendconfiguratie. `verify_jwt=false` staat alleen dit pre-loginprotocol toe; het is geen vrije mailendpoint. Gebruik deze reserve-integratie niet om de bestaande SMTP-route te vervangen. Zie de [actuele mailbeheerhandleiding](../docs/EMAIL-BEHEER.md) en [templatehandleiding](../docs/EMAIL-TEMPLATES.md).

## Applicatiemail: Resend API en templates in Beheer

Applicatieservicemails hebben een **afzonderlijke Resend API-koppeling** nodig. Werkende Auth-SMTP vult deze koppeling niet in. Per omgeving ontbreekt bij de laatste controle nog de API-key in het eigen Vault. Voer die na de echte beheerderaanmelding in via **Beheer → E-mail**, controleer afzender, reply-to en tracking en voer de echte test-/opslagroute uit. Sleutels komen niet in GitHub-variabelen, broncode, documentatie of procesargumenten.

De `email-admin` Edge Function **v3** controleert zelf de echte huidige Auth-gebruiker, het actieve ouderaccount en de actuele databasebeheerrol. De browser krijgt alleen niet-geheime instellingen. Ontsleutelde configuratie en atomair opslaan zijn voor beperkte Edge-servicetaken. Opslag vereist een geaccepteerde test naar uitsluitend de aangemelde beheerder, actuele revisie en een eenmalig bewijs met vervaltijd. Een API-ontvangstbewijs is nog geen bewijs van inboxbezorging.

`/studio/email/templates` beheert de gedeelde opmaak en Auth-/applicatietemplates. Opgeslagen servicewijzigingen worden gebruikt voor nieuw aangemaakte applicatieberichten; een al vastgelegde outboxpoging behoudt zijn eigen inhoud voor betrouwbare herhaling. Er worden geen toekomstige servicemails verstuurd zonder echte gebeurtenis. Zonder werkende API-configuratie blijft servicemail onvoltooid; verklaar waarschuwingen of verwijderbevestigingen dan niet afgeleverd.

## Ouderlevenscyclus en onderhoud

`account-maintenance` **v2** is in beide projecten actief. De eigen minuuttaak `fabelpad-account-maintenance` gebruikt een **projectgebonden HMAC-SHA256**, een kort geldigheidsvenster en een atomair eenmalige nonce. De herbruikbare sleutel blijft in Vault en staat niet in de `pg_net`-queue. De worker accepteert geen bearer-Authorizationroute; `verify_jwt=false` vervangt de eigen HMAC-controle niet. Beheer-, claim- en uitvoerfuncties blijven beperkt tot hun bedoelde rollen.

De expliciete gesigneerde proef en daaropvolgende cronaanroepen gaven in beide projecten **HTTP200**, **`completed:0`** en **`deferred:0`**. Dit bewijst de scheduler-/authenticatieroute met een lege werkvoorraad; het bewijst geen echte mailbezorging of verwijdering. Er waren nul Auth-gebruikers. De cron is actief, maar **automatische wissing na 90 dagen staat uit**. Daarvoor zijn eerst een stagingrapport, werkende waarschuwingen en een gecontroleerde overgang vereist.

De app toont vóór een handmatige accountverwijdering de alleen-lezen serverpreview van de verwijderdatum tot op de minuut. De bevestigde minuut wordt in dezelfde SQL-transactie opnieuw gecontroleerd; een verlopen preview vereist nieuwe expliciete bevestiging en draait tussentijdse wijzigingen terug. Verwijdering en expliciet herstel vereisen verse authenticatie. Een gewone login herstelt een account nooit automatisch. Online profielintrekking wist uitsluitend het bedoelde kinderprofiel en blokkeert herupload onder dezelfde ingetrokken identiteit. Zie [LIFECYCLE-IMPLEMENTATIE.md](../docs/LIFECYCLE-IMPLEMENTATIE.md).

AVG-verzoeken kunnen zonder login via [de openbare supportroute](../docs/PRIVACY-SUPPORT-RUNBOOK.md) worden voorbereid. Bevoegde beheerders registreren via `/studio/privacy` minimale zaakmetadata en behandelen verificatie, termijnen en afhandeling. De app is geen gekoppelde supportinbox; de beheerpagina slaat geen volledige mailinhoud op. Een wiszaak mag pas afgerond worden na aantoonbare uitvoering in de juiste scope.

## Verificatie, publicatiegates en herstel

`pnpm check:backend` draait de werkelijke PostgreSQL/RLS/RPC-logica in PGlite, de geïnstalleerde Supabase Auth/SSR-SDK en synthetische providerantwoorden. De actuele controle omvat onder meer:

- **32 Auth-contractscenario’s**, **36 ouder-API-scenario’s** en **48 AVG-beheer-API-scenario’s**.
- Versiegebonden onboarding, eigenaarschap, sessie- en rolcontrole, profieltoestemming/intrekking, activiteit, verwijderpreview en de atomische terugdraaiing bij een veranderde minuut.
- Lifecycle-/RLS- en outboxlogica, **18 workertests** en echte pgcrypto-HMAC-uitkomsten vergeleken met Node-crypto, projectbinding en replayweigering.

`pnpm check:email` controleert exports, renderer, optionele hookhandtekeningen, ontvangers, timeout/idempotentie, Vault-/beheergrenzen en configuratietests. Deze lokale tests vervangen geen hosted gelijktijdigheid, echte provider-API, OTP-/Google-aanmelding, inboxbezorging of back-upherstelproef. Het [actuele validatierapport](../docs/VALIDATIE-GOOGLE-PRIVACY-2026-11-22.md) legt de schone exacte bronbuild en **36 geslaagde browsertests** vast; [de statuspagina](../docs/STAGING-PRODUCTION-STATUS.md) houdt CI, kandidaatbouw en activatie afzonderlijk bij.

De inrichting is niet gelijk aan publieke ingebruikname. De webrelease `c1a9829c6580b835b9845dd672c9d89127f60c64` heeft geslaagde verplichte web-CI [45055273294](https://github.com/fabelpad/platform/actions/runs/45055273294) en native CI [45055273282](https://github.com/fabelpad/platform/actions/runs/45055273282). Stagingkandidaat [45057052139](https://github.com/fabelpad/platform/actions/runs/45057052139) en productiekandidaat [45057304416](https://github.com/fabelpad/platform/actions/runs/45057304416) zijn gebouwd; de gezamenlijke kandidaat-/rechtenaudit om **18:52 UTC** slaagt voor beide. Stagingactivering [45057551364](https://github.com/fabelpad/platform/actions/runs/45057551364) en productionactivering [45057814826](https://github.com/fabelpad/platform/actions/runs/45057814826) zijn daarna geslaagd. Beide eigen services zijn actief en boot-enabled, uitsluitend op `127.0.0.1:4188` en `127.0.0.1:4189`. De [gezamenlijke release-/rechtenaudit](../docs/deploy-evidence/loopback-release-2026-11-22.json) en [veilige runtimecontrole](../docs/deploy-evidence/loopback-smoke-2026-11-22.json) om **18:57 UTC** slagen, met 22/22 runtimecontroles per omgeving. Er is geen nieuwe publieke Fabelpad-routing. Loopbackactivering blijft afzonderlijk van publieke openstelling. Vóór publieke online account-/kindverwerking moeten de privacyfeiten kloppen: werkelijke maximale project-/VPS-/providerback-upretentie, supportmailleverancier, operationele termijnen en verwerkers-/doorgifteafspraken staan nog open. Ook de eigen Resend API-key en echte OTP-/Google-/beheer- en mailacceptatie ontbreken nog. Zie [PRIVACY-DATASTROMEN.md](../docs/PRIVACY-DATASTROMEN.md) en de [DPIA](../docs/PRIVACY-DPIA-2026-11-22.md). Geen ontbrekende gate wordt door een groene lokale test als afgerond aangemerkt.

Volg voor de resterende acceptatie deze volgorde: eerst provider-/retentiefeiten en de juiste juridische versie afronden, daarna staging-HTTPS gecontroleerd activeren voor echte OTP-/Google-, beheerder- en API-mailproeven, en vervolgens production-HTTPS gecontroleerd vrijgeven met haar eigen acceptatie. De Google-callback vraagt de juiste bereikbare HTTPS-origin; stel volledige Google-aanmelding niet als voorwaarde vóór staging-HTTPS. Breed gebruik en open verwerking van kindgegevens volgen pas na de betreffende acceptatie. Een afgeschermde API-bootstrap via Edge-configuratie is optioneel onafhankelijk voor te bereiden.

De runtimecontrole bevestigt juridische routes zonder login, exacte documentbytes, Google-icoon, anonieme providerstatus en OAuth-initiatie naar het eigen project met de juiste callback, PKCE en veilige verifiercookie-attributen. De Google-redirect is niet gevolgd; URL-/cookiewaarden zijn niet bewaard. De HTTP200-health heeft de juiste omgeving en app-SHA, maar scope **`process-liveness-only`** en backend **`configured-unverified`**. Dit is geen afgeronde Google-login, OTP-/mailbezorging, echt account of geteste gezinsflow. De zes bestaande service- en configuratiebaselines bleven gelijk.

De live anonieme aanroepen van `preview_account_deletion` en de bewaakte `request_account_deletion` zijn in beide projecten geweigerd met **HTTP401 / SQLSTATE42501**, gecontroleerd om **18:52 UTC**. Dit is bewijs van sessieverplichting, geen echte ouderaanvraag of verwijdering. De lokale audit staat in `/tmp/fabelpad-live-rpc-anonymous-20261122.json`.

De eigen hostadapters zijn voor beide doelen bijgewerkt na een fout met de overgeërfde runnerwerkmap; het bouwproces gebruikt nu de eigen werkmap. Die afzonderlijke infrastructuurwijziging slaagt voor **89 Node-tests en 19 Python-tests** en behoort met de loghelper tot een latere ops-/documentatiecommit. De schone appbuild op de release-SHA bevat **87 releasetests** en **36 browsertests**. De eigen namespace-retentietimers zijn actief om **00, 06, 12 en 18 uur**, met 29-dagenretentie en maximaal 12 uur per journalbestand; de helper slaagt voor zes selftests en echte unitvalidatie. Dit is geen bewijs van back-up- of mailboxretentie. Zie het [validatierapport](../docs/VALIDATIE-GOOGLE-PRIVACY-2026-11-22.md) voor de afzonderlijke kandidaat-, rechten- en hostbewijzen.

De eerdere [eerste-inrichtingscontrole](../docs/deploy-evidence/supabase-2026-11-22.json) en [mailbeheercontrole](../docs/deploy-evidence/email-admin-2026-11-22.json) blijven historische momentopnamen. Gebruik voor de acht migraties, Edge-versies, huidige adviseursmeldingen en scheduler het [nieuwe lifecyclecontrolebewijs](../docs/deploy-evidence/google-legal-lifecycle-2026-11-22.json).

Een volgende migratie bij gebruikersdata vereist projectcontrole, een passende afgeschermde back-up, een herstelplan en voor-/achterwaartse compatibiliteit. Approllback draait database-, Auth-, Edge-, Vault-, SMTP- of providerwijzigingen niet terug. Drop de schema’s niet automatisch bij appfalen. Een herstelde oude database mag verwijderde accounts of ingetrokken kindprofielen niet opnieuw beschikbaar maken; houd verwijderbewijzen/tombstones en de providerafhandeling in het herstelproces betrokken.

De native Android-productie-app blijft afzonderlijk: een lokale, gratis leesapp zonder cloudaccounts. Deze Supabase-inrichting activeert geen Android-login, cloudsynchronisatie, betalingen of Google Play-publicatie.
