# Fabelpad — actuele status staging en production

Controledatum: **22 november 2026**. De eigenaar heeft wijzigingen en uitrol in beide Fabelpad-omgevingen toegestaan. De onderstaande status onderscheidt providerconfiguratie, getest gedrag en werkelijk uitgerolde releases. Oude controlebestanden blijven historische momentopnamen.

## Vastgesteld

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment; uitsluitend de vier afgesproken variabelen | `staging` | `production` |
| Supabase-account / project | **fabelpad** / `tlwfpivafcokcjyjwgmq` | **Duindorpdoet** / `aptprpkosqctwrzeetgs` |
| Bevestigde app-origin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Publieke Supabase Auth-settings | E-mail en Google aan; Auto Confirm uit | E-mail en Google aan; Auto Confirm uit |
| Werkelijke SMTP-inrichting volgens eigenaar | Resend geconfigureerd; OTP met 6 cijfers | Resend geconfigureerd; OTP met 6 cijfers |
| Lifecycle-migratie `20261122172905` | Toegepast | Toegepast |
| Auth-gebruikers bij laatste controle | 0 | 0 |
| Beheerderbootstrap | `info@dgwebservices.nl`; echte bevestiging en serveronboarding vereist | Dezelfde mailbox, afzonderlijke identiteit in dit project |
| Broncontent | 13 verhalen behouden | 13 verhalen behouden |
| Beheer van Resend API en templates | Eigen Vault-configuratie; nog een API-key voor applicatieservicemails nodig | Eigen Vault-configuratie; nog een API-key voor applicatieservicemails nodig |
| Eigen runner | Repositoryscope `fabelpad/platform`, geregistreerd; ID 21 | Repositoryscope `fabelpad/platform`, geregistreerd; ID 22 |
| Edge-beheer / accountworker | `email-admin` v2 / `account-maintenance` v1 actief | `email-admin` v2 / `account-maintenance` v1 actief |
| Runnerdienst / GitHub-status | Inactive / offline | Inactive / offline |
| Eigen appservice / loopbackpoort | Inactive; `127.0.0.1:4188` | Inactive; `127.0.0.1:4189` |
| Doelkandidaat / actieve release | Geen | Geen |

De publieke Auth-settings zijn in beide projecten gecontroleerd op **22 november 2026, 17:50:30 UTC** (`2026-11-22T17:50:30.645511+00:00`). Ongesigneerde aanvragen naar de beheer- en accountworkerfunctie worden in beide projecten met HTTP401 geweigerd; deze controle verzond geen gebruikersmail.

De bestaande drie applicatiemigraties zijn aangevuld met de ouder-, toestemmings- en verwijderlevenscyclus. Nieuwe accounts krijgen pas gezinsrechten na de afzonderlijke volwassen-ouderverklaring en aanvaarding van de actuele voorwaarden. Iedere online kindomgeving vereist daarnaast eigen toestemming. Gewone login herstelt een account met een verwijderaanvraag nooit automatisch. Zie [LIFECYCLE-IMPLEMENTATIE.md](LIFECYCLE-IMPLEMENTATIE.md).

De registratie van beide runners is nu voltooid met toegang uitsluitend voor de eigen repository. De eerdere ontbrekende organisatie-/runnergroeprechten zijn **geen actuele blokkade**. Registratie bewijst nog niet dat de runner online is of dat een doelbuild is geslaagd.

## Auth-mail en applicatieservicemails zijn twee routes

**Auth-mail:** de door de eigenaar ingerichte **Supabase Custom SMTP via Resend** blijft de verzendroute voor e-mail-OTP en andere Supabase Auth-mails. De openbare providerinstellingen bevestigen dat e-mail en Google zijn ingeschakeld; zij bewijzen geen mailboxbezorging of geslaagde interactieve login. De OTP-lengte van zes cijfers en de SMTP-inrichting zijn door de eigenaar bevestigd. Activeer of vervang hiervoor **geen Send Email Hook**. De eerder gedeployde `auth-email`-functie is geen reden om SMTP over te nemen.

De 31 geëxporteerde bestanden onder `supabase/email-templates/` bestaan uit 13 staging-HTML-templates, 13 productie-HTML-templates, vier synthetische previews en een manifest. De juiste HTML en onderwerpen worden in **Supabase Authentication → Email Templates** geplaatst. Bij SMTP worden deze Dashboard-templates gebruikt; wijzigingen in de Fabelpad-template-editor synchroniseren ze niet automatisch naar Supabase.

**Applicatieservicemails:** de duurzame outbox voor waarschuwingen en verwijderbevestigingen gebruikt afzonderlijk de **Resend API**. Koppel deze per omgeving via **Beheer → E-mail**, met een beperkte Resend API-key in het eigen Supabase Vault. Werkende SMTP geeft de applicatie niet automatisch die API-key. Ontbreekt die koppeling, dan blijft servicemail onvoltooid in de outbox. Beheer → E-mailtemplates beheert de gedeelde app-opmaak en serviceberichten; een API-testontvangstbewijs is geen bewijs van aflevering in de inbox.

Geen key, token, OTP of mailinhoud hoort in GitHub-variabelen, documentatie of testuitvoer. Er blijven uitsluitend `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in elk GitHub environment.

## Resterende stappen

| Stap | Wat klaarstaat | Wat nog moet worden uitgevoerd of bevestigd |
| --- | --- | --- |
| 1. Definitieve broncontrole | Google-knop onder OTP; juridische routes, serveronboarding, profieltoestemming, accountbeheer en privacyregister | Finale schone build en alle verplichte CI-controles op exact de geïntegreerde main-SHA |
| 2. Configuratiebewijs op de VPS | V2-contract met vaste omgeving/origin/project; e-mail en Google worden beide ingeschakeld in de runtime | Rootbestand per doel met de werkelijke settingscontroletijd en eigenaarverklaring; dit is geen OTP-/OAuth-acceptatie |
| 3. Doelkandidaten | Eigen paden, toolchains, beperkte runners en handmatige build-/activatieroutes | Eigen runner starten; exacte groene main-SHA op ieder doel bouwen en afzonderlijk beoordelen |
| 4. Auth-acceptatie | Bestaande SMTP en Google-configuratie, 6-cijferige UI, gezamenlijke serverafronding | Interactieve e-mail- en Google-aanmelding per omgeving, onboarding, eerste beheerderrol en account-/leesflow testen; geen account als bevestigd voorwenden |
| 5. Applicatiemail | Vault-beheer, gedeelde templates en duurzame outbox | Eigen API-key per omgeving, afzender/tracking controleren, testmail en echte outboxafhandeling verifiëren |
| 6. Achtergrondtaken | Lifecycle-migratie toegepast; scheduleruitvoering wordt afzonderlijk voorbereid | Eigen worker/token/scheduler configureren en aantoonbaar testen; automatische 90-dagenwissing blijft uit tot stagingrapport, waarschuwingen en overgangscontrole |
| 7. Productieprivacy | DPIA en feitelijke gegevensstroominventaris beschikbaar | Hosting-/supportleverancier, maximale back-upretentie, internationale toegang/doorgiftegrond en operationele bewaartermijnen onderbouwen; privacytekst en versie vóór productieaccountverwerking afronden |
| 8. Activatie en HTTPS | Gescheiden systemd-, proxy- en rollbackroutes | Gezonde kandidaat en gesloten toepasselijke gates; loopback, certificaat, publieke health en volledige gebruikersflow controleren |

De privacybeperking is inhoudelijk en wordt niet opgeheven door een groene build of toestemming om uit te rollen. Een gratis lokale leesroute kan onafhankelijk beschikbaar blijven. Er is geen betaalprovider aangesloten; betaalde checkout blijft uitgeschakeld.

## Bewijs en uitvoerinstructies

- [VPS-doelen, configuratiebewijs v2, kandidaatbouw, activatie en rollback](DG-VPS-08-TWEE-OMGEVINGEN.md).
- [Gegevensstromen en ontbrekende providerfeiten](PRIVACY-DATASTROMEN.md), [DPIA](PRIVACY-DPIA-2026-11-22.md), [afgeschermde behandeling van AVG-verzoeken](PRIVACY-SUPPORT-RUNBOOK.md).
- [Lifecycle-contract en worker](LIFECYCLE-IMPLEMENTATIE.md), [onafhankelijke controle van de gewijzigde bron](REVIEW-PRIVACY-LIFECYCLE-2026-11-22.md).
- [E-mailbeheer](EMAIL-BEHEER.md) en [HTML-exports](EMAIL-TEMPLATES.md): de actuele SMTP-keuze hierboven heeft voorrang op eerdere instructies om een hook te activeren.
- Historisch bewijs: [eerste Supabase-inrichting](deploy-evidence/supabase-2026-11-22.json), [mailbeheer](deploy-evidence/email-admin-2026-11-22.json), [hostvoorbereiding](deploy-evidence/dg-vps-08-2026-11-22.json), [eerdere lokale builds](VALIDATIE-EMAIL-BEHEER-2026-11-22.md). Deze bestanden worden niet achteraf herschreven tot bewijs van nieuwe controles.

**Nog geen doelkandidaat of apprelease geactiveerd. Geen interactieve OTP-/OAuth-acceptatie of daadwerkelijke inboxbezorging geclaimd.** De native Android-productie-app blijft een afzonderlijke lokale leesapp zonder cloudaccounts.


Actuele hostaanvulling (22 november 2026, na bovenstaande controles): de twaalf root-owned adapters zijn voor beide doelen bijgewerkt; beide eigen runnerservices zijn gestart en de repository-API meldt runners **21** en **22** als **online**. Het v2-configuratiebewijs staat voor beide doelen in de eigen `email-readiness.json`, `root:root 0600`, met providercontroletijd `2026-11-22T17:50:30.645511+00:00`. Dit is geen interactieve OTP-/Google-acceptatie. Er is hiermee geen app of publieke route geactiveerd.
