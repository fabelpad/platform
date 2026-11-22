# E-mail beheren in Fabelpad

De beheeromgeving heeft twee afzonderlijke pagina's. Iedere omgeving bewaart haar eigen instellingen in het eigen Supabase-project; een wijziging op staging wijzigt productie niet.

| Pagina | Inhoud |
| --- | --- |
| `/studio/email` — Beheer → E-mail | Resend-koppeling, afzendernaam en -adres, antwoordadres, supportadres, gezamenlijke voettekst, domeincontrole en testmail |
| `/studio/email/templates` — Beheer → E-mailtemplates | Alle 17 templates; onderwerp, kop, introductietekst, voorbeeld, standaardtekst herstellen en Auth-HTML exporteren voor Supabase custom SMTP |

Alleen een ingelogde, bevestigde ouder met een actuele databasebeheerrol heeft toegang. Het eerste beheerdersadres is **info@dgwebservices.nl**. De rol ontstaat na een echte bevestiging via Supabase, nooit doordat een browser zelf een beheerkenmerk opgeeft.

## Eerste inrichting

De eigenaar heeft de OTP-route ingericht als **Supabase Auth → custom SMTP → Resend**, met zescijferige codes. Behoud die inrichting. Er wordt geen Send Email Hook geactiveerd. De eerste login werkt via deze SMTP-route en staat los van de Resend-API-koppeling op deze beheerpagina. Controleer de eigen Supabase Site URL, redirects en e-mailinstellingen per omgeving; deel geen key, token of OTP in chat. De Resend-API voor applicatieserviceberichten krijgt afzonderlijk een key via Beheer → E-mail.

Open op staging **https://staging.fabelpad.nl/inloggen**. Kies bij een nieuw account eerst **Ouderaccount maken**, gebruik **info@dgwebservices.nl**, bevestig de zescijferige code en rond de verklaringen en ouderonboarding bewust af. Gewone login maakt geen nieuw account aan; een aparte `/registreren`-route bestaat niet. Open vervolgens **Beheer → E-mail**. De staging-HTTPS-route is op 22 november 2026 gecontroleerd geactiveerd. Productie volgt na stagingacceptatie en haar afzonderlijke publieke vrijgave. De oude terminalproef uit de alternatieve hookhandleiding vereist die hook en hoort niet bij de huidige SMTP-route. Test de bestaande SMTP-route via de huidige browserflow; zet hiervoor geen hook aan.

1. Controleer bovenaan de omgeving en website. Gebruik voor staging en productie hun eigen Resend-key, bij voorkeur beperkt tot verzenden vanaf het Fabelpad-domein.
2. Vul de afzendernaam, het geverifieerde afzenderadres, antwoordadres en supportadres in. `noreply@fabelpad.nl` is alleen bruikbaar nadat dat domein en de verzendrechten zijn geverifieerd.
3. Vul de Resend-key in het wachtwoordveld in. Een opgeslagen key wordt nooit teruggestuurd of weergegeven. Laat het veld later leeg om de huidige key te behouden.
4. Schakel in **Resend → Domains → het afzenderdomein** open- en kliktracking uit. Bij een key met alleen verzendrechten kan Fabelpad de domeininstellingen niet uitlezen. Controleer ze dan zelf in Resend en vink de expliciete bevestiging aan. Die verklaring is geen zelfstandige API-controle. Een ongeldige key of aantoonbaar ingeschakelde tracking kan hiermee niet worden overgeslagen.
5. Klik **Opslaan en testmail versturen**. Het bericht gaat uitsluitend naar het bevestigde adres van de ingelogde beheerder. Pas nadat Resend de verzending accepteert, worden key en instellingen samen opgeslagen. Controleer zelf ook de inbox en spammap: API-acceptatie bewijst geen bezorging.
6. Open desgewenst **Domeinstatus vernieuwen**. Met voldoende domeinleesrechten verschijnen de DNS-records en trackingstatus van uitsluitend het ingestelde afzenderdomein. Fabelpad wijzigt geen DNS, Resend-abonnement, limiet of trackinginstelling. Bij beperkte keyrechten controleer je de status in Resend zelf.
7. Herhaal dit in de andere omgeving. Een werkende staging-koppeling bewijst geen werkende productie-koppeling.

Opslaan en losse testmails hebben een blijvende limiet van één testaanvraag per beheerder per 30 seconden. Een aanvraag-ID kan gedurende 24 uur niet opnieuw worden gebruikt. Een verlopen sessie, ingetrokken beheerrol, geweigerde testmail of gelijktijdige wijziging vervangt geen werkende configuratie.

## Templates aanpassen

Open **Beheer → E-mailtemplates** en selecteer een template in het overzicht:

| Groep | Templates |
| --- | --- |
| Toegang | Account bevestigen, uitnodiging, inlogcode, toegang herstellen, e-mailadres bevestigen, handeling bevestigen |
| Beveiligingsmeldingen | Wachtwoord gewijzigd, e-mailadres gewijzigd, telefoonnummer gewijzigd, inlogmethode gekoppeld/verwijderd, verificatiemethode toegevoegd/verwijderd |
| Service | Welkom, verwijderverzoek ontvangen, account verwijderd, algemeen servicebericht |

1. Wijzig **Onderwerp** (maximaal 160 Unicode-tekens), **Kop** (200) en **Introductie** (1.000). Dit zijn gewone teksten; HTML en headers zijn niet toegestaan.
2. Klik **Voorbeeld bijwerken** om de nog niet opgeslagen tekst te bekijken. De voorbeeldgegevens en code zijn fictief. Er wordt geen e-mail verstuurd en geen echte inlogcode opgevraagd.
3. Gebruik **Standaardtekst voor deze e-mail herstellen** om de tekst van de geselecteerde template terug te zetten. Deze wijziging is eerst een concept. Voor applicatieserviceberichten wordt ze na opslaan gebruikt; een Auth-template moet je daarnaast handmatig naar Supabase overnemen.
4. Klik **Opslaan en testmail versturen**. Ook templatewijzigingen worden pas bewaard nadat de test is geaccepteerd. Bekijk daarnaast zelf het voorbeeld van de aangepaste template: de verbindingsmail bewijst niet iedere afzonderlijke gebruikersflow.

Alle templates behouden dezelfde Fabelpad-opmaak. Inlogcodes, bevestigingslinks, beveiligingsinstructies en de zichtbare staging-testmarkering worden door de renderer toegevoegd. De applicatie gebruikt de bewaarde afzender, antwoordadressen, supportverwijzing en voettekst. Supabase custom SMTP heeft eigen afzender-/toegangsinstellingen en leest de Fabelpad-Vault-templates niet automatisch. Een export bevat de actuele supportverwijzing en voettekst; neem die bewust over. Het bestaan of aanpassen van een template schakelt geen functie of automatische verzending in.

De pagina bewaart alleen de eigen gewijzigde velden/templates boven op de laatst opgehaalde instellingen. Is hetzelfde veld intussen door een andere beheerder gewijzigd, dan blijft jouw concept in het venster staan en moet je eerst het verschil beoordelen. De database weigert ook een gewijzigde revisie tussen ophalen en opslaan. Een kandidaatbuild is niet nodig voor nieuwe applicatiemailteksten: nieuwe serviceberichten lezen de opgeslagen configuratie. Een reeds klaargezette duurzame verzending behoudt haar vastgelegde inhoud voor veilige retries. Auth-berichten via custom SMTP veranderen pas na het handmatig opslaan van onderwerp en HTML in het eigen Supabase-project.

## Auth-templates handmatig naar Supabase overnemen

1. Open **Beheer → E-mailtemplates** en kies een accountmail, bijvoorbeeld **Inlogcode**. Pas de gewone teksten aan. Je hoeft geen API-key in te voeren om een template te downloaden.
2. Onder **Overnemen in Supabase** staat het volledige **Onderwerp voor Supabase**, inclusief de vaste `[TEST]`-markering voor staging. Gebruik dit onderwerp in het juiste Supabase-project.
3. Klik **HTML downloaden voor Supabase**. De export gebruikt de nu zichtbare editorwaarden, ook als je die nog niet in Fabelpad hebt opgeslagen. Downloadnamen bevatten uitsluitend omgeving en vaste template-ID, bijvoorbeeld `fabelpad-staging-magic_link.html`.
4. Open de download als tekst in je editor. Ga in het bijbehorende Supabase-project naar **Authentication → Email Templates → de op de pagina getoonde templatenaam**. Plak de volledige HTML en het onderwerp in de betreffende velden en bewaar ze daar.
5. Laat vaste Go-velden zoals `{{ .Token }}`, `{{ .TokenHash }}` en `{{ .SiteURL }}` in de export staan. Ze bevatten geen echte inlogcode. De vrije editorvelden zijn gewone tekst; daarin voer je geen eigen Go-expressies in.
6. Controleer de betreffende echte accountactie. Herhaal dit afzonderlijk voor staging en productie en voor iedere gewijzigde Auth-template. Bewaren in Fabelpad wijzigt Supabase niet vanzelf. Laat de bestaande custom SMTP-route staan en activeer geen Send Email Hook.

Serviceberichten hebben deze downloadknop niet: die worden rechtstreeks door de applicatie via de Resend-API gerenderd. De vaste standaardexport onder `supabase/email-templates/` blijft beschikbaar en verandert niet door een browserdownload.

## Opslag, sleutelrotatie en herstel

De API-key staat versleuteld in **Supabase Vault** van het eigen project. De browser en de Next.js-server krijgen de opgeslagen key niet terug. Alleen de Edge-runtime kan de beperkte service-only configuratiefunctie gebruiken. De automatische Supabase-servicecredential blijft in de Edge-runtime; hiervoor wordt geen extra GitHub-variable of applicatiesecret toegevoegd.

De Vault-configuratie is leidend voor de **Resend-API van applicatie-/lifecycleberichten**, inclusief afzender en teksten. Een fout bij lezen uit de database valt niet terug op een oude key. Alleen als nog geen Vault-record bestaat kan een expliciet ingerichte legacy Edge-bootstrap als fallback dienen; een werkende SMTP-koppeling vult die niet vanzelf in. Supabase Auth blijft de afzonderlijk ingerichte custom SMTP en de daar opgeslagen Auth-templates gebruiken. Site URL, redirects, OTP-lengte/verlooptijd, SMTP-toegang en Supabase-authlimieten blijven technische Supabase-instellingen buiten deze pagina. Gebruik de oude configuratietool niet om de werkende SMTP-route door een Send Email Hook te vervangen.

Voor rotatie: maak eerst de nieuwe beperkte key in Resend, vul die in Beheer in, sla op en controleer de echte API-testmail en een nieuw applicatieservicebericht. Een OTP-login test de afzonderlijke SMTP-route. Trek de vorige API-key pas in nadat de nieuwe route werkt. Bij een geweigerde test blijft de vorige configuratie behouden. Bij een later opgemerkt tekstprobleem herstel je de standaardtekst of voer je de vorige juiste tekst opnieuw in en sla je die met een test op. Een approllback draait Vault-, Auth- of mailinstellingen niet automatisch terug. Herstel geen oude key die bij Resend al is ingetrokken.

## Verificatie en grenzen

`pnpm check:email` controleert de renderer, 17 previews, handtekeningen, Resend-transport, beheer-API, echte PostgreSQL-grants/CAS/testlimieten en configuratietool met synthetische gegevens. `pnpm check:backend` controleert daarnaast de bestaande familie/content/OTP-contracten. Browsertests controleren beide pagina's, bewerken, conflicten, sessieverlies en mobiel gebruik. De lokale Vault-stub test de API-/rechten-grens, niet cryptografie; op Supabase wordt de bestaande Vault-extensie gebruikt.

Werkelijke bezorging, DNS, keyrechten, eerste beheerderlogin en de juiste Supabase Auth-configuratie vereisen nog de eigen providergegevens en mailboxcontrole. De concrete uitvoeringsstatus staat in [STAGING-PRODUCTION-STATUS.md](STAGING-PRODUCTION-STATUS.md). De pagina's worden pas op de VPS zichtbaar nadat de afzonderlijk goedgekeurde apprelease is geactiveerd.

Officiële bronnen, gecontroleerd 22 november 2026: [Supabase Vault](https://supabase.com/docs/guides/database/vault), [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Resend API-keys](https://resend.com/docs/dashboard/api-keys/introduction), [Resend domein ophalen](https://resend.com/docs/api-reference/domains/get-domain), [Resend verzending](https://resend.com/docs/api-reference/emails/send-email).
