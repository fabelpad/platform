# Servercontract voor ouders, toestemming en verwijdering

De implementatie staat in de migratie `20261122172905_parent_account_lifecycle.sql`, `lib/lifecycle/` en de Edge Function `account-maintenance`. De migratie is additief. De lifecycle is een eigen serverstatus naast de Supabase Auth-identiteit; het bestaan van een Auth-account geeft geen gezinsrechten.

## Eigen ouderaccount

Alle gebruikers-RPC's zijn publieke `SECURITY INVOKER`-wrappers om beperkte private functies. Die controleren de geverifieerde, niet-anonieme Auth-identiteit, het ondertekende `session_id`, het bestaan/eigenaarschap en `not_after` van de actuele Auth-sessie. Autorisatie gebruikt geen `user_metadata`. Normale familietoegang vraagt bovendien status `active` en de actuele voorwaardenversie. Deze controles staan ook in RLS en de bestaande CAS-/beheer-RPC's, zodat een oude browser of een rechtstreekse API-aanroep de webpagina niet kan omzeilen.

| RPC | Invoer | Resultaat |
| --- | --- | --- |
| `get_account_lifecycle` | Geen | Status, actuele/getoonde documentversies, deadline en minimale profieltoestemmingen; bij een afgeschermd account geen leesgegevens. |
| `complete_parent_onboarding` | `p_terms_version`, `p_privacy_version`, `p_parent_declaration=true`, `p_accept_terms=true`; optionele kanaalinvoer geeft geen bevoegdheid | Exacte serverversies vereist. Legt versie, beide documenthashes, UTC, volwassen-ouderverklaring en kanaal uit de ondertekende Auth-claim vast. Geen verplicht privacyakkoord. |
| `consent_child_profile` | `p_child_id`, `p_consent`, bij geven `p_guardian_declaration=true` | Afzonderlijke toestemming per profiel. Intrekken wist alleen dat profiel uit het gezinsdocument, verhoogt de CAS-revisie en bewaart een minimale intrekkingstombstone. |
| `record_family_activity` | UUID `p_event_id`, `p_kind`, bij lezen `p_child_id`; optionele `p_occurred_at` alleen voor lezen | Alleen ouderlogin, bewuste ouderactie of lezen. Offline tijdstippen maximaal 48 uur oud, maximaal een minuut toekomst en begrensd op ontvangsttijd. Dubbele of oudere gebeurtenissen verlengen niets. |
| `preview_account_deletion` | Geen | Alleen-lezen preview met de serverberekende herstelminuut en vervaltijd. Vereist verse ouderauthenticatie; schrijft geen activiteit, lifecycle, sessie of outbox. |
| `request_account_deletion` | De nieuwe webroute vereist `p_expected_deadline_minute`; de bestaande nulargument-RPC blijft compatibel | Verse ouderauthenticatie van maximaal vijf minuten. Blokkeert meteen, bewaart één vaste deadline van 30 dagen, trekt sessies in en schrijft een duurzame bevestigingsopdracht. De bewaakte overload vergelijkt de werkelijk vastgelegde minuut in dezelfde transactie met de getoonde preview. |
| `restore_account` | Geen | Nieuwe actuele, verse ouderauthenticatie én een afzonderlijke expliciete actie vóór de deadline. Gewoon inloggen herstelt niets. Start normale activiteit opnieuw; start nooit een betaling. |

De additieve migratie `20261122182638_account_deletion_deadline_preview.sql` maakt de preview en bewaakte overload. De weergave gebruikt Nederlandse tijd met minuutprecisie; de werkelijke deadline blijft exact 30 dagen na de servertransactie, inclusief seconden/milliseconden. Als de bevestiging in een volgende minuut arriveert, geeft de RPC `deletion_preview_expired` en wordt de gehele transactie teruggedraaid, inclusief sessie-intrekking, waarschuwingannulering en mailopdracht. De interface haalt dan een nieuwe preview op en vraagt een nieuw vinkje; zij verstuurt niets automatisch. Een reeds aangevraagd account behoudt zijn oorspronkelijke deadline.

De exacte juridische Markdown-versies zijn in de database opgeslagen met een SHA-256-check en een wijzigingsverbod. Dezelfde bytes staan in `public/legal/2026-11-22/`. Een eenmaal aanvaarde versie wordt nooit overschreven; een inhoudelijke wijziging krijgt een nieuwe versie en een passende kennisgeving.

Een laatste ingetrokken profiel produceert het canonieke lege document `children: []`, `activeId: ''`, `data: {}` bij een hogere revisie. Een ingetrokken profiel-ID kan niet opnieuw worden toegestaan. Een nieuw gewenst profiel krijgt een nieuwe ID en afzonderlijke toestemming. Ook een correct opgehoogde oude offline blob kan ingetrokken gegevens dus niet terugplaatsen.

## Verwijderwerker en servicemail

`account-maintenance` accepteert uitsluitend een begrensde POST met `nonce`, `issuedAt` en een eenmalige HMAC-SHA256-handtekening. De signer gebruikt een eigen servergegenereerde sleutel in Vault, die nooit in een HTTP-header, queue, response of appbuild terechtkomt. De handtekening bindt de vaste protocolnaam, het eigen project, een willekeurige UUID en het server-tijdstip. Een service-only RPC controleert maximaal 90 seconden ouderdom en 15 seconden toekomstige klokmarge, vergelijkt alle 32 bytes en consumeert de nonce atomair. Een gewone uitgegeven aanvraag is 90 seconden geldig; inclusief toegestane toekomstige klokmarge is de theoretische uiterste duur 105 seconden. Een herhaalde aanvraag kan geen tweede uitvoering starten. Er worden geen door HTTP opgegeven account-ID, ontvanger, wisopdracht of testklok aangenomen. De standaard Supabase servicecredential bestaat alleen in de Edge-runtime; de verificatie-RPC geeft uitsluitend Ja/Nee terug. Geen nieuwe GitHub-variabele is nodig.

De scheduler maakt opdrachten; iedere worker claimt maximaal drie met een unieke lease. Herstel, activiteit, blokkering en de wisbeslissing vergrendelen dezelfde accountstatus. De klok wordt na het verkrijgen van het slot opnieuw gelezen. Op de exacte deadline kan herstel niet meer winnen met een eerder uitgelezen klok.

Voor definitieve verwijdering inventariseert de worker werkelijk aanwezige Storage-objecten onder zowel de huidige als historische eigenaarvelden. Hij verwijdert die via de Storage API, inventariseert opnieuw, verwijdert daarna de Auth-identiteit via de Auth Admin API en verifieert de afwezigheid. Hij legt voltooiing alleen vast als ook de database geen Auth-identiteit of eigen Storage-objecten meer vindt. Fouten zijn herstartbaar; een gedeeltelijk uitgevoerde opdracht blijft onvoltooid. Families, acceptaties, toestemmingen, activiteit en beheerkoppelingen verdwijnen door cascade/ontkoppeling. Gerelateerde mailoutboxen verliezen ontvanger, bevroren inhoud en ruwe accountverwijzingen. Alleen een minimaal wisbewijs met digest/operatie-ID en resultaat blijft maximaal 90 dagen staan.

De bestaande Auth-mail blijft via **Supabase Custom SMTP met Resend** lopen. Deze worker wijzigt of activeert geen Send Email Hook. Applicatie-servicemails gebruiken apart de Resend API-configuratie uit **Beheer → E-mail / Supabase Vault**, met de bestaande Edge-configuratie uitsluitend als oorspronkelijke fallback. Een opgeslagen maar ongeldige Vault-configuratie valt nooit terug op een oude key. Ontbreekt de API-key, dan blijft servicemail aantoonbaar onvoltooid in de outbox; werkende SMTP is geen bewijs dat de API is gekoppeld.

Voor een mail wordt ontvanger, afzender en gerenderde inhoud vastgezet vóór de eerste verzending. Retries gebruiken dezelfde inhoud en idempotency key. Een onzekere levering krijgt na 23 uur `attention`, voordat Resends idempotencyvenster van 24 uur kan verlopen. Een beheerder moet dan eerst de provider controleren; nooit blind opnieuw verzenden. Een Resend-ontvangstbewijs bewijst provideracceptatie, niet aflevering in de inbox. Mails bevatten geen kindnamen of leesgegevens. De concrete deadline en herstelstappen staan in vaste paragrafen die niet verdwijnen door een aangepaste introductietekst.

## 90 dagen en de overgang

Nieuwe voltooide registratie is het startpunt. Een tokenrefresh, lege CAS-sync, heartbeat, mailopening of passief betaalbericht is geen activiteit. Afzonderlijk opgeslagen UUID's voorkomen ook na langere tijd herhaalde verwerking; ze bevatten geen kindnaam, profiel-ID of verhaalinformatie en verdwijnen bij accountwissing.

De migratie zet `inactivity_enabled=false`. Dat is een veiligheidsvoorwaarde, geen draaiende 90-dagenopschoning. Activeren mag pas na een stagingtest, een kandidaatrapport, controle van de overgang en een werkende mailroute voor waarschuwingen. Het rapport is beschikbaar via de alleen voor de servicelaag toegestane `lifecycle_candidate_report`-RPC of de private functie vanuit de bevoegde databasebeheeromgeving. De huidige toestand is vastgelegd in het releasebewijs, niet afgeleid uit dit document.

Oude identiteiten krijgen geen aanvaarding of verzonnen activiteit. Zij moeten eerst afronden; de afzonderlijke overgangsdeadline is aanvankelijk 90 dagen na migratie. Een afgebroken nieuwe registratie zonder gezinsrechten wordt na zeven dagen opgeruimd. De 90-dagentaak waarschuwt 14 en 3 dagen vooraf en blokkeert/wist op of direct na de werkelijke grens, zonder extra 30 dagen. Als de ouder al vóór die grens vrijwillig een 30-dagenaanvraag deed, blijft diens oorspronkelijke 30-dagendatum gelden. Een aanvraag ná een verstreken, geactiveerde 90-dagengrens kan geen extra hersteltermijn maken.

## AVG-zaakregister

De publieke routes verwijzen rechtstreeks naar `support@fabelpad.nl`; zij vereisen geen ouderlogin, ook niet voor een eigen verzoek van een kind van 12. Het is geen automatisch gekoppelde inbox. De afgeschermde behandeling staat in [PRIVACY-SUPPORT-RUNBOOK.md](./PRIVACY-SUPPORT-RUNBOOK.md).

Alleen een actuele, actieve beheerder kan de register-RPC's gebruiken:

- `register_privacy_request(p_reference, p_kind, p_scope, p_parent_id, p_child_id, p_received_at)` legt een minimale referentie, type en bereik vast. `p_received_at` is uitsluitend een door de bevoegde medewerker vastgelegde werkelijke mailboxontvangst; het kan niet in de toekomst liggen. Weglaten gebruikt de actuele serverontvangst. De normale reactiedeadline is één kalendermaand vanaf die ontvangst. Een herhaalde referentie verlengt die datum niet en mag niet van onderwerp wisselen.
- `manage_privacy_request(p_request_id, 'bind_subject', null, null, p_parent_id, p_child_id)` koppelt na de eerste minimale ontvangst een nog onbekend onderwerp. Dat kan alleen voor een ongebonden, niet-geverifieerde zaak; ouder-/kindbereik blijft vast en de betreffende bestaande identiteit/profielkoppeling wordt gecontroleerd.
- `manage_privacy_request(p_request_id, 'verify', p_verification_method, null)` registreert proportionele verificatie; geen standaard identiteitsdocument of volledige geboortedatum.
- `manage_privacy_request(p_request_id, 'execute_erasure', null, null)` wist bij kindbereik uitsluitend het betreffende profiel en verhoogt de CAS-revisie. Bij gezinsbereik blokkeert het account en start de wiswerker direct, zonder vrijwillige 30-dagenwachttijd. Een bestaand vrijwillig verzoek vertraagt een geldig eerder AVG-wisverzoek niet.
- `manage_privacy_request(p_request_id, 'extend', null, p_extension_reason)` vereist tijdige kennisgeving met reden binnen de eerste maand en legt hoogstens twee extra kalendermaanden vast. Het registreren van de reden verstuurt de kennisgeving niet zelf; de medewerker moet die aantoonbaar verzenden.
- `complete` is voor afgehandelde overige rechten. Wissing en intrekking kunnen niet met deze knop worden overgeslagen: kindwissing voltooit atomair met de scrub, gezinswissing alleen met bewezen Auth-/Storage-werkersreceipt. Afgehandelde minimale zaken verlopen na twaalf maanden; correspondentie in de mailbox vereist een eigen gecontroleerde bewaarinrichting.

Werk provider-/supportverwijdering en eventueel herstel van back-ups afzonderlijk af; de database-ontvangstbewijzen bewijzen geen verwijdering van iedere externe of historische kopie. Geen betaalprovider is aangesloten. De betaalroute blijft gesloten totdat verlengstop, consumentenrechten en restitutie tegen de echte provider zijn geïmplementeerd en getest.

## Verificatie

```sh
node scripts/lifecycle-db-check.mjs
node --test scripts/lifecycle-worker.test.mjs
pnpm check:backend
pnpm check:email
pnpm typecheck
```

De databasechecks voeren echte PostgreSQL-functies, RLS, CAS, constraints en transacties in PGlite uit. Alleen de testdatabase-eigenaar vervangt de private klok. Er is geen publieke testklok. De 18 workerchecks gebruiken synthetische providerantwoorden en testen onder meer Storage/Auth-volgorde, gedeeltelijke storing, vaste mailcopy, geharde HTTP-ingang en herstartbare leases. Echte gelijktijdige databaseverbindingen, inboxlevering, providerretentie en een back-uphersteltest worden hierdoor niet bewezen.

## Eenminuutscheduler installeren en controleren

De CLI-migratie `20261122174433_lifecycle_worker_schedule.sql` activeert de door Supabase aangeboden `pg_cron`- en `pg_net`-extensies. De aanvullende migratie `20261122175306_signed_lifecycle_worker_requests.sql` maakt de actuele installatiehulpen en service-only nonceverificatie; zij moet erna worden toegepast. Tijdens staging bleek de platformqueue `net.http_request_queue` voor PUBLIC leesbaar en door providerbeheer niet door `postgres` aanpasbaar. Daarom gebruikt het actuele protocol alleen kort geldige, eenmalige ondertekende aanvragen in die queue. De herbruikbare Vaultsleutel blijft uitsluitend in de database. Het ontwerp vereist geen wijziging van provider-ACL's. De aparte, streng bewaakte migratie `20261122175654_private_pg_net_extension.sql` herinstalleert alleen een nog ongebruikte extensie uit `public` in `extensions` wanneer er geen jobs, queue of responsehistorie bestaan; zonder die veilige voorwaarden blijft zij van bestaande inrichting af. Pas alle repositorymigraties toe voordat de scheduler wordt geconfigureerd. Configureer daarna vanuit de bevoegde databasebeheeromgeving van het **geverifieerde** project:

```sql
-- Alleen in Fabelpad staging, nadat de eigen Edge Function is gedeployed:
select private.configure_lifecycle_worker('tlwfpivafcokcjyjwgmq');
-- Alleen in Fabelpad production, na geslaagde stagingcontrole:
select private.configure_lifecycle_worker('aptprpkosqctwrzeetgs');
```

Deze opdrachten geven uitsluitend doel-/cronmetadata terug. Ze genereren het 64-hexteken-token rechtstreeks in de database en slaan het versleuteld in Vault op. Ze lezen geen token uit naar terminal of bestand. Iedere configuratie bewaart een bestaande geldige key; een gepind doel kan niet stilzwijgend naar het andere project worden omgezet. Een bestaand conflicterend of gepauzeerd cronjob wordt niet overschreven of aangezet. De croncommand is uitsluitend `select private.invoke_lifecycle_worker();`, elke minuut. Ook deze installatie laat `inactivity_enabled=false` ongemoeid.

Een afzonderlijke proefaanroep:

```sql
select private.invoke_lifecycle_worker();
```

geeft alleen het `pg_net`-request-ID terug. Controleer na commit in een nieuwe alleen-lezen query de bijbehorende `net._http_response`: HTTP-status en veilige response met `completed`/`deferred` of foutcode. De queue bevat uitsluitend het vaste eigen endpoint, Content-Type en de korte eenmalige proof; geen Authorization-header of herbruikbaar geheim. Wie een zichtbare nog ongebruikte proof onderschept, kan hoogstens dezelfde beperkte onderhoudsaanroep éénmaal eerder laten lopen. De atomische noncecheck maakt een tweede uitvoering onmogelijk; het endpoint geeft alleen aantallen terug. Exporteer ook deze tijdelijke handtekeningen niet naar bestanden of logs. Er worden geen provider-ACL's aangepast. Controleer daarnaast `cron.job` en `cron.job_run_details` op de eigen jobnaam. Een lege uitvoering met `completed:0,deferred:0` bewijst de scheduler-/authenticatieroute; deze bewijst geen accountwissing of echte mail.

Databasebeheerder kan de eigen job later pauzeren met `cron.unschedule` volgens de geverifieerde job-ID. Rotatie van het token is een aparte, bevoegde Vault-handeling met nieuw databasegegenereerd geheim, zonder de waarde te tonen. De databaseverificatie gebruikt de huidige Vaultwaarde bij iedere aanroep; een keyrotatie maakt oude proofs ongeldig en vereist geen Edge-redeploy.

De extra lokale check is `node scripts/lifecycle-scheduler-db-check.mjs`. Hier zijn uitsluitend platformcron-/HTTP-I/O en Vaultencryptie expliciet gestubd; applicatie-SQL, pinning, transacties, rechten, eenmalige nonces en echte pgcrypto-HMAC worden in PostgreSQL uitgevoerd en tegen onafhankelijke Node-cryptografie vergeleken.
