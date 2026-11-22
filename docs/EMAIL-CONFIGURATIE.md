# Fabelpad — Supabase Auth en Resend instellen

Gecontroleerd op 22 november 2026. De applicatie gebruikt wachtwoordloze e-mailcodes. Een code bevat **8 cijfers** en verloopt na **600 seconden**. Kinderen krijgen geen eigen e-mailadres. Google-inloggen blijft uit zolang daarvoor geen afzonderlijk gecontroleerde inrichting bestaat.

De tool in deze handleiding is voorbereid en lokaal getest met nagebootste HTTP-antwoorden. Dat bewijst geen echte bezorging, werkende productie-login of publicatie. De actuele uitvoeringsstatus en eventuele al uitgevoerde providerwijzigingen staan in het projectrunbook. Voer deze stappen uit in een eigen, vertrouwde terminal; deel geen sleutels, codes of inloggegevens in de chat.

## 1. Controleer de twee vaste doelen

| Doel | Supabase-account | Vast project | Site URL | Hook |
| --- | --- | --- | --- | --- |
| staging | fabelpad | `tlwfpivafcokcjyjwgmq` | `https://staging.fabelpad.nl` | `https://tlwfpivafcokcjyjwgmq.supabase.co/functions/v1/auth-email` |
| production | Duindorpdoet | `aptprpkosqctwrzeetgs` | `https://fabelpad.nl` | `https://aptprpkosqctwrzeetgs.supabase.co/functions/v1/auth-email` |

De tool accepteert geen andere projectref of origin. De vier GitHub-variabelen blijven in de bestaande environments `staging` en `production`: `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `NEXT_PUBLIC_SUPABASE_URL`. E-mailgeheimen horen bij Supabase Edge Functions, niet bij deze vier GitHub-variabelen of een `NEXT_PUBLIC_`-waarde.

De voorbereide functie heet `auth-email`. Controleer vóór configureren in **Supabase → Edge Functions → auth-email** dat de beoordeelde projectversie is gedeployd, de functie `ACTIVE` is en platformcontrole `verify_jwt=false` gebruikt. De functie controleert verplicht zelf de Standard Webhooks-handtekening voordat een bericht wordt verwerkt. Een ontbrekende functie moet eerst door de beheerder uit de beoordeelde broncode worden gedeployd; deze configuratietool publiceert geen functiecode.

## 2. Maak het verzenddomein en de toegang gereed

1. Open het juiste **Resend → Domains**-account. Voeg het gewenste verzenddomein toe als dat ontbreekt. Neem de DNS-records letterlijk uit Resend over; verzin geen DKIM-, SPF-, MX- of retouradreswaarden en behoud bestaande mailinrichting.
2. Controleer het domein bij Resend: status **Verified** en mogelijkheid **Sending enabled**. Schakel **Open tracking** en **Click tracking** uit. De OTP- en bevestigingsmails bevatten geen marketing- of externe meetpixels. De tool wijzigt geen DNS of Resend-domeininstellingen.
3. Kies het openbare afzenderadres. `noreply@fabelpad.nl` is een **voorstel**, bruikbaar zodra het bijbehorende domein aantoonbaar mag verzenden. De tool maakt daar voor productie `Fabelpad <adres>` en voor staging `Fabelpad Staging <adres>` van. Het antwoordadres is het bevestigde `support@fabelpad.nl`.
4. Maak bij voorkeur per doel een aparte Resend-key met **Sending access**, beperkt tot het juiste domein. Bewaar die in je eigen kluis. Met zo'n sleutel kan de tool de domeinstatus niet zelfstandig uitlezen; gebruik daarvoor hieronder de expliciete eigenaarverklaring. Een geschikte sleutel met domeinleesrechten kan de standaardcontrole wel uitvoeren. De ingevoerde Resend-key wordt als verzendsleutel in uitsluitend het gekozen project geplaatst.
5. Maak of selecteer een **Supabase persoonlijk toegangstoken** dat het gekozen project mag lezen, Auth-configuratie mag lezen/schrijven, Edge Functions mag lezen en Edge-secrets mag lezen/schrijven. Gebruik waar beschikbaar de beperkte projectscope. Productie hoort bij Duindorpdoet; staging bij het fabelpad-account. Een publishable key, secret API-key of databasewachtwoord is hiervoor geen vervanging.

Vul deze geheimen uitsluitend in de verborgen prompts van de tool in. Zet ze niet in shellargumenten, omgevingsvariabelen, bestanden, commandogeschiedenis, GitHub, een screenshot of een chatbericht. Het token wordt niet door de tool opgeslagen; de Resend-key en het gegenereerde hookgeheim worden uitsluitend via HTTPS naar het gekozen Supabase-project gestuurd.

## 3. Bekijk eerst het offline plan

Vanuit de repository:

```bash
python3 -B scripts/email/configure-supabase-mail.py \
  --environment staging \
  --from-address noreply@fabelpad.nl
```

Vervang het openbare afzenderadres wanneer de eigenaar een ander geverifieerd adres kiest. Zonder `--check` of `--apply` worden geen credentials gevraagd en geen API's aangeroepen. Het plan toont uitsluitend doelidentiteit en configuratienamen.

## 4. Doe de controles zonder wijzigingen

Bij een Resend-key waarmee domeinen kunnen worden uitgelezen:

```bash
python3 -B scripts/email/configure-supabase-mail.py \
  --environment staging \
  --from-address noreply@fabelpad.nl \
  --check
```

Vul achtereenvolgens het Supabase-token voor staging en de bijbehorende Resend-key in de verborgen prompts in. Deze route doet alleen GET-aanvragen. Afwijkende configuratienamen en ontbrekende Edge-secret-namen worden gemeld zonder bestaande waarden te tonen. Exitcode `2` betekent dat de gecontroleerde mailconfiguratie nog afwijkt; exitcode `1` betekent dat een veiligheids- of toegangscontrole niet is afgerond.

Bij een **Sending access**-key controleer je zelf in het juiste Resend-account eerst domeinstatus, sending en beide trackinginstellingen. Gebruik daarna:

```bash
python3 -B scripts/email/configure-supabase-mail.py \
  --environment staging \
  --from-address noreply@fabelpad.nl \
  --sending-only-key \
  --verified-sending-domain fabelpad.nl \
  --confirm-tracking-disabled \
  --check
```

Deze tweede route slaat de Resend-domein-API bewust over. De uitvoer noemt dit een **eigenaarverklaring**, niet een zelfstandig geverifieerd API-resultaat. Er volgt geen automatische terugval naar deze route na een geweigerde of ongeldige API-key.

De tool stopt vóór wijzigingen bij een ander of ongezond project, een ongeschikte functie, een andere actieve mailhook, een bestaande hook waarvan het geheim niet veilig herbruikbaar is, een afwijkende Site URL of andere bestaande redirects. Ook ontbrekende eerdere Auth-waarden blokkeren toepassen: onbekende instellingen kunnen bij een fout niet betrouwbaar worden hersteld. Laat zulke verschillen eerst afzonderlijk beoordelen; de tool verwijdert ze niet stilzwijgend.

Bij een reeds actieve eigen hook vergelijkt de tool de zes gewenste Edge-waarden intern met de SHA-256-digests uit de Secrets API. Een afwijkende verzendsleutel, afzender, omgeving, origin of hookgeheim blokkeert elke schrijfactie. Deze tool verzorgt eerste inrichting en herhaling met dezelfde geheimen; een sleutel- of afzenderrotatie vraagt een afzonderlijke beoordeelde procedure. Geheimwaarden en hun digests komen niet in de uitvoer.

## 5. Pas eerst staging toe

Gebruik dezelfde gecontroleerde opdracht, maar vervang `--check` door `--apply`. Voor een beperkte verzendsleutel:

```bash
python3 -B scripts/email/configure-supabase-mail.py \
  --environment staging \
  --from-address noreply@fabelpad.nl \
  --sending-only-key \
  --verified-sending-domain fabelpad.nl \
  --confirm-tracking-disabled \
  --apply
```

De tool doet in volgorde het volgende:

1. Controleert het vaste project, de actieve Edge Function, de bestaande Auth-inrichting en het domeinbewijs.
2. Genereert voor eerste inrichting zonder actieve hook in het geheugen een vers cryptografisch willekeurig Standard Webhooks-geheim van 32 bytes in canoniek formaat `v1,whsec_…`. Een bestaande actieve eigen hook behoudt zijn geldige, uitleesbare geheim en vereist zes overeenkomende Edge-digests.
3. Plaatst bij eerste inrichting uitsluitend deze zes Edge-secrets: `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `FABELPAD_EMAIL_FROM`, `FABELPAD_EMAIL_REPLY_TO`, `FABELPAD_APP_ORIGIN`, `FABELPAD_ENVIRONMENT`. Bestaande andere Edge-secrets blijven staan. Een actieve route met overeenkomende digests krijgt geen Edge-secret-schrijfactie.
4. Controleert intern de zes SHA-256-digests tegen de bedoelde waarden. Dit leest geen geheimwaarden of digests terug naar de uitvoer.
5. Zet de vaste Site URL en de drie exacte redirect-URL's `/inloggen`, `/auth/callback` en `/auth/confirm`; activeert e-mailaccounts met bevestiging, laat onbevestigde e-mailadressen niet inloggen en zet veilige e-mailwijziging aan.
6. Zet OTP op 8 cijfers/600 seconden, schrijft alle 13 Fabelpad-onderwerpen en HTML-templates plus zeven beveiligingsmeldingen en stelt de Send Email Hook in met hetzelfde geheim als de Edge Function.
7. Leest de Auth-configuratie terug en vergelijkt die intern met de bedoelde configuratie. Er wordt **geen testmail verstuurd**.

Er bestaat geen transactie over Edge-secrets en Auth samen. Bij een mislukte Auth-update of afwijkende readback probeert de tool eenmaal de vooraf in het geheugen bewaarde Auth-instellingen terug te zetten en controleert die terugkeer. Een oorspronkelijk uitgeschakelde hook blijft daarmee uit; een actieve hook houdt zijn eerdere instellingen en ongewijzigde geheimen. Voorbereide Edge-secrets van een eerste, inactieve inrichting kunnen blijven staan. Een herhaling genereert daarvoor opnieuw een vers hookgeheim.

Als ook herstel of de controle daarvan faalt, meldt de tool expliciet dat **handmatig herstel nodig is**. Geef de mailroute dan niet vrij. Controleer in Supabase de laatst gezonde Auth-inrichting, vooral de status en bestemming van de Send Email Hook. Laat een beheerder het herstel afronden voordat je opnieuw toepast. Bekijk verschillen zonder API-antwoordinhoud te loggen. Verwijder of roteer bestaande werkende geheimen niet op goed geluk.

Voer daarna dezelfde `--check` nogmaals uit. De eindstatus `authReadback: overeenkomstig` bewijst alleen dat de API de gevraagde instellingen heeft teruggegeven. De route is pas functioneel getest na de volgende stap.

## 6. Verifieer de provider vóór de kandidaatbuild

De kandidaatbuild kan bewijs van werkende e-mailconfiguratie vereisen voordat de eerste appstart plaatsvindt. Test daarvoor rechtstreeks tegen het gecontroleerde Supabase-project; een al gepubliceerde website is hiervoor niet nodig.

Voer eerst de configuratiecontrole uit stap 4 opnieuw uit. Voer daarna in je eigen terminal de zelfstandige SDK-proef uit:

```bash
node scripts/email/verify-otp.mjs --environment staging --provider-config-checked
```

Met `--provider-config-checked` bevestig je dat de voorafgaande configuratiecontrole geslaagd is. De proef leest de vier publieke GitHub-environmentvariabelen voor het vaste doel en vraagt uitsluitend een code aan voor het door de eigenaar opgegeven beheeradres `info@dgwebservices.nl`. Voer deze proef alleen uit wanneer je toegang tot die mailbox hebt. Alleen de ontvangen code wordt afgeschermd gevraagd; vul geen mailadres, code of sleutel als commandoregelargument in.

Controleer de echte ontvangst: juiste afzender, antwoordadres, `[TEST]` en stagingvormgeving. Voer de ontvangen 8-cijferige code in de verborgen prompt in. De proef controleert de sessie met Auth, het overeenkomende account, de eigen beheerrol en een alleen-lezen catalogusaanvraag. Er wordt geen sessie op schijf bewaard; de testsessie wordt daarna afgemeld. Het resultaat bevat uitsluitend niet-geheime doelidentiteit, tijdstip en geslaagd/mislukt-beheerbewijs. Het bewijst de providerroute; de browser- en gezinsflows moeten na de aparte appvrijgave nog worden getest.

Laat de beheerder het providerresultaat en de geslaagde configuratiecontrole koppelen aan de bedoelde releaseconfiguratie voordat de kandidaatbuild wordt vrijgegeven. Een offline plan, mocktest of geaccepteerde configuratieaanvraag levert dit bewijs niet zelfstandig.

## 7. Test de app na de aparte appvrijgave

Doe dit zodra de gecontroleerde staging-app via de bedoelde URL bereikbaar is. De mailtool zelf activeert geen website, appservice, proxy of domein.

1. Open `https://staging.fabelpad.nl/inloggen` in een nieuwe browsercontext. Vraag uitsluitend voor een eigen, toegankelijke testmailbox een code aan.
2. Controleer echte ontvangst, juiste afzender, antwoordadres `support@fabelpad.nl`, onderwerp met `[TEST]`, stagingbadge en alle links naar staging. Controleer bij de provider dat acceptatie ook tot bezorging leidt. Leg geen volledige ontvangers, berichtinhoud of codes vast in logs of testverslagen.
3. Vul de 8-cijferige code in. Controleer de gezinsomgeving, vernieuw het scherm en controleer dat de sessie behouden blijft. Controleer in de browser alleen de cookie-eigenschappen: HttpOnly, Secure, SameSite=Lax. Deel de cookiewaarden niet.
4. Log uit en controleer dat afgeschermde API's geen gezinsgegevens meer geven. Een foutieve of verlopen code mag geen sessie opleveren.
5. Voor het door de eigenaar opgegeven beheeraccount open je `/inloggen?next=%2Fstudio` en gebruik je de eigen mailbox `info@dgwebservices.nl`. De databasekent uitsluitend aan dit bevestigde, niet-anonieme Auth-account een automatische beheerrol toe. Een ingevulde naam, claim of gebruikersmetadata geeft geen beheerrechten. Er is geen standaardwachtwoord.
6. Controleer toegang tot de verhalenstudio met het beheeraccount en weigering met een gewone ouder. Leg de bronversie, het doel, tijdstip en alleen een geslaagd/mislukt resultaat vast.
7. Indien uitnodigingen of herstel echt worden gebruikt: open de mail en controleer dat een GET op `/auth/confirm` nog niets bevestigt. Pas **Bevestig en ga verder** verstuurt de getypeerde bevestiging. Bij een veilige e-mailwijziging kunnen beide mailboxen een bevestiging vereisen.

De runtimevlag `FABELPAD_AUTH_EMAIL_ENABLED` is door de hostbeheerder beheerde configuratie en geen extra GitHub-variabele. De vrijgave van deze vlag en de apprelease moeten bij dezelfde beoordeelde versie/configuratie horen. De beheerder moet voorkomen dat het product al werkende e-maillogin belooft terwijl providerconfiguratie of bezorging nog niet is geverifieerd.

## 8. Configureer productie afzonderlijk

Na een geslaagde stagingproef gebruik je het productietoken van Duindorpdoet en de eigen productieverzendsleutel. Controleer in de uitvoer steeds ref `aptprpkosqctwrzeetgs` en origin `https://fabelpad.nl`.

```bash
python3 -B scripts/email/configure-supabase-mail.py \
  --environment production \
  --from-address noreply@fabelpad.nl \
  --sending-only-key \
  --verified-sending-domain fabelpad.nl \
  --confirm-tracking-disabled \
  --check
```

Vervang daarna `--check` door `--apply` en voer vervolgens opnieuw `--check` uit. Verifieer de productieprovider vóór de kandidaatbuild afzonderlijk:

```bash
node scripts/email/verify-otp.mjs --environment production --provider-config-checked
```

Herhaal daarna de browser-/ontvangst-/login-/uitlog-/beheertest op productie zodra die apprelease apart is vrijgegeven. Productiemail heeft de naam **Fabelpad**, zonder stagingbadge of `[TEST]`. Deze opdracht publiceert geen webrelease en verandert geen Google Play-release.

## Templates en handmatige controle

De bron voor alle mails is `lib/email/templates.ts`. Het exportmanifest staat in `supabase/email-templates/manifest.json`. Per omgeving bevat het exact deze 13 acties: signup, invite, magiclink, recovery, email_change, reauthentication, password_changed_notification, email_changed_notification, phone_changed_notification, identity_linked_notification, identity_unlinked_notification, mfa_factor_enrolled_notification en mfa_factor_unenrolled_notification.

De Send Email Hook rendert de mails zelf en verstuurt die via Resend; de Dashboard-HTML is dan niet het verzendpad. Toch schrijft de tool dezelfde vormgeving ook naar alle Dashboard-templatevelden. Voor handmatig overnemen: open in Supabase **Authentication → Email → Templates**, kies het manifestveld `screen`, kopieer `subject` naar het onderwerp en upload/plak het bijbehorende `file` als HTML. Controleer de omgeving en laat Go-templatevariabelen zoals `{{ .Token }}` en `{{ .TokenHash }}` intact. Schakel de zeven beveiligingsmeldingen in waar het betreffende scherm die toont.

Lokale controle zonder provideracties:

```bash
node scripts/email/export-templates.mjs --check
node --test scripts/email/*.test.mjs
python3 -B scripts/email/configure-supabase-mail.test.py
node scripts/auth-contract-check.mjs
node scripts/supabase-db-check.mjs
```

## Officiële bronnen

De velden en routes zijn op 22 november 2026 gecontroleerd tegen de [Supabase Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config), het [actuele officiële OpenAPI-schema](https://api.supabase.com/api/v1-json), [Bulk create secrets](https://supabase.com/docs/reference/api/v1-bulk-create-secrets), [Get a function](https://supabase.com/docs/reference/api/v1-get-a-function), [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Supabase e-mailtemplates](https://supabase.com/docs/guides/auth/auth-email-templates), [Resend Domains](https://resend.com/docs/api-reference/domains/list-domains) en [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md). De testpayloads gebruiken synthetische gegevens.
