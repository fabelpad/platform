# E-mail beheren in Fabelpad

De beheeromgeving heeft twee afzonderlijke pagina's. Iedere omgeving bewaart haar eigen instellingen in het eigen Supabase-project; een wijziging op staging wijzigt productie niet.

| Pagina | Inhoud |
| --- | --- |
| `/studio/email` — Beheer → E-mail | Resend-koppeling, afzendernaam en -adres, antwoordadres, supportadres, gezamenlijke voettekst, domeincontrole en testmail |
| `/studio/email/templates` — Beheer → E-mailtemplates | Alle 17 templates; onderwerp, kop, introductietekst, voorbeeld en standaardtekst herstellen |

Alleen een ingelogde, bevestigde ouder met een actuele databasebeheerrol heeft toegang. Het eerste beheerdersadres is **info@dgwebservices.nl**. De rol ontstaat na een echte bevestiging via Supabase, nooit doordat een browser zelf een beheerkenmerk opgeeft.

## Eerste inrichting

De eerste login heeft al een werkende OTP-mailroute nodig. Voer daarom eenmaal de veilige providerinrichting uit volgens [EMAIL-CONFIGURATIE.md](EMAIL-CONFIGURATIE.md): geverifieerd Resend-domein, afgeschermde API-key, Supabase Site URL/redirects, OTP-instellingen, ondertekende Send Email Hook en bijbehorende Edge-configuratie. De workspaceconnector kan geen Auth-instellingen of Edge secrets beheren; hiervoor is de bedoelde Supabase Management-toegang of de verborgen terminaltool nodig. Deel geen key, token of OTP in chat.

Log daarna als **info@dgwebservices.nl** in en open **Beheer → E-mail**. Op een nog niet publiek geactiveerde omgeving volgen deze browserstappen pas bij de afzonderlijk vrijgegeven kandidaatproef/activatie. De zelfstandige OTP-acceptatie uit de configuratiehandleiding kan daarvoor al worden uitgevoerd.

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
3. Gebruik **Standaardtekst voor deze e-mail herstellen** om de tekst van de geselecteerde template terug te zetten. Deze wijziging wordt pas na opslaan actief.
4. Klik **Opslaan en testmail versturen**. Ook templatewijzigingen worden pas bewaard nadat de test is geaccepteerd. Bekijk daarnaast zelf het voorbeeld van de aangepaste template: de verbindingsmail bewijst niet iedere afzonderlijke gebruikersflow.

Alle templates behouden dezelfde Fabelpad-opmaak. Inlogcodes, bevestigingslinks, beveiligingsinstructies en de zichtbare staging-testmarkering worden door de toepassing toegevoegd. Een beheerder kan ze niet per ongeluk uit de HTML verwijderen. De afzender, antwoordadressen, supportverwijzing en voettekst gelden gezamenlijk. De serviceberichten zijn beschikbaar voor echte applicatiegebeurtenissen; het bestaan of aanpassen van een template schakelt geen welkomstcampagne of automatische accountverwijdering in.

De pagina bewaart alleen de eigen gewijzigde velden/templates boven op de laatst opgehaalde instellingen. Is hetzelfde veld intussen door een andere beheerder gewijzigd, dan blijft jouw concept in het venster staan en moet je eerst het verschil beoordelen. De database weigert ook een gewijzigde revisie tussen ophalen en opslaan. Een kandidaatbuild is niet nodig voor nieuwe mailteksten: de Edge-mailroute leest de opgeslagen configuratie bij het volgende geldige bericht.

## Opslag, sleutelrotatie en herstel

De API-key staat versleuteld in **Supabase Vault** van het eigen project. De browser en de Next.js-server krijgen de opgeslagen key niet terug. Alleen de Edge-runtime kan de beperkte service-only configuratiefunctie gebruiken. De automatische Supabase-servicecredential blijft in de Edge-runtime; hiervoor wordt geen extra GitHub-variable of applicatiesecret toegevoegd.

Vóór de eerste opslag in Beheer gebruikt de mailroute de bestaande bootstrapconfiguratie uit Edge Secrets. Vanaf de eerste geslaagde opslag is de Vault-configuratie leidend, inclusief afzender en teksten. Een fout bij lezen uit de database valt niet terug op een oude key. Laat de bootstrapsecret niet als schijnbare actieve key roteren via de oude configuratietool: verdere Resend-wijzigingen lopen via Beheer. Hookondertekening, Site URL, OTP-lengte/verlooptijd en Supabase-authlimieten blijven technische Supabase-instellingen buiten deze pagina.

Voor rotatie: maak eerst de nieuwe beperkte key in Resend, vul die in Beheer in, sla op en controleer de echte testmail plus een OTP-login. Trek de vorige key pas in nadat de nieuwe route werkt. Bij een geweigerde test blijft de vorige configuratie behouden. Bij een later opgemerkt tekstprobleem herstel je de standaardtekst of voer je de vorige juiste tekst opnieuw in en sla je die met een test op. Een approllback draait Vault-, Auth- of mailinstellingen niet automatisch terug. Herstel geen oude key die bij Resend al is ingetrokken.

## Verificatie en grenzen

`pnpm check:email` controleert de renderer, 17 previews, handtekeningen, Resend-transport, beheer-API, echte PostgreSQL-grants/CAS/testlimieten en configuratietool met synthetische gegevens. `pnpm check:backend` controleert daarnaast de bestaande familie/content/OTP-contracten. Browsertests controleren beide pagina's, bewerken, conflicten, sessieverlies en mobiel gebruik. De lokale Vault-stub test de API-/rechten-grens, niet cryptografie; op Supabase wordt de bestaande Vault-extensie gebruikt.

Werkelijke bezorging, DNS, keyrechten, eerste beheerderlogin en de juiste Supabase Auth-configuratie vereisen nog de eigen providergegevens en mailboxcontrole. De concrete uitvoeringsstatus staat in [STAGING-PRODUCTION-STATUS.md](STAGING-PRODUCTION-STATUS.md). De pagina's worden pas op de VPS zichtbaar nadat de afzonderlijk goedgekeurde apprelease is geactiveerd.

Officiële bronnen, gecontroleerd 22 november 2026: [Supabase Vault](https://supabase.com/docs/guides/database/vault), [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Resend API-keys](https://resend.com/docs/dashboard/api-keys/introduction), [Resend domein ophalen](https://resend.com/docs/api-reference/domains/get-domain), [Resend verzending](https://resend.com/docs/api-reference/emails/send-email).
