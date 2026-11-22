# Onafhankelijke controle juridische routes en accountlevenscyclus

Datum: 22 november 2026. Dit is bewijs van gecontroleerde code en lokale tests; geen bewijs van live providers, een daadwerkelijke inboxbezorging, parallelle databaseverbindingen of een herstel van productieback-ups.

## Juridische pagina’s en voorlezen

Gecontroleerd: voorwaarden, privacyverklaring (inclusief bestaande `/privacy`), kindvriendelijke privacy, bedrijfsgegevens, accountverwijdering, openbare AVG-route en de gratis informatieroute voor herroepen. Alleen de door de eigenaar genoemde DG Webservices-bedrijfsgegevens zijn opgenomen. De publieke teksten bevatten geen interne publicatie-instructies of testinvulvelden. Supportadres Fabelpad blijft `support@fabelpad.nl`.

- `node scripts/legal-check.mjs`: geslaagd; exacte documentbytes/hashes, versiecatalogus, geen interne publicatietekst en selectie van uitsluitend lokale Nederlandse spraakstemmen.
- `pnpm typecheck`: geslaagd op de gedeelde werkbron tijdens de controle.
- Geïsoleerde kopie van de webbron onder `/tmp/fabelpad-legal-browser-20261122-IsvAmK`, zonder providergeheimen: `next build --webpack` geslaagd. Buildlog staat in die map. Dit is een deelverificatie van de toenmalige werkbron; de finale release krijgt een aparte schone SHA-build.
- Drie Playwrightscenario’s uit `tests/browser/legal.spec.ts`: **3 geslaagd**, 3,1 seconden op de gebouwde productie-runtime. Ze controleren acht openbare routes zonder ouderlogin, weergave op 390px, hashes van werkelijk geserveerde downloads, de eigen privacyroute voor een 12-jarige zonder HTTP-indiening of browseropslag, en het weigeren van een uitsluitend online Nederlandse TTS-stem terwijl lezen bruikbaar blijft.
- De tijdelijke runtime op loopbackpoort 3019 is na de test gestopt.

Webvoorlezen gebruikt nu dezelfde privacybeperking als het native uitgangspunt: een stem moet `localService === true` melden, de profielnaam wordt Avonturier en er is geen online fallback. Dit vertrouwt de lokale browser-/apparaatclassificatie en is geen onafhankelijke audit van een stemleverancier.

## Onafhankelijke securityreview

Gelezen: de lifecycle-migratie, `lib/lifecycle/worker.ts`, de service-adapter, `lib/server/parent.ts`, Authafronding, `src/cloudSync.ts`, `src/CloudBoundary.tsx`, profielopslag en activiteitqueue.

| Onderdeel | Bevinding / opvolging |
| --- | --- |
| AVG-zaak afronden | Gevonden: `complete` kon een geverifieerde wiszaak voltooien voordat uitvoering plaatsvond. Teruggekoppeld en door backendagent hersteld: parentzaak koppelt aan deletion-operation/receipt, worker voltooit alleen na bewezen Auth- en Storage-afwezigheid; childzaak voltooit in atomische scrub. Gerichte bypass-tests toegevoegd en onafhankelijk geslaagd |
| Consentintrekking op een ander apparaat | Gevonden: een succesvolle GET zonder het verwijderde profiel kon bij open dialoog worden uitgesteld; hydrate behield oude childkeys/recoverydata. Aan UI/root teruggekoppeld voor onmiddellijk opschonen en remount zodra een verwijderd profiel wordt gezien, zonder andere gezinsscope te wissen. Finale clienttests moeten de herstelactie bewijzen |
| Definitief verdwenen Auth-identiteit | Gevonden: een 401 kon als gewone aanmeldfout de apparaatcache behouden. Aan UI/root teruggekoppeld voor uitwissen bij definitieve intrekking of passende harde authfout; finale test moet waarborgen dat een na de wisdeadline terugkerend apparaat geen verwijderde gegevens bewaart |
| Sessietijdlimiet | Aandachtspunt: een nog bestaande `auth.sessions`-rij alleen bewijst niet dat `not_after` nog niet is verstreken. Backend gevraagd de werkelijke kolom en afwijzing van een verlopen sessie met nog geldig JWT te controleren |
| 30 dagen en expliciet herstel | Dezelfde lifecycle-rij wordt voor restore/activiteit/wistaak vergrendeld. Op of na de deadline weigert restore; een normale login doet geen restore. Geen bypass gevonden in de gelezen transactielogica. Echte contention met meerdere hosted verbindingen afzonderlijk bewijzen |
| 90 dagen en activiteit | Server-UTC, beperking van offline tijd, dedupe op account/event-ID en geen activiteit bij alleen snapshotopslag/refresh. Geen oude-event-bypass gevonden. Automatische inactiviteit staat standaard uit tot staging-/overgangscontrole |
| Oude toegangstokens | Lifecycle/RLS controleren actuele bevestigde Auth-identiteit en huidige sessie; delete trekt sessies in. Geen autorisatie uit user_metadata. Clientpurge hoort daar apart bij |
| Worker en providerstoring | Vaste RPC-allowlist, unieke leases, actuele context, Storage vóór Auth, afwezigheid vóór ontvangstbewijs. Mailbody/sender/recipient bevroren vóór providerverzoek; stabiele idempotencykey, geen blinde retry voorbij het providerwindow. Geen onvoltooide providerstap als uitgevoerd aanmerken |
| Secret- en doelscope | Alleen service-only Edge-adapter gebruikt automatisch runtimecredential. HTTP accepteert geen ontvanger, klok, parent-ID, objectpad of jobdoel. Vault-verificatie vereist. Geen secretoverdracht naar build/browser/GitHubvariabelen |

## Onafhankelijk uitgevoerde backendchecks

- `node scripts/lifecycle-db-check.mjs`: geslaagd, inclusief verse Auth/sessie, versie-onboarding, gezinsisolatie, consent/CAS en resurrectionweigering, grenswaarden 30/90, AVG-kindscope, kalendermaand en echte Auth-/Storage-receiptvoorwaarden.
- `node --test scripts/lifecycle-worker.test.mjs`: **18 geslaagd**; onder meer verkeerde actorcontext, afgebroken providerack, bevroren retrybytes, onvoltooide Storage/Auth, geanonimiseerde foutcodes en eigen stagingmail.
- `node scripts/parent-activity-check.mjs`: geslaagd; geen passieve activiteit, stabiele offline-ID/tijd, ownerbinding, oude events en intrekking.

PGlite voert de SQL/RLS en transacties uit, maar is geen proef met echte gelijktijdige Supabase-verbindingen. Een providerfake is geen echte Authdelete of mailbezorging. Hosting-/backuptermijnen, supportmailboxinrichting en verwerkersafspraken blijven de expliciete open feiten uit de DPIA/gegevensstroominventaris; ze worden niet door deze tests ingevuld.

## Vervolgcontrole en afgeschermde supportinterface

De rootagent heeft op 22 november 2026 de ouder-lifecycle-migratie op **beide** juiste Supabase-projecten toegepast: staging `tlwfpivafcokcjyjwgmq` en production `aptprpkosqctwrzeetgs`. De daarbij uitgevoerde alleen-lezen controle bevestigt volgens de rootrapportage nul Auth-gebruikers, overeenkomende documenthashes en gecontroleerde PostgREST-/functieprivileges. Dit is een bronverklaring van de uitvoerende rootagent, geen door de juridische subagent zelfstandig uitgevoerde hosted-query. Er is op dat controlemoment nog **geen scheduler** voor de onderhoudsworker aangesloten. Alleen migratie en Edge-code plaatsen bewijst dus nog geen automatische uitvoering van deadlines.

De aanvaardingscatalogus verwijst naar deze exact gegenereerde UTF-8-documentbytes:

- Voorwaarden `2026-11-22`: `8da71baa717f1e98b393320532670b4ebbddacbd390a14dba3c4cc144b394840`.
- Privacyverklaring `2026-11-22`: `97673d3103443115097def26e20e6c677650dcb760d095de900ae3c5c5961cb7`.

De privacytekst is vóór enige aanvaarding gecorrigeerd naar de door de eigenaar bevestigde **Supabase custom SMTP → Resend**-route. De afzonderlijke applicatie-/lifecyclemail via de Resend-API vereist zijn eigen actieve Vault-configuratie. Het plaatsen van een Send Email Hook is daarvoor geen vervanging en er wordt geen hook geactiveerd. De door root ingerichte eigen Fabelpad-journaldnamespace gebruikt 29 dagen retentie met maximaal 12 uur per journalbestand; overige hostlogs zijn niet gewijzigd. De privacytekst noemt voor deze eigen applicatielogs de bovengrens van 30 dagen. Het feitelijke maximum van provider-/PITR-/VPS-back-ups en de supportmailbox blijft afzonderlijk te bevestigen.

`/studio/privacy` maakt de afgeschermde AVG-procedure bruikbaar: alleen actieve beheerders openen zaakmetadata; ontvangst met werkelijke datum, maximaal 100 zaken per expliciete pagina, later veilig koppelen van een aanvankelijk onbekend onderwerp, proportionele verificatie, gemotiveerde en tijdig meegedeelde verlenging, geverifieerde beperkte wisuitvoering en overige zaakafronding. Het vaste ouder-/kindbereik kan bij het koppelen niet worden verwisseld. De interface houdt ontvangst- en uitkomstmail handmatig in de beveiligde supportmailbox en claimt geen automatische mailboxkoppeling. Berichtinhoud, kindnamen en mailadressen worden niet in de appzaakvelden of browseropslag gezet.

Nieuwe `tests/browser/privacy-admin.spec.ts` bevat drie gerichte scenario’s voor de beheergate, minimale kindzaak → onderwerp koppelen → verificatie → scoped wissing met aparte bevestiging, en paginering plus opschonen bij een verlopen beheersessie. Die scenario’s worden door root bij de finale schone gezamenlijke build uitgevoerd; deze aanvulling claimt daarvan nog geen resultaat.

Onafhankelijke bronreview van `lib/server/privacy.ts`: elke route valideert de Supabase-gebruiker, actieve accountstatus en databasebeheerrol vóór de vaste RPC; wijzigingen vereisen dezelfde actor, JSON-/oorsprongscontrole en exacte inputallowlists. Een verlenging accepteert alleen vaste redenkeuzes en expliciete bevestiging dat kennisgeving is gedaan. Technische onderwerp-ID’s geven geen bevoegdheid en er is geen servicecredential in Next/browser. Geen nieuwe blokkerende bevinding in deze BFF-review.

De eerder genoemde actuele-sessieverfijning is inmiddels in de SQL aangebracht (`auth.sessions.not_after`), en de actuele voorwaardenversie wordt ook door de directe databasegezinsgates gecontroleerd. Dit sluit de via een andere client te omzeilen versiecontrole bij een toekomstige voorwaardenwissel af. De clientpurgebevinding heeft een aparte UI-/sync-opvolging en wordt in de finale gezamenlijke regressietests gecontroleerd.


Aanvullende livecontrole na de migraties: beide projecten hebben nu de minuuttaak `fabelpad-account-maintenance`, met eigen projectgebonden HMAC, korte geldigheid en eenmalige nonce. De expliciete proef gaf in beide projecten HTTP 200, `completed: 0` en `deferred: 0`. Er zijn nog steeds nul gebruikers, beheerders, gezinnen en API-mailconfiguraties; er is niets gewist of gemaild. Automatische 90-dagenwissing blijft uit. De `pg_net`-extensie staat na een gecontroleerde herinstallatie zonder bestaande netwerktaken in `extensions`; security advisors geven 0 WARN/ERROR en 13 verklaarde INFO-meldingen voor afgeschermde private tabellen. Het [nieuwe controlebewijs](deploy-evidence/google-legal-lifecycle-2026-11-22.json) bevat de precieze migratiehashes en grenzen van deze proef.
