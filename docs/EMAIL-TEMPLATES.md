# Fabelpad — OTP en alle service-e-mails

Gecontroleerd op **22 november 2026**. Templateversie: `fabelpad-2026-11-22`.

De bron voor zowel Supabase Auth als applicatieberichten is [`lib/email/templates.ts`](../lib/email/templates.ts). De e-mails gebruiken dezelfde crèmekleur, bosgroen en gele accenten als Fabelpad. Tabellen, inline CSS, leesbare systeemlettertypen en een tekstalternatief houden berichten bruikbaar zonder externe lettertypen of afbeeldingen. Er worden geen trackingpixels geladen. Staging krijgt een zichtbare testmarkering en `[TEST]` in het onderwerp.

## Welke omgeving gebruiken

| Omgeving | GitHub environment | Supabase-account volgens eigenaar | Te gebruiken bestanden |
| --- | --- | --- | --- |
| Staging | `staging` | `fabelpad` | `supabase/email-templates/staging/` |
| Productie | `production` | `Duindorpdoet` | `supabase/email-templates/production/` |

Controleer vóór opslaan of de projectreferentie bij de `NEXT_PUBLIC_SUPABASE_URL` van diezelfde GitHub environment hoort. Accountnamen alleen identificeren geen Supabase-project. Gebruik nooit een productie-Resendkey, hooksecret of afzender als tijdelijke stagingconfiguratie.

De vier bestaande GitHub-variabelen blijven `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `NEXT_PUBLIC_SUPABASE_URL`. De API-mailinstellingen worden afgeschermd per Supabase-project in Vault beheerd; ze worden geen aanvullende GitHub-variabelen of publieke Next.js-waarden. Het technische configuratieoverzicht hieronder hoort alleen bij de niet-actieve alternatieve hookroute.

## Actieve routes: Auth via SMTP, serviceberichten via API

De eigenaar heeft **Supabase Auth → Custom SMTP → Resend** ingericht. Neem de Auth-HTML en onderwerpen uit de juiste omgevingsmap over in Authentication → Email Templates. Dezelfde opmaakbron wordt gebruikt voor de applicatieservicemails, die hun eigen Resend API-key en instellingen uit Vault krijgen na configuratie in Beheer → E-mail.

Voor latere Auth-tekstwijzigingen biedt Beheer → E-mailtemplates een HTML-download en het exacte onderwerp voor het betreffende Supabase-scherm. Neem beide handmatig over in hetzelfde project. Opslaan in Fabelpad wijzigt de Supabase SMTP-templates niet automatisch. Service-templates gebruiken de opgeslagen wijzigingen rechtstreeks. SMTP-credentials of API-keys horen nooit in een HTML-export.

## Alternatieve Send Email Hook — niet actief in deze release

De voorbereide maar voor deze SMTP-inrichting niet ingeschakelde Edge Function [`auth-email`](../supabase/functions/auth-email/index.ts) gebruikt de gedeelde renderer en [`lib/email/resend.ts`](../lib/email/resend.ts). Een ingeschakelde Send Email Hook neemt de verzending over van SMTP. De HTML in de Supabase Dashboard-template wordt dan niet gebruikt voor de actieve verzending; de bijgeleverde Dashboard-bestanden zijn export van dezelfde bron en kunnen daar eveneens worden ingesteld. Alleen een Dashboard-template aanpassen wijzigt dus geen actieve hookmail. [Supabase Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).

| Edge-secret/configuratie | Bron en invoer |
| --- | --- |
| `RESEND_API_KEY` | Eigen Resend-sleutel van deze omgeving, met verzendrecht op de geverifieerde afzender. Alleen veilig in Supabase Edge Secrets plaatsen. |
| `SEND_EMAIL_HOOK_SECRET` | Uniek geheim van de Send Email Hook van dit project, in het formaat `v1,whsec_…`. Dezelfde waarde aan beide kanten van deze hook; nooit delen tussen projecten. |
| `FABELPAD_EMAIL_FROM` | Productie: `Fabelpad <geverifieerd-adres>`; staging: `Fabelpad Staging <geverifieerd-adres>`. Het adres moet onder een daadwerkelijk geverifieerd Resend-domein vallen. |
| `FABELPAD_EMAIL_REPLY_TO` | Openbaar supportadres: `support@fabelpad.nl`. Mailboxontvangst blijft een aparte controle. |
| `FABELPAD_APP_ORIGIN` | Exact de HTTPS-origin uit deze GitHub environment, zonder pad, query of afsluitende slash. Moet overeenkomen met de Auth Site URL van hetzelfde project. |
| `FABELPAD_ENVIRONMENT` | `staging` of `production`, passend bij dit Supabase-project. |

Resend moet het afzenderdomein eerst verifiëren. Neem DNS-waarden over uit het eigen Resend-dashboard; verzin geen SPF-, DKIM- of MX-records en overschrijf geen bestaande mailrouting. Schakel open- en kliktracking uit voor deze transactionele route. [Resend-domeinen](https://resend.com/docs/dashboard/domains/introduction).

Voor de hook moet JWT-verificatie **uit** staan: Auth heeft op dit moment nog geen gebruikers-JWT. De endpoint blijft beschermd door verplichte verificatie van Standard Webhooks v1/HMAC-SHA256, een uniek projectsecret, een tijdvenster van vijf minuten en binding aan de eigen Site URL. De implementatie begrenst de ruwe JSON-body tot 20 KiB, laat alleen bekende acties toe en logt geen payload, ontvanger, code of hash. Ontbrekende configuratie verstuurt niets. [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks), [Standard Webhooks v1](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md).

Een Resend-aanroep en het lezen van de response hebben samen maximaal drie seconden. De twee bevestigingen bij een beveiligde e-mailwijziging gaan parallel. Een herhaalde hook gebruikt dezelfde ondoorzichtige idempotentiesleutel. Resend bewaart die sleutels 24 uur; daarna is blind herhalen niet veilig. Een API-acceptatie of hookstatus 200 is **geen bewijs van bezorging in de mailbox**. [Resend-verzend-API](https://resend.com/docs/api-reference/emails/send-email), [Resend-idempotentie](https://resend.com/docs/dashboard/emails/idempotency-keys).

## HTML toevoegen in Supabase

Voer dit eerst voor staging uit en daarna voor productie. De bestanden bevatten Go-templatevelden, geen echte codes of persoonsgegevens.

1. Open het juiste Supabase-project. Controleer de projectreferentie en stel bij **Authentication → URL Configuration** de eigen HTTPS **Site URL** in. Laat callbacks alleen toe voor de eigen omgeving.
2. Zet de **Email**-provider aan. Gebruik voor de ouderlogin OTP; de Fabelpad-login controleert de ingevulde e-mailcode. Laat de beveiligde bevestiging van beide adressen bij e-mailwijzigingen aan.
3. Open **Authentication → Notifications → Email** en vervolgens **Templates**; afhankelijk van het Dashboard heet de pagina **Email Templates**. Kies de onderstaande gebeurtenis, plak het bijbehorende volledige HTML-bestand in de code-editor en vul het onderwerp in. Klik per template op **Save**. Gebruik de stagingmap voor staging en de productionmap voor productie.
4. Zet in het onderdeel **Security notifications** de zeven meldingen aan. De templates schakelen geen wachtwoord-, telefoon-, OAuth- of MFA-functies in: zo'n melding verschijnt uitsluitend wanneer de bijbehorende wijziging echt plaatsvindt.
5. Behoud de bestaande **Custom SMTP**-koppeling met Resend. Activeer voor deze release geen Send Email Hook. Bewerk je Auth-teksten later in Beheer → E-mailtemplates, neem dan ook het gedownloade HTML-bestand en onderwerp over in ditzelfde Supabase-scherm; SMTP leest de Vault-editorinstellingen niet automatisch.

De onderwerpkolom hieronder geldt voor productie. Zet voor staging exact `[TEST] ` ervoor. Dezelfde onderwerpen en de exacte Management API-veldnamen staan in [`manifest.json`](../supabase/email-templates/manifest.json). [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).

| Dashboard-template | HTML-bestand in de eigen omgevingsmap | Onderwerp |
| --- | --- | --- |
| Confirm sign up | `signup.html` | Bevestig je Fabelpad-account |
| Invite user | `invite.html` | Je bent uitgenodigd voor Fabelpad |
| Magic link or OTP | `magiclink.html` | Je inlogcode voor Fabelpad |
| Change email address | `email_change.html` | Bevestig je e-mailadres voor Fabelpad |
| Reset password | `recovery.html` | Herstel de toegang tot Fabelpad |
| Reauthentication | `reauthentication.html` | Bevestig dat jij het bent bij Fabelpad |
| Password changed | `password_changed_notification.html` | Je Fabelpad-wachtwoord is gewijzigd |
| Email address changed | `email_changed_notification.html` | Je Fabelpad-e-mailadres is gewijzigd |
| Phone number changed | `phone_changed_notification.html` | Je Fabelpad-telefoonnummer is gewijzigd |
| Sign-in method linked | `identity_linked_notification.html` | Een inlogmethode is gekoppeld aan Fabelpad |
| Sign-in method removed | `identity_unlinked_notification.html` | Een inlogmethode is verwijderd uit Fabelpad |
| Verification method added | `mfa_factor_enrolled_notification.html` | Een verificatiemethode is toegevoegd aan Fabelpad |
| Verification method removed | `mfa_factor_unenrolled_notification.html` | Een verificatiemethode is verwijderd uit Fabelpad |

De onderwerpen bevatten bewust geen OTP. De code staat alleen in de berichtinhoud. **Confirm sign up** en **Magic link or OTP** bevatten `{{ .Token }}`. Beide zijn nodig: een eerste aanvraag kan eerst een account aanmaken. Vervang die code niet door uitsluitend een magic link. De plakbare templates gebruiken alleen gedocumenteerde Supabase-velden; er worden geen vrij bewerkbare metadata als HTML ingevoegd.

Invite, recovery en e-mailwijziging verwijzen naar `/auth/confirm` met de eenmalige hash en een beperkt type. Deze pagina vraagt om een bewuste bevestiging; een GET van een mailfilter verbruikt de code niet. Wachtwoordherstel is geen noodzakelijke ouderloginroute: voor de actieve wachtwoordloze login vraagt de gebruiker een nieuwe OTP aan. Gebruik de hersteltemplate niet als bewijs dat de app een scherm voor het instellen van wachtwoorden heeft.

Bij beveiligde e-mailwijziging krijgt elk adres zijn eigen code. De Supabase-hookvelden voor de hashes hebben een historische omkering; de renderer koppelt `token` aan `token_hash_new` voor het huidige adres en `token_new` aan `token_hash` voor het nieuwe adres. De melding na voltooiing gaat naar het **oude** e-mailadres. [Supabase mapping](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook#email-change-behavior-and-token-hash-mapping), [Supabase-mailer](https://github.com/supabase/auth/blob/master/internal/mailer/templatemailer/templatemailer.go).

## Dezelfde opmaak voor applicatieberichten

Applicatiecode gebruikt `renderServiceEmail()` en verstuurt het resultaat via `sendFabelpadEmail()` vanuit een bevoegde server/worker. Ondersteunde berichten zijn `welcome`, `account-deletion-requested`, `account-deleted` en een getypeerd `service-notice`. Er is geen vrije HTML-invoer. Teksten worden ge-escaped; actieknoppen blijven binnen de eigen HTTPS-origin. Afzonderlijke kindprofielen krijgen geen eigen loginmail.

Dit levert de gedeelde berichtopmaak en het Resend-transport op. De lifecycle-worker gebruikt een duurzame outbox voor de geïmplementeerde servicegebeurtenissen, met event-ID, begrensde retries en opruiming. Een ontvangstbevestiging volgt alleen op een vastgelegd verzoek; een verwijderbevestiging pas na bewezen verwijdering. De aparte API-key voor deze berichten moet nog veilig via Beheer worden gekoppeld en de bezorging moet worden getest. Automatische inactiviteitswissing blijft uit tot waarschuwingen en overgangscontrole zijn geaccepteerd. Auth-mails blijven via Supabase Custom SMTP lopen; de Send Email Hook is niet actief.

## Teksten wijzigen in Beheer

Op **Beheer → E-mailtemplates** (`/studio/email/templates`) staan alle 13 Auth- en 4 servicetemplates met onderwerp, kop, introductie, voorbeeld en standaardtekstherstel. **Beheer → E-mail** beheert de gezamenlijke afzender, antwoordadressen en voettekst. Zie [EMAIL-BEHEER.md](EMAIL-BEHEER.md) voor opslag, testmail, sleutelrotatie en eerste login. Applicatieserviceberichten lezen de eigen Vault-configuratie. Auth-teksten moeten na een wijziging afzonderlijk als HTML en onderwerp naar de Supabase-dashboardtemplates worden overgenomen; de eigenaar heeft de huidige standaardtemplates al overgenomen.

## Vormgeving en broncode controleren

Pas bij een stijl- of tekstwijziging uitsluitend de gedeelde bron aan en genereer de exports opnieuw:

```bash
node scripts/email/export-templates.mjs
node scripts/email/export-templates.mjs --check
node --test scripts/email/*.test.mjs
```

Er zijn 26 plakbare HTML-bestanden en vier lokale vormgevingsvoorbeelden met synthetische inhoud in `supabase/email-templates/previews/`. `production-otp.html` bevat `000000`; dit is geen geldige inlogcode en er wordt niets verzonden.

De lokale tests controleren onder andere signup/login-OTP, de twee afzonderlijke e-mailwijzigingen, ontvangers, onbekende acties, HTML-injectie, onbetrouwbare redirects, handtekening/tijdvenster, omgevingsbinding, herhaalde hookverzoeken, parallelle verzending, foutafhandeling en de totale timeout. Een Deno-typecontrole is mogelijk met:

```bash
deno check --config supabase/functions/auth-email/deno.json supabase/functions/auth-email/index.ts
```

Voer na de veilige inrichting per omgeving deze acceptatie uit:

1. Vraag één OTP aan voor de bevoegde beheerdersmailbox. Controleer de juiste afzender, het juiste onderwerp, Fabelpad-opmaak en op staging de testmarkering.
2. Controleer de ontvangst in de mailbox zelf. Bekijk zo nodig in het afgeschermde Resend-dashboard de afleverstatus; kopieer geen berichtinhoud of codes naar het project.
3. Open de gecontroleerd vrijgegeven eigen staging-HTTPS-route `/inloggen`. Kies bij het eerste account **Ouderaccount maken**; gewone login maakt geen nieuw account aan. Gebruik voor het eerste beheeraccount `info@dgwebservices.nl`, bevestig de zes-cijferige code en rond de ouderonboarding af. Controleer daarna gezinssessie, studio, uitloggen en opnieuw inloggen. Een gewone ouder mag geen beheerrechten krijgen. Er is geen aparte `/registreren`-route. De oude zelfstandige terminalproef in de alternatieve hookhandleiding vereist een actieve hook en geldt niet voor de huidige SMTP-route; activeer daarvoor geen hook. Herhaal de aanmeld-/mailacceptatie afzonderlijk op productie vóór algemene ingebruikname.
4. Controleer dat een verkeerde en verlopen code geen sessie opleveren; te snel opnieuw aanvragen toont een begrensde foutmelding.
5. Controleer gebruikte bevestigingslinks, supportmailbox en privacybestemming. Bij een dubbele e-mailwijziging mogen de twee codes niet verwisseld zijn.

Zonder werkende projecttoegang, een geverifieerd Resend-domein, de passende API-key en bevestigde mailboxontvangst is uitsluitend de lokale implementatie getest. Claim dan geen werkende live e-mailaflevering.
