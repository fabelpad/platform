-- Parent lifecycle is independent of Auth identities. A successful OAuth/OTP
-- creates no family rights until explicit current-version onboarding completes.
-- All clocks are server UTC. No public function accepts a clock override.
-- Exact immutable documents accepted by this release. Public downloads and
-- hashes are checked against these bytes by the lifecycle regression suite.
create table private.legal_document_versions (
 kind text not null check(kind in ('terms','privacy')), version text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), document_text text not null,
 primary key(kind,version), check(encode(sha256(convert_to(document_text,'UTF8')),'hex')=sha256)
);
alter table private.legal_document_versions enable row level security;
revoke all on private.legal_document_versions from public,anon,authenticated,service_role;
insert into private.legal_document_versions values('terms','2026-11-22','8da71baa717f1e98b393320532670b4ebbddacbd390a14dba3c4cc144b394840',$legal_document$# Algemene voorwaarden Fabelpad

Versie: 2026-11-22
Ingangsdatum: 22 november 2026

Aanbieder: DG Webservices. Contact: support@fabelpad.nl. Deze voorwaarden gelden voor het gebruik van Fabelpad. Fabelpad is nu gratis; er worden geen abonnementen verkocht. De bepalingen over betaald gebruik gelden zodra een betaald aanbod daadwerkelijk beschikbaar is en je daarvoor kiest. De afzonderlijke Android-app werkt lokaal, zonder online account of abonnement. Een online gezinsaccount op de website staat daar los van.

Aanbieder: DG Webservices
Vestigingsplaats: Den Haag ('S-Gravenhage)
KVK-nummer: 88135713
Algemeen contact: info@dgwebservices.nl
Website: https://www.dgwebservices.nl
Fabelpad-support en privacy: support@fabelpad.nl
Bedrijfsgegevens: https://fabelpad.nl/bedrijfsgegevens

## 1. Voor wie is Fabelpad?

Fabelpad is een digitale lees- en vertelomgeving voor kinderen van 0 tot en met 12 jaar. DG Webservices heeft Fabelpad gemaakt en levert de dienst via de website en, waar beschikbaar, via de app. Met Fabelpad kun je interactieve verhalen lezen of beluisteren, keuzes maken en met een kinderprofiel verdergaan waar je gebleven bent.

Een ouder met gezag of een voogd van 18 jaar of ouder maakt het gezinsaccount aan en beheert het. Met ‘je’ bedoelen we in deze voorwaarden die ouder of voogd. Je beslist of een verhaal past bij je kind en begeleidt het gebruik waar nodig. Kinderen gebruiken Fabelpad via het gezin. Aankopen, abonnementsbeheer en het sluiten van het gezinsaccount zijn voorbehouden aan de volwassen accounthouder.

## 2. Je account en het gebruik van Fabelpad

Bij registratie geef je een e-mailadres op waarop we je kunnen bereiken. Houd je toegang en inlogcodes veilig. Vermoed je dat iemand anders toegang heeft tot je account? Mail ons op support@fabelpad.nl. De privacyverklaring legt uit welke gegevens we gebruiken en hoe je die kunt beheren.

Je gezin mag Fabelpad en de aangeboden verhalen, illustraties, audio en andere materialen gebruiken voor privégebruik binnen de dienst. De rechten op die materialen blijven bij DG Webservices of de rechthebbende die ze aan ons beschikbaar stelt. Voor openbaar verspreiden, doorverkopen of commercieel hergebruik is vooraf toestemming nodig, voor zover de wet daarin niet zelf voorziet. Gebruik Fabelpad op een manier die de veiligheid en privacy van anderen respecteert.

Misbruik, fraude of een concreet beveiligingsrisico kan aanleiding zijn om de betrokken toegang tijdelijk te beperken. We informeren je over de reden en over herstel zodra dat veilig en mogelijk is. Bij een herstelbare overtreding krijg je in beginsel eerst gelegenheid om die te verhelpen.

## 3. Gratis en betaald gebruik

Er is gratis toegang tot het aanbod dat we als gratis aanduiden. Zodra betaalde abonnementen beschikbaar zijn, zie je vóór het afsluiten welke functies en verhalen het gekozen abonnement bevat. Je ziet ook de totaalprijs inclusief toepasselijke belastingen per betaalperiode, de looptijd, de eerste en volgende betaaldatum voor zover van toepassing, of het abonnement automatisch wordt verlengd en hoe je het beëindigt. Bij een proefperiode of introductietarief staat er wanneer die periode stopt, wat je daarna betaalt en hoe je een afschrijving voorkomt.

Een betaald abonnement ontstaat nadat je zelf een bestelling met betalingsverplichting bevestigt en die is aanvaard. Je krijgt daarna een bevestiging met de afgesproken prijs, toegang, looptijd, toepasselijke voorwaarden en informatie over opzeggen en herroepen. Bewaar die bevestiging. Bij een aankoop via een appwinkel toont het betaalscherm wie de betaling afhandelt en waar je de aankoop beheert. Je wettelijke rechten blijven gelden.

## 4. Verlengen en opzeggen

Vóór de aankoop zie je of het abonnement na de eerste looptijd afloopt of automatisch doorloopt. Na een eventuele stilzwijgende verlenging kun je op ieder moment opzeggen met maximaal één maand opzegtermijn. Duurt de resterende betaalde periode langer dan de geldende opzegtermijn, dan verrekenen we het vooruitbetaalde bedrag voor de periode na de einddatum voor zover je daar recht op hebt.

Een rechtstreeks bij Fabelpad afgesloten abonnement zeg je online op in het oudergedeelte. Bij een appwinkelaankoop vind je daar de route naar het abonnementsbeheer van de winkel. Na opzegging ontvang je van ons of van de betreffende appwinkel een bevestiging met de einddatum. Tot die datum blijft de toegang beschikbaar, behalve wanneer je ook kiest voor het tijdelijk stilzetten of verwijderen van je account. Alleen de app verwijderen van je toestel beëindigt de betaling niet.

## 5. Bedenktijd bij online aankoop

Bij een online afgesloten abonnement heb je in beginsel 14 kalenderdagen bedenktijd, gerekend vanaf de dag na het sluiten van de overeenkomst. Een langere wettelijke termijn kan gelden. Wil je je koop ongedaan maken? Gebruik de pagina Koop ongedaan maken (/herroepen) of stuur binnen de termijn een duidelijke verklaring naar support@fabelpad.nl. Het formulier hieronder is optioneel. De bestelbevestiging vertelt je bij een aankoop via een appwinkel welke route op jouw koop van toepassing is. Wij helpen je bij het vinden van de juiste route.

Bij een rechtstreekse aankoop kun je de hiervoor genoemde bedenktijd ook gebruiken als je al met Fabelpad bent begonnen. Bij een geldige herroeping van zo’n aankoop betalen wij het volledige ontvangen bedrag uiterlijk binnen 14 dagen nadat je ons hebt geïnformeerd terug. We gebruiken dezelfde betaalwijze, tenzij je uitdrukkelijk instemt met een andere kosteloze manier. De betaalde toegang eindigt bij herroeping.

Formulier om te herroepen

Kopieer de regels hieronder en stuur ze naar support@fabelpad.nl. Laat regels weg die niet op jouw aankoop van toepassing zijn.

Aan DG Webservices Ik laat hierbij weten dat ik mijn overeenkomst voor het volgende Fabelpad-abonnement herroep. Abonnement en eventueel bestelnummer Datum waarop ik het abonnement afsloot Naam van de accounthouder Adres van de accounthouder E-mailadres waarmee ik heb besteld Datum van dit bericht Handtekening, alleen als dit formulier op papier wordt verstuurd

## 6. Als Fabelpad verandert of niet goed werkt

Fabelpad moet voldoen aan wat is afgesproken en aan de wettelijke eisen voor digitale inhoud en diensten. We leveren de updates die nodig zijn om Fabelpad veilig en bruikbaar te houden. Meld een probleem bij support@fabelpad.nl. We herstellen het kosteloos binnen een redelijke termijn en zonder ernstige overlast als je daar recht op hebt. Lukt dat niet, dan kun je afhankelijk van de omstandigheden recht hebben op een prijsverlaging of beëindiging en terugbetaling.

We kunnen de dienst wijzigen voor beveiliging, toegankelijkheid, compatibiliteit of het vervangen van materiaal waarvoor de gebruiksrechten eindigen. Een wijziging van de dienst zelf brengt geen extra kosten met zich mee. Is een wijziging meer dan gering nadelig voor je toegang of gebruik? Dan informeren we je vooraf via een bericht dat je kunt bewaren. Je kunt de overeenkomst in dat geval kosteloos beëindigen binnen 30 dagen na ontvangst van dat bericht of na de wijziging, afhankelijk van welke datum later valt, voor zover de wet dat recht geeft.

Een prijsverhoging van een doorlopend abonnement kan ingaan na de eerste vaste looptijd en vanaf een volgende betaalperiode, bijvoorbeeld vanwege aantoonbaar gestegen leveringskosten of gewijzigde belastingen. We informeren je vooraf op een manier die je kunt bewaren. Je krijgt gelegenheid om het abonnement kosteloos te beëindigen vóór de prijsverhoging ingaat. Bij wezenlijke wijzigingen van deze voorwaarden laten we je vooraf weten wat verandert, wanneer de wijziging ingaat en welke keuzes of rechten je hebt.

## 7. Je account laten verwijderen

In het oudergedeelte kun je via Profiel → Account → Account verwijderen het hele gezinsaccount voor verwijdering aanmelden. We blokkeren het normale gebruik meteen. Je krijgt 30 dagen om de verwijdering via de herstelroute ongedaan te maken. Daarna verwijderen we het account en de bijbehorende kinderprofielen, voorkeuren en leesvoortgang. De privacyverklaring legt uit welke beperkte gegevens we langer moeten of mogen bewaren.

Is Fabelpad 90 dagen achter elkaar door niemand in het gezin gebruikt, dan verwijderen we het account en de bijbehorende profielgegevens automatisch. We waarschuwen vooraf op het e-mailadres van de accounthouder. Je voorkomt verwijdering wegens inactiviteit door Fabelpad vóór de genoemde datum weer te gebruiken. De privacyverklaring legt uit wat meetelt als gebruik. Heb je zelf de verwijdering al aangevraagd, dan geldt de datum die je bij die aanvraag kreeg.

Een verzoek tot accountverwijdering stopt toekomstige automatische verlengingen. Bij een aankoop via een appwinkel tonen we vooraf hoe het beëindigen van de betaling en een eventuele terugbetaling daar verlopen. Herstel van je account start een gestopte verlenging nooit automatisch opnieuw. Als toegang definitief eindigt terwijl er nog vooruitbetaalde dagen over zijn, krijg je het bedrag voor de ongebruikte betaalde periode waarin wij de toegang hebben geblokkeerd of beëindigd naar verhouding terug. Betaalde je via een appwinkel, dan helpen we je de terugbetaling via die betaalroute af te handelen. Dezelfde bescherming geldt als we je account automatisch verwijderen wegens inactiviteit.

Wil je persoonsgegevens eerder laten wissen of kun je niet meer inloggen? Mail support@fabelpad.nl of ga naar Account en gegevens verwijderen. We behandelen een verzoek om gegevenswissing volgens de privacywet.

## 8. Contact, klachten en toepasselijk recht

Voor vragen, klachten of problemen kun je terecht bij support@fabelpad.nl. Beschrijf zo kort mogelijk wat er speelt en vermeld bij een aankoop eventueel het bestelnummer. Is een oplossing niet mogelijk, dan kun je naar de wettelijk bevoegde rechter. Nederlands recht is van toepassing. Woon je als consument in een ander land, dan houd je de dwingende consumentenbescherming die daar op jouw overeenkomst van toepassing is.
$legal_document$);
insert into private.legal_document_versions values('privacy','2026-11-22','97673d3103443115097def26e20e6c677650dcb760d095de900ae3c5c5961cb7',$legal_document$# Privacyverklaring Fabelpad

Versie: 2026-11-22
Ingangsdatum: 22 november 2026

DG Webservices heeft Fabelpad gemaakt, levert de dienst en is verantwoordelijk voor de verwerking van persoonsgegevens in deze verklaring. Fabelpad is een lees- en vertelomgeving voor kinderen van 0 tot en met 12 jaar. Een ouder met gezag of voogd van 18 jaar of ouder beheert het online gezinsaccount. De gratis Android-app (nl.fabelpad.app) werkt afzonderlijk en lokaal, zonder online account, cloudsynchronisatie, advertenties of abonnement. Deze verklaring legt dat verschil uit.

Aanbieder: DG Webservices
Vestigingsplaats: Den Haag ('S-Gravenhage)
KVK-nummer: 88135713
Algemeen contact: info@dgwebservices.nl
Website: https://www.dgwebservices.nl
Fabelpad-support en privacy: support@fabelpad.nl
Bedrijfsgegevens: https://fabelpad.nl/bedrijfsgegevens

## 1. Wie is verantwoordelijk?

DG Webservices is gevestigd in Den Haag ('S-Gravenhage) en staat bij de Kamer van Koophandel ingeschreven onder nummer 88135713. Algemene contactgegevens: info@dgwebservices.nl en www.dgwebservices.nl. Voor Fabelpad-support en alle privacyvragen gebruik je support@fabelpad.nl. De pagina Bedrijfsgegevens bevat dezelfde contactinformatie.

Ouders en voogden kunnen namens hun kind contact opnemen. Ben je 12 jaar, dan mag je zelf schrijven over je eigen gegevens of toestemming. Je hoeft daarvoor niet in te loggen in het oudergedeelte. Stuur in het eerste bericht geen identiteitsbewijs, wachtwoord, inlogcode of onnodige gegevens over kinderen.

## 2. Voor kinderen en hun ouders

Bij Fabelpad lees je verhalen en kies je hoe ze verdergaan. Je ouder of voogd regelt een online profiel. Je mag een bijnaam gebruiken. Alleen als je ouder of voogd apart toestemming geeft, bewaren we je online profiel en leesgegevens zodat je later verder kunt lezen. Je kunt ook verhalen ontdekken zonder online kinderprofiel.

Voor een online kinderprofiel volstaan een bijnaam en een gekozen avatar. We vragen in de standaardflow geen volledige geboortedatum, adres, foto of identiteitsdocument. Het e-mailadres voor inloggen en contact hoort bij de volwassene. Er zijn geen openbare kinderprofielen, chat of contactmogelijkheden tussen kinderen.

Het oudergedeelte toont de toestemming per online kinderprofiel. De ouder of voogd kan die daar even eenvoudig intrekken. We stoppen de bijbehorende synchronisatie en verwijderen het betreffende profiel en de leesgegevens, tenzij een geldige wettelijke verplichting voor beperkte gegevens geldt. Andere profielen en het gezinsaccount blijven bestaan. Intrekking verandert eerder rechtmatig gebruik niet. Vanaf 12 jaar kan het kind ook zelf toestemming intrekken via support@fabelpad.nl.

Een bevestigde e-mailcode of Google-login bewijst toegang tot een account. Het is geen controle van gezag, voogdij of leeftijd. Daarom vragen we afzonderlijk om de ouderverklaring en de toestemming voor elk online kinderprofiel. Bij een gericht verzoek of concrete twijfel doen we een proportionele aanvullende controle. De eenvoudige uitleg staat op Privacy voor kinderen.

## 3. Ouderaccount, OTP en Google-login

Voor een online gezinsaccount verwerken we het e-mailadres, een technisch accountnummer en de noodzakelijke aanmeld-, sessie- en beveiligingsgegevens. Supabase verzorgt de aanmelding. Je kunt een eenmalige e-mailcode van zes cijfers aanvragen of kiezen voor Inloggen met Google. Bij Google ontvangen Supabase en Fabelpad de door Google voor deze aanmelding verstrekte identificatiegegevens, waaronder het e-mailadres en eventueel de weergegeven naam en profielfoto. Fabelpad vraagt geen toegang tot Gmail, agenda of contacten.

Google verwerkt de door jou gekozen Google-aanmelding ook volgens het eigen privacybeleid. Je kunt de koppeling beheren via je Google-account. Google uitloggen of de koppeling verwijderen is niet hetzelfde als je Fabelpad-account verwijderen.

Voordat online gezinsfuncties beschikbaar worden, vragen we actief te verklaren dat je 18 jaar of ouder bent en als ouder met gezag of voogd handelt. Je aanvaardt de algemene voorwaarden apart. We leggen het accountnummer, de vastgelegde ouderverklaring, de versie van de voorwaarden, de getoonde privacyversie, het UTC-tijdstip en de aanmeldmethode vast. De privacyverklaring is informatie: daarvoor vragen we geen verplicht akkoord. Een onafgeronde aanmelding geeft geen toegang tot gezinsgegevens en wordt na zeven dagen opgeruimd.

## 4. Welke online gezinsgegevens we bewaren

Na afzonderlijke toestemming voor een kinderprofiel bewaren we de gekozen bijnaam, avatar, een technisch profielnummer, favorieten, verhaalkeuzes, leesvoortgang, verzamelde herinneringen en leesvoorkeuren. Deze gegevens zijn gekoppeld aan het ouderaccount en afgeschermd voor andere gezinnen. Gebruik een bijnaam en voeg geen gevoelige informatie toe.

Leesvoortgang en verhaalkeuzes ontstaan door daadwerkelijk gebruik. We gebruiken die gegevens om het juiste verhaal, de gekozen route en de bewaarde plek terug te geven. De website kan daarnaast een lokale kopie in je browser bewaren. Gegevens uit de afzonderlijke Android-app worden niet automatisch geüpload of met het webaccount gekoppeld.

Bij het aanmaken van een online profiel bewaren we minimaal bewijs van de gegeven toestemming: het betrokken account- en profielnummer, de getoonde toestemmingsversie en verklaring, de vastleggingsmethode en het tijdstip. We bewaren daarvoor geen kopie van een identiteitsbewijs.

## 5. Waarom we gegevens gebruiken

We gebruiken ouderaccount- en sessiegegevens om de gevraagde online dienst uit te voeren, je aan te melden, het account te beveiligen en noodzakelijke serviceberichten te sturen. De grondslag is de uitvoering van de overeenkomst of stappen op jouw verzoek. Voor een optioneel online kinderprofiel en de bijbehorende leesgegevens vragen we afzonderlijke toestemming aan de ouder met gezag of voogd.

Voor het beveiligen van de website, het tegengaan van misbruik, het behandelen van ondersteuning en het minimaal aantonen van afspraken hebben we een gerechtvaardigd belang. We beperken de gegevens en wegen daarbij de belangen van kinderen mee. Als de wet bewaring of verstrekking verplicht, verwerken we alleen wat die wettelijke verplichting vraagt. Privacyverzoeken behandelen we om aan onze wettelijke verplichtingen te voldoen.

We verkopen geen gezinsgegevens. We gebruiken de leesomgeving niet voor gepersonaliseerde reclame of advertentietracking en nemen geen geautomatiseerde besluiten met rechtsgevolgen over kinderen. De huidige uitgave bevat geen betaalfunctie, marketingmailinglijst of eigen analyse- of crashrapportage-SDK.

## 6. Cookies, browseropslag en websitebezoek

De website ontvangt technische verbindingsgegevens, zoals IP-adres, tijdstip, de opgevraagde pagina en browserinformatie, om pagina’s af te leveren en de dienst te beveiligen. De server en onze technische dienstverleners kunnen deze gegevens in operationele en beveiligingslogboeken verwerken. De door DG Webservices beheerde Fabelpad-applicatielogs worden maximaal 30 dagen bewaard. Providerlogboeken en een noodzakelijk specifiek beveiligingsonderzoek vallen onder afzonderlijke, beperkte bewaartermijnen of beoordelingscriteria. Zet geen gevoelige informatie in een URL of supportbijlage.

Voor online aanmelding gebruikt de website noodzakelijke sessiecookies van Supabase. Op de publieke juridische pagina’s is geen ouderlogin nodig. Voor lokale leesprofielen, instellingen, verhaalversies en eventuele synchronisatie gebruikt Fabelpad browseropslag. De PWA bewaart openbare appbestanden en illustraties lokaal om de website bruikbaar te houden. Een opgeslagen browserprofiel is geen Google-account en geen lokale Android-profielopslag.

Wij plaatsen geen advertentie- of analysecookies. Er is daarom geen toestemming voor dergelijke cookies nodig in de huidige uitgave. Als een toekomstige functie niet-noodzakelijke cookies inzet, vragen we vooraf apart toestemming en bieden we een even eenvoudige manier om die in te trekken. Je kunt lokale browsergegevens wissen via de sitegegevens van fabelpad.nl of staging.fabelpad.nl in je browser. Alleen browsergegevens wissen verwijdert geen cloudaccount.

## 7. Ontvangers, landen en doorgifte

DG Webservices beheert de Fabelpad-webdienst op een eigen afgeschermde serveromgeving. Supabase levert authenticatie, database en technische platformfuncties; de online gezinsdatabase staat in de Europese regio eu-west-1 (Ierland). Resend (Plus Five Five, Inc.) verwerkt het ontvangstadres, de noodzakelijke berichtinhoud en technische bezorggegevens voor inlogcodes en serviceberichten. We nemen geen kindnamen of leesinhoud op in herinnerings- en accountverwijderberichten. Supportmail wordt via onze support-inbox behandeld.

Supabase en Resend kunnen voor infrastructuur, beveiliging en ondersteuning subverwerkers inzetten. Daarbij kan verwerking of toegang vanuit landen buiten de Europese Economische Ruimte plaatsvinden, onder meer de Verenigde Staten. Een Europese databaseregio betekent dus niet dat elke ondersteunende verwerking uitsluitend in Europa plaatsvindt. Hun verwerkersvoorwaarden bevatten toepasselijke afspraken over internationale doorgifte, waaronder de Europese standaardcontractbepalingen voor zover die nodig zijn. Je kunt via support@fabelpad.nl informatie en een kopie van de voor jouw verwerking toepasselijke waarborgen vragen.

Bij de gekozen Google-login treedt Google voor eigen account- en beveiligingsverwerkingen op als zelfstandige verwerkingsverantwoordelijke. Ook Google Play verwerkt installatie-, update- en beveiligingsgegevens onder het eigen beleid. We geven verder alleen gegevens aan andere partijen als dat noodzakelijk is voor de gevraagde dienst, een specifieke door jou gevraagde handeling of een geldige wettelijke verplichting. We geven geen kinderprofielen aan advertentienetwerken.

## 8. Inlogcodes, servicemails en support

We sturen alleen gevraagde inlogcodes en noodzakelijke berichten over je account, beveiliging, verwijdering en de dienstverlening. Inlogcodes en noodzakelijke Auth-accountberichten worden door Supabase via de ingestelde Resend-mailverbinding (custom SMTP) verzonden. Andere noodzakelijke Fabelpad-serviceberichten gebruiken de Resend-API wanneer die afzonderlijke koppeling voor de omgeving is geactiveerd. Inlogcodes horen alleen in het Fabelpad-inlogscherm. Wij vragen je nooit om een code per e-mail aan support door te geven. Voor deze berichten gebruiken we geen open- of kliktracking.

Als je support@fabelpad.nl mailt, ontvangen we je e-mailadres, de inhoud van je bericht en eventuele bijlagen. We gebruiken dit voor het behandelen van je vraag, technische hulp of een privacyverzoek. Deel zo weinig mogelijk persoonsgegevens en gebruik bij technische voorbeelden verzonnen namen. Supportberichten worden niet aan een marketinglijst toegevoegd.

Alleen bevoegde personen krijgen toegang voor het afhandelen van support en privacyverzoeken. Bewijs en een noodzakelijk juridisch dossier worden gescheiden van de leesomgeving gebruikt en bevatten geen kindgegevens die voor dat doel niet nodig zijn.

## 9. Hoelang we gegevens bewaren

We bewaren online account- en gezinsgegevens zolang het account actief is en de betreffende toestemming geldt. Bij een handmatige accountverwijdering geldt de beveiligde hersteltermijn van 30 dagen. Een afzonderlijk geldig AVG-wisverzoek behandelen we zo snel mogelijk en zonder die vaste hersteltermijn. Een ingetrokken toestemming voor één kinderprofiel is geen verzoek om het hele gezin te verwijderen.

Na 90 opeenvolgende dagen zonder bewuste gezinsactiviteit komen online accounts met hun profielgegevens voor automatische verwijdering in aanmerking. We waarschuwen de accounthouder vooraf, bijvoorbeeld 14 en 3 dagen voor de concrete verwijderdatum. Actief gebruik vóór die datum voorkomt verwijdering wegens inactiviteit. Voor bestaande accounts zonder betrouwbare gebruikshistorie geven we eerst een aankondiging en een gelegenheid de dienst opnieuw te gebruiken. Die overgang is geen verzonnen leesactiviteit.

Bewuste activiteit is bijvoorbeeld een afgeronde ouderlogin naar het oudergedeelte, een bewuste ouderactie of daadwerkelijk een verhaal openen of verder lezen onder een gekoppeld profiel. Offline leesactiviteit telt alleen mee zodra aantoonbare, geldige activiteit vóór de verwijderdatum is gesynchroniseerd. Tokenverversing, achtergrondprocessen, betalingen en het openen van een e-mail houden het account niet actief.

Afgebroken aanmeldingen zonder afgerond ouderaccount worden na zeven dagen opgeruimd. Operationele verwijderopdrachten en noodzakelijke bezorgbewijzen bewaren we zolang nodig om de uitvoering te controleren en een fout te herstellen. Voor een werkelijk geschil bewaren we alleen aantoonbaar relevante gegevens zolang de afhandeling of rechtsvordering dat noodzakelijk maakt. Als er later betalingen zijn, houden we wettelijk verplichte administratie gescheiden van de kinderprofielen.

Een verwijdering geldt voor de actieve dienst. Resterende beveiligde herstelkopieën worden niet gebruikt om verwijderde profielen weer beschikbaar te maken. Een herstel van een omgeving moet de vastgelegde verwijderingen opnieuw uitvoeren voordat die omgeving gebruikersverkeer ontvangt. Je kunt bij support@fabelpad.nl informatie vragen over de op jouw gegevens toepasselijke rotatie van technische back-ups, providerlogboeken en supportbewaring.

## 10. Account verwijderen, herstellen of eerder wissen

Als ouder of voogd ga je op de website naar Profiel → Account → Account verwijderen. Je ziet vooraf welke gegevens verdwijnen en de exacte uiterste hersteldatum. Na verse aanmelding en bevestiging zetten we het account meteen stil en krijg je een bevestiging. Je kunt alleen vóór de deadline en via de beveiligde herstelroute expliciet kiezen om het account terug te zetten. Gewoon opnieuw inloggen of de app opnieuw installeren herstelt de aanvraag niet.

Na 30 dagen verwijderen we het online gezinsaccount met de kinderprofielen, voortgang, favorieten, verhaalkeuzes, herinneringen, instellingen en operationele koppelingen. Valt de grens van 90 dagen in de herstelperiode, dan geldt de datum van de handmatige aanvraag. Een geldig afzonderlijk AVG-wisverzoek kan eerder uitgevoerd moeten worden.

Wil je gegevens eerder laten wissen of kun je niet meer inloggen? Open Account en gegevens verwijderen of Privacyverzoek en mail support@fabelpad.nl. Gebruik bij een accountverzoek bij voorkeur het adres van dat account. Benoem alleen wat nodig is om het verzoek te begrijpen. Een kind van 12 kan zonder ouderlogin over de eigen gegevens schrijven; we sluiten daardoor niet zonder grond het hele gezin.

Na verwijdering kan DG Webservices een beperkt, afgeschermd dossier bewaren als een wettelijke verplichting of een concrete rechtsvordering dat noodzakelijk maakt. We leggen uit welke gegevens dat zijn, waarom en welke termijn of beoordelingscriteria gelden. De huidige gratis uitgave heeft geen abonnement om op te zeggen. De algemene voorwaarden beschrijven afzonderlijk de bescherming bij eventuele toekomstige betaalde toegang.

## 11. De afzonderlijke lokale Android-app

De gratis Android-app bewaart maximaal vijf lokale profielen met een zelfgekozen naam of bijnaam, avatar, lokaal profielnummer, favorieten, verhaalkeuzes, leesvoortgang, herinneringen en tekst- en bewegingsvoorkeuren. Verhalen en illustraties worden meegeleverd. Zoekopdrachten worden alleen in het werkgeheugen gebruikt. Deze versie verstuurt de profielgegevens niet naar een Fabelpad-server en bevat geen ouderaccount, Google-login, OTP, cloudsynchronisatie of betaalfunctie.

De productie-app bevat geen advertentie-ID, analyse-SDK, automatische crashrapportage aan Fabelpad, chat, pushberichten, locatie-, microfoon- of contactentoegang. Automatische Android-back-ups van de eigen appgegevens zijn uitgeschakeld. De lokale opslag is niet afzonderlijk door Fabelpad versleuteld. Gebruik daarom een schermvergrendeling en houd je toestel actueel.

Voorlezen start alleen nadat je de knop gebruikt. De Android-app kiest alleen een geïnstalleerde Nederlandse stem die Android als zonder netwerk bruikbaar aanduidt. De zelfgekozen profielnaam wordt voor het voorlezen vervangen door Avonturier. Als geen geschikte offline stem beschikbaar is, kun je blijven lezen zonder dat de app op een online stem overschakelt. Het installeren of bijwerken van stemgegevens via Android kan wel internet gebruiken.

Voordat de Android-app een externe privacy- of supportlink opent, vraagt een lokale oudercontrole om een geboortejaar. Dat wordt niet opgeslagen of verstuurd en vormt geen identiteitscontrole. Buiten de app verwerken je browser, e-mailapp en hun leveranciers gegevens volgens hun eigen beleid.

## 12. Voorlezen in de webbrowser

De voorleesknop op de website gebruikt alleen een Nederlandse stem die de browser expliciet als lokaal verwerkt aanduidt. De gekozen profielnaam wordt in de voorleestekst vervangen door Avonturier. Als zo’n stem ontbreekt, blijft lezen mogelijk en schakelt Fabelpad niet over op een online stem. Het installeren of bijwerken van een stem via je apparaat kan wel internet gebruiken. De spraakfunctie wordt pas gestart nadat je zelf de voorleesknop gebruikt.

Fabelpad gebruikt geen microfoon, spraakopname of spraakherkenning. Het stoppen van een verhaal, wisselen van profiel of naar de achtergrond gaan stopt het voorlezen.

## 13. Lokale gegevens zelf wissen

Open in de Android-app Ouders → Alle gegevens op dit apparaat wissen → Wissen. Daarna verschijnt een nieuw leeg startprofiel. Je kunt ook via Android-instellingen → Apps → Fabelpad → Opslag en cache → Opslag wissen alle lokale appgegevens verwijderen. De precieze benamingen verschillen per toestel. Alleen de cache wissen is niet altijd voldoende.

Lokale browsergegevens wis je afzonderlijk in de browser via de sitegegevens van Fabelpad. Bij een online gekoppelde browser verwerkt de app een ingetrokken profiel of verwijderd account zodra zij de verwijdering vaststelt. Een toestel dat nooit meer online komt kan nog een lokale kopie bevatten; wis die zelf via de app- of browserinstellingen.

Fabelpad heeft geen centrale kopie van de profielen uit de lokale Android-app en kan die gegevens niet op afstand inzien, exporteren of verwijderen. Een cloudaccount verwijderen wist geen afzonderlijke lokale Android-profielen. Maak zelf een kopie van wat je wilt houden voordat je wist: gewiste lokale voortgang kan Fabelpad niet terughalen.

## 14. Jouw rechten en een privacyverzoek

Je kunt, voor zover van toepassing, vragen om inzage, een kopie, correctie, verwijdering, beperking, overdracht van gegevens of bezwaar maken tegen verwerking op grond van een gerechtvaardigd belang. Toestemming kun je intrekken zonder dat dit eerdere rechtmatige verwerking verandert. Gebruik de openbare pagina Privacyverzoek of mail support@fabelpad.nl. De privacyverklaring beperkt je wettelijke rechten niet.

Voor kinderen jonger dan 12 jaar oefent de wettelijke vertegenwoordiger de rechten uit. Vanaf 12 jaar kan het kind dat zelf doen en kan de wettelijke vertegenwoordiger dat ook doen. Een eigen verzoek over kindgegevens geeft geen recht op de gegevens van andere gezinsleden. Bij twijfel controleren we op een passende, zo beperkt mogelijke manier of jij het verzoek mag doen.

We reageren zonder onnodige vertraging en uiterlijk binnen één kalendermaand na ontvangst. Bij een complex verzoek of meerdere verzoeken kan die termijn waar nodig met maximaal twee maanden worden verlengd. We informeren je dan binnen de eerste maand over de reden. Een geldig wisverzoek voeren we zo snel mogelijk uit; de reactietermijn is geen standaard wachttijd.

Denk je dat we onjuist met gegevens omgaan? Dan kun je ook een klacht indienen bij de Autoriteit Persoonsgegevens via autoriteitpersoonsgegevens.nl of bij je bevoegde privacytoezichthouder.

## 15. Beveiliging en wijzigingen

We beperken toegang tot bevoegde personen en systemen, gebruiken beveiligde verbindingen voor de online dienst en scheiden de gegevens van gezinnen met toegangsregels. Resend-koppelsleutels worden serverzijdig bewaard en komen niet in de leesomgeving. Geen enkele technische beveiliging biedt een absolute garantie. Deel geen inlogcode en meld vermoedelijk misbruik via support@fabelpad.nl.

De nieuwste versie van deze verklaring staat op de website en is via de app bereikbaar. De bovenaan vermelde versie kun je als tekst bewaren. Bij een wezenlijke wijziging vertellen we vooraf wat verandert. Als nieuwe verwerking toestemming vereist, vragen we die afzonderlijk.

## Privacyinformatie van dienstverleners

- Supabase DPA: https://supabase.com/legal/customer-resources/data-processing-addendum
- Supabase subverwerkers: https://supabase.com/legal/subprocessors
- Resend DPA: https://resend.com/legal/dpa
- Resend subverwerkers: https://resend.com/legal/subprocessors
- Google: https://policies.google.com/privacy?hl=nl
$legal_document$);
create function private.prevent_legal_document_change() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Published legal versions are immutable' using errcode='42501'; end$$;
revoke all on function private.prevent_legal_document_change() from public,anon,authenticated,service_role;
create trigger immutable_legal_document before update or delete on private.legal_document_versions for each row execute function private.prevent_legal_document_change();

create table private.account_lifecycle (
  parent_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'onboarding' check(state in ('onboarding','active','deletion_pending','deleting')),
  created_at timestamptz not null default clock_timestamp(),
  legacy_account boolean not null default false,
  terms_version text, privacy_version text, accepted_at timestamptz,
  parent_declaration boolean not null default false,
  signup_channel text check(signup_channel in ('otp','google','other')),
  last_activity_at timestamptz,
  -- An announced transition is not fabricated historical activity.
  transition_deadline timestamptz,
  deletion_requested_at timestamptz, deletion_deadline timestamptz,
  deletion_reason text check(deletion_reason in ('parent','inactivity','privacy','abandoned')),
  constraint lifecycle_acceptance check(state='onboarding' or (state='deleting' and deletion_reason in ('abandoned','privacy')) or (accepted_at is not null and parent_declaration and terms_version is not null and privacy_version is not null))
);
alter table private.account_lifecycle enable row level security;
revoke all on private.account_lifecycle from public,anon,authenticated,service_role;
create table private.parent_acceptances (
  id uuid primary key default gen_random_uuid(), parent_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null, privacy_version text not null, terms_sha256 text not null, privacy_sha256 text not null, accepted_at timestamptz not null,
  signup_channel text not null check(signup_channel in ('otp','google','other')),
  parent_declaration boolean not null check(parent_declaration), unique(parent_id,terms_version)
);
alter table private.parent_acceptances enable row level security;
revoke all on private.parent_acceptances from public,anon,authenticated,service_role;
create table private.child_profile_consents (
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id text not null check(child_id ~ '^[a-zA-Z0-9_-]{1,80}$' and child_id not in ('__proto__','prototype','constructor')),
  granted_at timestamptz not null, withdrawn_at timestamptz,
  method text not null default 'guardian_declaration' check(method='guardian_declaration'),
  privacy_version text not null, guardian_declaration boolean not null check(guardian_declaration),
  primary key(parent_id,child_id)
);
alter table private.child_profile_consents enable row level security;
revoke all on private.child_profile_consents from public,anon,authenticated,service_role;
create table private.family_activity_events (
  parent_id uuid not null references auth.users(id) on delete cascade, event_id uuid not null,
  occurred_at timestamptz not null, received_at timestamptz not null,
  kind text not null check(kind in ('parent_login','parent_action','reading')),
  primary key(parent_id,event_id)
);
alter table private.family_activity_events enable row level security;
revoke all on private.family_activity_events from public,anon,authenticated,service_role;
create table private.lifecycle_controls (
  singleton boolean primary key default true check(singleton),
  inactivity_enabled boolean not null default false,
  transition_reviewed_at timestamptz, staging_evidence text,
  check(not inactivity_enabled or (transition_reviewed_at is not null and length(staging_evidence) between 16 and 200))
);
insert into private.lifecycle_controls(singleton) values(true);
alter table private.lifecycle_controls enable row level security;
revoke all on private.lifecycle_controls from public,anon,authenticated,service_role;
-- Outbox retains no child data, credential, OTP, or arbitrary user-authored text.
create table private.lifecycle_outbox (
  id uuid primary key default gen_random_uuid(), parent_id uuid,
  kind text not null check(kind in ('welcome','deletion_requested','account_restored','inactivity_14','inactivity_3','delete_account')),
  dedupe_key text not null unique, payload jsonb not null default '{}',
  state text not null default 'pending' check(state in ('pending','working','done','cancelled','attention')),
  created_at timestamptz not null default clock_timestamp(), available_at timestamptz not null default clock_timestamp(),
  locked_until timestamptz, lease_id uuid, attempts integer not null default 0,
  first_attempt_at timestamptz, completed_at timestamptz,
  provider_id text, last_error_code text check(last_error_code in ('provider_unavailable','storage_unverified','auth_unavailable','delivery_uncertain','configuration_unavailable'))
);
alter table private.lifecycle_outbox enable row level security;
revoke all on private.lifecycle_outbox from public,anon,authenticated,service_role;
create index lifecycle_outbox_due_idx on private.lifecycle_outbox(available_at) where state in ('pending','working');
create index lifecycle_outbox_parent_idx on private.lifecycle_outbox(parent_id);
create table private.deletion_receipts (
  operation_id uuid primary key, subject_digest text not null,
  reason text not null, completed_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp()+interval '90 days'),
  auth_deleted boolean not null check(auth_deleted), storage_checked boolean not null check(storage_checked)
);
alter table private.deletion_receipts enable row level security;
revoke all on private.deletion_receipts from public,anon,authenticated,service_role;
-- Minimal support register: no message text, names or addresses in this table.
create table private.privacy_requests (
 id uuid primary key default gen_random_uuid(), reference text not null unique,
 received_at timestamptz not null, response_due_at timestamptz not null,
 request_kind text not null check(request_kind in ('access','export','correction','objection','restriction','consent_withdrawal','erasure')),
 subject_scope text not null check(subject_scope in ('parent','child')),
 parent_id uuid references auth.users(id) on delete set null, child_id text,
 verification text not null default 'pending' check(verification in ('pending','verified','declined')),
 verification_method text check(verification_method in ('verified_parent','proportionate_support')),
 state text not null default 'received' check(state in ('received','verified','executing','completed','declined','extended')),
 first_response_at timestamptz, extension_reason text check(length(extension_reason)<=300),
 extended_due_at timestamptz, completed_at timestamptz, expires_at timestamptz, deletion_operation_id uuid,
 check((subject_scope='parent' and child_id is null) or (subject_scope='child' and (child_id is not null or verification='pending'))),
 check(extended_due_at is null or (first_response_at is not null and first_response_at<=response_due_at and extension_reason is not null))
);
alter table private.privacy_requests enable row level security;
revoke all on private.privacy_requests from public,anon,authenticated,service_role;

create function private.lifecycle_now() returns timestamptz language sql volatile set search_path='' set timezone='UTC' as $$ select clock_timestamp() $$;
revoke all on function private.lifecycle_now() from public,anon,authenticated,service_role;
create function private.lifecycle_provision() returns trigger language plpgsql security definer set search_path='' set timezone='UTC' as $$
begin insert into private.account_lifecycle(parent_id) values(new.id) on conflict do nothing; return new; end $$;
revoke all on function private.lifecycle_provision() from public,anon,authenticated,service_role;
create trigger provision_account_lifecycle after insert on auth.users for each row execute function private.lifecycle_provision();
-- Existing identities need an explicit acceptance; never backdate an agreement.
insert into private.account_lifecycle(parent_id,legacy_account,transition_deadline)
 select id,true,clock_timestamp()+interval '90 days' from auth.users on conflict do nothing;

create function private.lifecycle_identity() returns uuid language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=auth.uid(); sid uuid;
begin
 if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 or not exists(select 1 from auth.users u where u.id=actor and not u.is_anonymous and u.email_confirmed_at is not null and u.email is not null)
 then raise exception 'Verified parent authentication required' using errcode='42501'; end if;
 begin sid:=nullif(auth.jwt()->>'session_id','')::uuid; exception when others then sid:=null; end;
 if sid is null or not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=actor and (s.not_after is null or s.not_after>private.lifecycle_now())) then
  raise exception 'Current session required' using errcode='42501';
 end if;
 return actor;
end $$;
revoke all on function private.lifecycle_identity() from public,anon,authenticated,service_role;
create function private.require_fresh_parent() returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); stamp timestamptz; t timestamptz:=private.lifecycle_now();
begin
 select max(to_timestamp((a->>'timestamp')::double precision)) into stamp from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
 where a->>'method' in ('otp','oauth','password','totp') and a->>'timestamp' ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$';
 if stamp is null or stamp<t-interval '5 minutes' or stamp>t+interval '1 minute' then raise exception 'fresh_auth_required' using errcode='28000'; end if;
 return actor;
end $$;
revoke all on function private.require_fresh_parent() from public,anon,authenticated,service_role;
create function private.family_access_allowed(p_parent_id uuid) returns boolean language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare actor uuid;
begin
 actor:=private.lifecycle_identity();
 return actor=p_parent_id and exists(select 1 from private.account_lifecycle l where l.parent_id=actor and l.state='active' and l.terms_version='2026-11-22' and (not (select inactivity_enabled from private.lifecycle_controls) or private.lifecycle_now()<greatest(l.last_activity_at+interval '90 days',l.transition_deadline)));
exception when insufficient_privilege then return false;
end $$;
revoke all on function private.family_access_allowed(uuid) from public,anon,service_role;
grant execute on function private.family_access_allowed(uuid) to authenticated;
create function private.snapshot_consented(p_parent_id uuid,p_snapshot jsonb) returns boolean language sql stable security definer set search_path='' set timezone='UTC' as $$
 select auth.uid()=p_parent_id and not exists(select 1 from jsonb_array_elements(p_snapshot#>'{family,children}') child where not exists(
 select 1 from private.child_profile_consents c where c.parent_id=p_parent_id and c.child_id=child->>'id' and c.withdrawn_at is null))
$$;
revoke all on function private.snapshot_consented(uuid,jsonb) from public,anon,service_role;
grant execute on function private.snapshot_consented(uuid,jsonb) to authenticated;
drop policy family_read_own on public.family_documents;
create policy family_read_own on public.family_documents for select to authenticated
 using ((select auth.uid())=parent_id and private.family_access_allowed(parent_id) and private.snapshot_consented(parent_id,snapshot));
-- Preserve strict v1 validator while admitting the canonical zero-profile family
-- produced by consent withdrawal. No stale private child data survives it.
alter function private.valid_family_snapshot(jsonb) rename to valid_family_snapshot_with_profiles;
create function private.valid_family_snapshot(p jsonb) returns boolean language sql immutable set search_path='' set timezone='UTC' as $$
 select p='{"schemaVersion":1,"family":{"version":1,"children":[],"activeId":""},"data":{}}'::jsonb or private.valid_family_snapshot_with_profiles(p)
$$;
revoke all on function private.valid_family_snapshot(jsonb) from public,anon,authenticated,service_role;
create or replace function private.save_family_snapshot(p_base_revision bigint,p_snapshot jsonb) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); changed bigint; row public.family_documents;
begin
 -- Lock lifecycle before data consistently with delete/restore/withdraw races.
 perform 1 from private.account_lifecycle where parent_id=actor and state='active' and terms_version='2026-11-22' and (not (select inactivity_enabled from private.lifecycle_controls) or private.lifecycle_now()<greatest(last_activity_at+interval '90 days',transition_deadline)) for update;
 if not found or not private.family_access_allowed(actor) then raise exception 'account_blocked' using errcode='42501'; end if;
 if p_base_revision is null or p_base_revision<0 or p_base_revision>=9007199254740991 or p_snapshot is null or octet_length(p_snapshot::text)>262144 or not private.valid_family_snapshot(p_snapshot) then raise exception 'Invalid family snapshot' using errcode='22023'; end if;
 if not private.snapshot_consented(actor,p_snapshot) then raise exception 'profile_consent_required' using errcode='42501'; end if;
 if p_base_revision=0 then insert into public.family_documents(parent_id,snapshot,revision) values(actor,p_snapshot,1) on conflict(parent_id) do nothing;
 else update public.family_documents set snapshot=p_snapshot,revision=revision+1,updated_at=private.lifecycle_now() where parent_id=actor and revision=p_base_revision; end if;
 get diagnostics changed=row_count;
 select * into row from public.family_documents where parent_id=actor;
 -- Merely saving/synchronising does not count as conscious activity.
 return jsonb_build_object('saved',changed=1,'revision',coalesce(row.revision,0),'snapshot',row.snapshot);
end $$;

create function private.get_account_lifecycle() returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); l private.account_lifecycle; consents jsonb;
begin
 select * into strict l from private.account_lifecycle where parent_id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('profileId',child_id,'grantedAt',granted_at,'withdrawnAt',withdrawn_at,'method',method) order by granted_at),'[]'::jsonb)
 into consents from private.child_profile_consents where parent_id=actor and l.state='active';
 return jsonb_build_object('state',l.state,'termsVersion','2026-11-22','privacyVersion','2026-11-22',
 'acceptedTermsVersion',l.terms_version,'shownPrivacyVersion',l.privacy_version,'lastActivityAt',case when l.state='active' then l.last_activity_at end,
 'deletionDeadline',l.deletion_deadline,'consents',consents);
end $$;
create function private.complete_parent_onboarding(p_terms_version text,p_privacy_version text,p_parent_declaration boolean,p_accept_terms boolean,p_channel text default 'otp') returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); t timestamptz:=private.lifecycle_now(); channel text; l private.account_lifecycle;
begin
 if p_terms_version is distinct from '2026-11-22' or p_privacy_version is distinct from '2026-11-22' then raise exception 'document_version_changed' using errcode='22023'; end if;
 if p_parent_declaration is distinct from true or p_accept_terms is distinct from true then raise exception 'Adult guardian declaration and terms acceptance required' using errcode='22023'; end if;
 select * into strict l from private.account_lifecycle where parent_id=actor for update;
 t:=private.lifecycle_now();
 if l.state not in ('onboarding','active') then raise exception 'account_blocked' using errcode='42501'; end if;
 -- Channel is evidence from a signed Auth claim, never a browser assertion.
 channel:=case when exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method'='oauth') then 'google'
 when exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method'='otp') then 'otp' else 'other' end;
 insert into private.parent_acceptances(parent_id,terms_version,privacy_version,terms_sha256,privacy_sha256,accepted_at,signup_channel,parent_declaration)
 values(actor,p_terms_version,p_privacy_version,(select sha256 from private.legal_document_versions where kind='terms' and version=p_terms_version),(select sha256 from private.legal_document_versions where kind='privacy' and version=p_privacy_version),t,channel,true) on conflict(parent_id,terms_version) do nothing;
 update private.account_lifecycle set state='active',terms_version=p_terms_version,privacy_version=p_privacy_version,accepted_at=coalesce(accepted_at,t),parent_declaration=true,signup_channel=coalesce(signup_channel,channel),last_activity_at=coalesce(last_activity_at,t) where parent_id=actor;
 if l.state='onboarding' then insert into private.lifecycle_outbox(parent_id,kind,dedupe_key) values(actor,'welcome','welcome:'||actor::text) on conflict do nothing; end if;
 return private.get_account_lifecycle();
end $$;
create function private.consent_child_profile(p_child_id text,p_consent boolean,p_guardian_declaration boolean default false) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); t timestamptz:=private.lifecycle_now(); children jsonb; active text; d public.family_documents;
begin
 perform 1 from private.account_lifecycle where parent_id=actor and state='active' and terms_version='2026-11-22' and (not (select inactivity_enabled from private.lifecycle_controls) or private.lifecycle_now()<greatest(last_activity_at+interval '90 days',transition_deadline)) for update;
 if not found then raise exception 'account_blocked' using errcode='42501'; end if;
 t:=private.lifecycle_now();
 if not private.family_access_allowed(actor) then raise exception 'account_blocked' using errcode='42501'; end if;
 if p_child_id is null or p_child_id!~'^[a-zA-Z0-9_-]{1,80}$' or p_child_id in ('__proto__','prototype','constructor') or p_consent is null then raise exception 'Invalid profile consent' using errcode='22023'; end if;
 if p_consent then
  if p_guardian_declaration is distinct from true then raise exception 'Guardian declaration required' using errcode='22023'; end if;
  if exists(select 1 from private.child_profile_consents where parent_id=actor and child_id=p_child_id and withdrawn_at is not null) then raise exception 'profile_consent_revoked' using errcode='42501'; end if;
  if not exists(select 1 from private.child_profile_consents where parent_id=actor and child_id=p_child_id) and (select count(*) from private.child_profile_consents where parent_id=actor and withdrawn_at is null)>=5 then raise exception 'At most five online profiles' using errcode='22023'; end if;
  insert into private.child_profile_consents(parent_id,child_id,granted_at,privacy_version,guardian_declaration) values(actor,p_child_id,t,'2026-11-22',true) on conflict do nothing;
 else
  update private.child_profile_consents set withdrawn_at=coalesce(withdrawn_at,t) where parent_id=actor and child_id=p_child_id;
  if not found then raise exception 'Unknown profile consent' using errcode='22023'; end if;
  select * into d from public.family_documents where parent_id=actor for update;
  if found then
   select coalesce(jsonb_agg(child order by n),'[]'::jsonb) into children from jsonb_array_elements(d.snapshot#>'{family,children}') with ordinality c(child,n) where child->>'id'<>p_child_id;
   active:=d.snapshot#>>'{family,activeId}'; if active=p_child_id then active:=coalesce(children->0->>'id',''); end if;
   update public.family_documents set snapshot=jsonb_set(jsonb_set(jsonb_set(d.snapshot,'{family,children}',children),'{family,activeId}',to_jsonb(active)),'{data}',(d.snapshot->'data')-p_child_id),revision=revision+1,updated_at=t where parent_id=actor;
  end if;
 end if;
 update private.account_lifecycle set last_activity_at=greatest(last_activity_at,t) where parent_id=actor;
 update private.lifecycle_outbox set state='cancelled' where parent_id=actor and kind in ('inactivity_14','inactivity_3') and state in ('pending','working');
 return private.get_account_lifecycle();
end $$;
create function private.record_family_activity(p_event_id uuid,p_kind text,p_child_id text default null,p_occurred_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); t timestamptz:=private.lifecycle_now(); at timestamptz; l private.account_lifecycle; added bigint; deadline timestamptz;
begin
 select * into strict l from private.account_lifecycle where parent_id=actor for update;
 t:=private.lifecycle_now();
 if l.state<>'active' then raise exception 'account_blocked' using errcode='42501'; end if;
 deadline:=greatest(l.last_activity_at+interval '90 days',l.transition_deadline);
 if (select inactivity_enabled from private.lifecycle_controls) and t>=deadline then raise exception 'account_blocked' using errcode='42501'; end if;
 if p_event_id is null or p_kind not in ('parent_login','parent_action','reading') then raise exception 'Invalid activity' using errcode='22023'; end if;
 at:=coalesce(p_occurred_at,t);
 if at>t+interval '1 minute' or at<t-interval '48 hours' or (p_kind<>'reading' and p_occurred_at is not null) then raise exception 'Invalid activity time' using errcode='22023'; end if;
 at:=least(at,t);
 if p_kind='reading' and (p_child_id is null or not exists(select 1 from private.child_profile_consents where parent_id=actor and child_id=p_child_id and withdrawn_at is null) or not exists(select 1 from public.family_documents f,jsonb_array_elements(f.snapshot#>'{family,children}') c where f.parent_id=actor and c->>'id'=p_child_id)) then raise exception 'Consented online profile required' using errcode='42501'; end if;
 insert into private.family_activity_events(parent_id,event_id,occurred_at,received_at,kind) values(actor,p_event_id,at,t,p_kind) on conflict do nothing;
 get diagnostics added=row_count;
 if added=1 and at>l.last_activity_at then
  update private.account_lifecycle set last_activity_at=at where parent_id=actor;
  update private.lifecycle_outbox set state='cancelled' where parent_id=actor and kind in ('inactivity_14','inactivity_3') and state in ('pending','working');
 end if;
 return jsonb_build_object('recorded',added=1,'lastActivityAt',(select last_activity_at from private.account_lifecycle where parent_id=actor));
end $$;
create function private.request_account_deletion() returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.require_fresh_parent(); t timestamptz:=private.lifecycle_now(); l private.account_lifecycle;
begin
 select * into strict l from private.account_lifecycle where parent_id=actor for update;
 t:=private.lifecycle_now();
 actor:=private.require_fresh_parent();
 if l.state='deletion_pending' then return private.get_account_lifecycle(); end if;
 if l.state<>'active' or not private.family_access_allowed(actor) then raise exception 'account_blocked' using errcode='42501'; end if;
 update private.account_lifecycle set state='deletion_pending',deletion_requested_at=t,deletion_deadline=t+interval '30 days',deletion_reason='parent' where parent_id=actor;
 update private.lifecycle_outbox set state='cancelled' where parent_id=actor and kind in ('inactivity_14','inactivity_3') and state in ('pending','working');
 insert into private.lifecycle_outbox(parent_id,kind,dedupe_key,payload) values(actor,'deletion_requested','parent-delete:'||actor::text||':'||t::text,jsonb_build_object('deadline',t+interval '30 days'));
 -- Removing sessions revokes refresh and strict RPC/RLS checks immediately.
 delete from auth.sessions where user_id=actor;
 return jsonb_build_object('state','deletion_pending','deletionDeadline',t+interval '30 days');
end $$;
create function private.restore_account() returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.require_fresh_parent(); t timestamptz:=private.lifecycle_now(); l private.account_lifecycle;
begin
 select * into strict l from private.account_lifecycle where parent_id=actor for update;
 t:=private.lifecycle_now();
 actor:=private.require_fresh_parent();
 if l.state<>'deletion_pending' or l.deletion_deadline<=t then raise exception 'account_blocked' using errcode='42501'; end if;
 update private.account_lifecycle set state='active',last_activity_at=t,deletion_requested_at=null,deletion_deadline=null,deletion_reason=null,transition_deadline=null where parent_id=actor;
 update private.lifecycle_outbox set state='cancelled' where parent_id=actor and kind='deletion_requested' and state='pending';
 insert into private.lifecycle_outbox(parent_id,kind,dedupe_key) values(actor,'account_restored','restore:'||actor::text||':'||t::text);
 return private.get_account_lifecycle();
end $$;
-- Public API functions are invokers; narrowly scoped private definers perform
-- the authorization and own-data transaction, never trusting a supplied owner.
create function public.get_account_lifecycle() returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.get_account_lifecycle() $$;
create function public.complete_parent_onboarding(p_terms_version text,p_privacy_version text,p_parent_declaration boolean,p_accept_terms boolean,p_channel text default 'otp') returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.complete_parent_onboarding(p_terms_version,p_privacy_version,p_parent_declaration,p_accept_terms,p_channel) $$;
create function public.consent_child_profile(p_child_id text,p_consent boolean,p_guardian_declaration boolean default false) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.consent_child_profile(p_child_id,p_consent,p_guardian_declaration) $$;
create function public.record_family_activity(p_event_id uuid,p_kind text,p_child_id text default null,p_occurred_at timestamptz default null) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.record_family_activity(p_event_id,p_kind,p_child_id,p_occurred_at) $$;
create function public.request_account_deletion() returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.request_account_deletion() $$;
create function public.restore_account() returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.restore_account() $$;
do $$ declare sig text; begin foreach sig in array array['get_account_lifecycle()','complete_parent_onboarding(text,text,boolean,boolean,text)','consent_child_profile(text,boolean,boolean)','record_family_activity(uuid,text,text,timestamptz)','request_account_deletion()','restore_account()'] loop
 execute 'revoke all on function private.'||sig||' from public,anon,authenticated,service_role'; execute 'grant execute on function private.'||sig||' to authenticated';
 execute 'revoke all on function public.'||sig||' from public,anon,authenticated,service_role'; execute 'grant execute on function public.'||sig||' to authenticated';
 end loop; end $$;

-- Lock down existing administrator paths as well as family data. Old tokens
-- and incomplete registrations must not retain administrative app privileges.
drop policy admins_read_own on public.content_admins;
create policy admins_read_own on public.content_admins for select to authenticated using((select auth.uid())=user_id and private.family_access_allowed(user_id));
create or replace function private.is_confirmed_email_admin(p_actor_id uuid) returns boolean language sql stable set search_path='' set timezone='UTC' as $$
 select exists(select 1 from auth.users u join public.content_admins a on a.user_id=u.id join private.account_lifecycle l on l.parent_id=u.id
 where u.id=p_actor_id and not u.is_anonymous and u.email_confirmed_at is not null and u.email is not null and l.state='active' and l.terms_version='2026-11-22'
 and (not (select inactivity_enabled from private.lifecycle_controls) or private.lifecycle_now()<greatest(l.last_activity_at+interval '90 days',l.transition_deadline))
 and case when auth.uid() is null then true else (p_actor_id=auth.uid() and p_actor_id=private.lifecycle_identity()) end)
$$;
alter function private.save_content_draft(text,bigint,jsonb) rename to save_content_draft_before_lifecycle;
revoke all on function private.save_content_draft_before_lifecycle(text,bigint,jsonb) from public,anon,authenticated,service_role;
create function private.save_content_draft(p_story_id text,p_base_revision bigint,p_draft jsonb) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
begin if not private.family_access_allowed(auth.uid()) then raise exception 'Active administrator required' using errcode='42501'; end if;
 return private.save_content_draft_before_lifecycle(p_story_id,p_base_revision,p_draft); end $$;
revoke all on function private.save_content_draft(text,bigint,jsonb) from public,anon,service_role; grant execute on function private.save_content_draft(text,bigint,jsonb) to authenticated;
create or replace function public.save_content_draft(p_story_id text,p_base_revision bigint,p_draft jsonb) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.save_content_draft(p_story_id,p_base_revision,p_draft) $$;
alter function private.publish_content_release(text,bigint,jsonb) rename to publish_content_release_before_lifecycle;
revoke all on function private.publish_content_release_before_lifecycle(text,bigint,jsonb) from public,anon,authenticated,service_role;
create function private.publish_content_release(p_story_id text,p_base_revision bigint,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
begin if not private.family_access_allowed(auth.uid()) then raise exception 'Active administrator required' using errcode='42501'; end if;
 return private.publish_content_release_before_lifecycle(p_story_id,p_base_revision,p_payload); end $$;
revoke all on function private.publish_content_release(text,bigint,jsonb) from public,anon,service_role; grant execute on function private.publish_content_release(text,bigint,jsonb) to authenticated;
create or replace function public.publish_content_release(p_story_id text,p_base_revision bigint,p_payload jsonb) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.publish_content_release(p_story_id,p_base_revision,p_payload) $$;

-- Scheduler only prepares work. Claiming locks and rechecks the same lifecycle
-- row as restore/activity; the exact boundary has one unambiguous winner.
create function private.prepare_lifecycle_jobs() returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare l private.account_lifecycle; t timestamptz:=private.lifecycle_now(); due timestamptz; enabled boolean; n integer:=0; reason text;
begin
 select inactivity_enabled into enabled from private.lifecycle_controls;
 for l in select * from private.account_lifecycle where state in ('onboarding','active','deletion_pending') for update skip locked loop
  due:=greatest(l.last_activity_at+interval '90 days',l.transition_deadline); reason:=null;
  if l.state='deletion_pending' and l.deletion_deadline<=t then reason:='parent';
  elsif l.state='onboarding' and not l.legacy_account and l.created_at+interval '7 days'<=t then reason:='abandoned';
  elsif enabled and l.state='active' and due<=t then reason:='inactivity';
  end if;
  if reason is not null then
   update private.account_lifecycle set state='deleting',deletion_reason=reason,deletion_deadline=case when reason='parent' then l.deletion_deadline else coalesce(due,t) end where parent_id=l.parent_id;
   delete from auth.sessions where user_id=l.parent_id;
   update private.lifecycle_outbox set state='cancelled' where parent_id=l.parent_id and kind<>'delete_account' and state in ('pending','working');
   insert into private.lifecycle_outbox(parent_id,kind,dedupe_key,payload) values(l.parent_id,'delete_account','delete:'||l.parent_id::text,jsonb_build_object('reason',reason)) on conflict do nothing;
   n:=n+1;
  elsif enabled and l.state='active' and due>t then
   if due-t<=interval '14 days' then insert into private.lifecycle_outbox(parent_id,kind,dedupe_key,payload) values(l.parent_id,'inactivity_14','inactive14:'||l.parent_id::text||':'||due::text,jsonb_build_object('deadline',due)) on conflict do nothing; end if;
   if due-t<=interval '3 days' then insert into private.lifecycle_outbox(parent_id,kind,dedupe_key,payload) values(l.parent_id,'inactivity_3','inactive3:'||l.parent_id::text||':'||due::text,jsonb_build_object('deadline',due)) on conflict do nothing; end if;
  end if;
 end loop;
 -- Bounded metadata retention. Child/account operational data cascades on Auth
 -- deletion; no legal/financial copy is made because no paid route is enabled.
 -- Event IDs remain for the account lifetime; erasure cascades them. A
 -- deduplication TTL would allow an old offline event to become new again.
 delete from private.deletion_receipts where expires_at<t;
 delete from private.lifecycle_outbox where state in ('done','cancelled') and coalesce(completed_at,created_at)<t-interval '30 days';
 delete from private.privacy_requests where expires_at<t;
 return jsonb_build_object('prepared',n,'inactivityEnabled',enabled);
end $$;
revoke all on function private.prepare_lifecycle_jobs() from public,anon,authenticated,service_role;
create function private.lifecycle_candidate_report() returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare t timestamptz:=private.lifecycle_now();
begin return jsonb_build_object('generatedAt',t,'inactivityEnabled',(select inactivity_enabled from private.lifecycle_controls),
 'active',(select count(*) from private.account_lifecycle where state='active'),
 'onboarding',(select count(*) from private.account_lifecycle where state='onboarding'),
 'inactivityCandidates',(select count(*) from private.account_lifecycle where state='active' and greatest(last_activity_at+interval '90 days',transition_deadline)<=t),
 'legacyWithoutReliableActivity',(select count(*) from private.account_lifecycle where legacy_account and last_activity_at is null),
 'pendingManualDeletions',(select count(*) from private.account_lifecycle where state='deletion_pending'),
 'overduePrivacyRequests',(select count(*) from private.privacy_requests where state not in ('completed','declined') and coalesce(extended_due_at,response_due_at)<t),
 'jobsNeedingAttention',(select count(*) from private.lifecycle_outbox where state='attention'));
end $$;
revoke all on function private.lifecycle_candidate_report() from public,anon,authenticated,service_role;
create function private.verify_lifecycle_worker(p_token text) returns boolean language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare secret text;
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then return false; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='fabelpad_lifecycle_worker_token';
 return secret is not null and sha256(convert_to(p_token,'UTF8'))=sha256(convert_to(secret,'UTF8'));
end $$;
revoke all on function private.verify_lifecycle_worker(text) from public,anon,authenticated,service_role;
create function private.claim_lifecycle_jobs(p_limit integer default 5) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare t timestamptz:=private.lifecycle_now(); jobs jsonb;
begin
 if p_limit not between 1 and 10 then raise exception 'Invalid batch limit' using errcode='22023'; end if;
 perform private.prepare_lifecycle_jobs();
 -- A provider accepted a message but response/commit was lost: its idempotency
 -- window is 24h. Later retries require operator inspection, never blind resend.
 update private.lifecycle_outbox set state='attention',last_error_code='delivery_uncertain' where kind<>'delete_account' and state in ('pending','working') and first_attempt_at<t-interval '23 hours';
 with candidates as(select id from private.lifecycle_outbox where available_at<=t and (state='pending' or (state='working' and locked_until<t)) order by available_at,id for update skip locked limit p_limit),
 claimed as(update private.lifecycle_outbox o set state='working',lease_id=gen_random_uuid(),locked_until=t+interval '2 minutes',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,t)
 from candidates c where o.id=c.id returning o.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'leaseId',c.lease_id,'parentId',c.parent_id,'kind',c.kind,'payload',c.payload,'firstAttemptAt',c.first_attempt_at,'createdAt',c.created_at)),'[]'::jsonb) into jobs from claimed c;
 return jobs;
end $$;
revoke all on function private.claim_lifecycle_jobs(integer) from public,anon,authenticated,service_role;
create function private.get_lifecycle_job_context(p_job_id uuid,p_lease_id uuid) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare o private.lifecycle_outbox; l private.account_lifecycle; recipient text; objects jsonb;
begin
 select * into o from private.lifecycle_outbox where id=p_job_id and lease_id=p_lease_id and state='working' and locked_until>private.lifecycle_now();
 if not found then return null; end if;
 select * into l from private.account_lifecycle where parent_id=o.parent_id;
 if not found then
  if o.kind='delete_account' then
   select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name)),'[]'::jsonb) into objects from storage.objects where owner_id=o.parent_id::text or owner=o.parent_id;
   return jsonb_build_object('alreadyDeleted',true,'parentId',o.parent_id,'kind',o.kind,'payload',o.payload,'objects',objects);
  end if;
  update private.lifecycle_outbox set state='cancelled' where id=o.id; return null;
 end if;
 if (o.kind='delete_account' and l.state<>'deleting') or (o.kind='deletion_requested' and l.state<>'deletion_pending') or
 (o.kind in ('inactivity_14','inactivity_3') and (l.state<>'active' or (o.payload->>'deadline')::timestamptz is distinct from greatest(l.last_activity_at+interval '90 days',l.transition_deadline))) then
  update private.lifecycle_outbox set state='cancelled' where id=o.id; return null;
 end if;
 select email into recipient from auth.users where id=o.parent_id and email_confirmed_at is not null and not is_anonymous;
 -- Actual hosted Storage inventory, not a promise based on source-code paths.
 -- No current Fabelpad upload routes exist; unexpected objects stop deletion
 -- until the worker removes every owned object through the Storage API.
 if o.kind='delete_account' then
  select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name)),'[]'::jsonb) into objects from storage.objects where owner_id=o.parent_id::text or owner=o.parent_id;
 end if;
 return jsonb_build_object('alreadyDeleted',false,'parentId',o.parent_id,'kind',o.kind,'recipient',recipient,'payload',o.payload,'objects',objects);
end $$;
revoke all on function private.get_lifecycle_job_context(uuid,uuid) from public,anon,authenticated,service_role;
create function private.complete_lifecycle_job(p_job_id uuid,p_lease_id uuid,p_provider_id text default null,p_auth_deleted boolean default false,p_storage_checked boolean default false) returns boolean language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare o private.lifecycle_outbox; t timestamptz:=private.lifecycle_now();
begin
 select * into o from private.lifecycle_outbox where id=p_job_id and lease_id=p_lease_id and state='working' for update;
 if not found then return false; end if;
 if o.kind='delete_account' then
  if not p_auth_deleted or not p_storage_checked or exists(select 1 from auth.users where id=o.parent_id) or exists(select 1 from storage.objects where owner_id=o.parent_id::text or owner=o.parent_id) then raise exception 'Deletion not verified' using errcode='22023'; end if;
  insert into private.deletion_receipts(operation_id,subject_digest,reason,completed_at,expires_at,auth_deleted,storage_checked)
  values(o.id,encode(sha256(convert_to(o.parent_id::text,'UTF8')),'hex'),o.payload->>'reason',t,t+interval '90 days',true,true) on conflict do nothing;
  update private.privacy_requests set state='completed',completed_at=t,expires_at=t+interval '12 months' where deletion_operation_id=o.id and state='executing';
  -- Remove frozen recipients and all operational account links from every
  -- related outbox row as well, including already sent/cancelled welcome mail.
  update private.lifecycle_outbox set parent_id=null,payload='{}'::jsonb,dedupe_key='purged:'||id::text,provider_id=null,
   state=case when id=o.id then state else 'cancelled' end,lease_id=case when id=o.id then lease_id else null end,locked_until=case when id=o.id then locked_until else null end
   where parent_id=o.parent_id;
  update private.lifecycle_outbox set payload=jsonb_build_object('reason',o.payload->>'reason') where id=o.id;
 else
  if p_provider_id is null or p_provider_id!~'^[A-Za-z0-9-]{8,100}$' then raise exception 'Provider receipt required' using errcode='22023'; end if;
 end if;
 update private.lifecycle_outbox set state='done',completed_at=t,provider_id=p_provider_id,lease_id=null,locked_until=null,last_error_code=null where id=o.id;
 return true;
end $$;
revoke all on function private.complete_lifecycle_job(uuid,uuid,text,boolean,boolean) from public,anon,authenticated,service_role;
create function private.fail_lifecycle_job(p_job_id uuid,p_lease_id uuid,p_error text) returns boolean language plpgsql security definer set search_path='' set timezone='UTC' as $$
begin
 if p_error not in ('provider_unavailable','storage_unverified','auth_unavailable','delivery_uncertain','configuration_unavailable') then raise exception 'Invalid safe error code' using errcode='22023'; end if;
 update private.lifecycle_outbox set state=case when p_error='delivery_uncertain' then 'attention' else 'pending' end,
 first_attempt_at=case when p_error='configuration_unavailable' and not (payload ? 'delivery') then null else first_attempt_at end,
 available_at=private.lifecycle_now()+least(interval '1 hour',interval '30 seconds'*power(2,least(attempts,7))),locked_until=null,lease_id=null,last_error_code=p_error
 where id=p_job_id and lease_id=p_lease_id and state='working'; return found;
end $$;
revoke all on function private.fail_lifecycle_job(uuid,uuid,text) from public,anon,authenticated,service_role;
-- Administrative AVG register. Reference ties to the restricted support mailbox
-- without copying message content. A child can contact support without login.
create function private.register_privacy_request(p_reference text,p_kind text,p_scope text,p_parent_id uuid default null,p_child_id text default null,p_received_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); t timestamptz:=private.lifecycle_now(); result private.privacy_requests;
begin
 if not private.is_confirmed_email_admin(actor) or p_reference is null or p_reference!~'^[A-Za-z0-9_-]{6,80}$' then raise exception 'Administrator and support reference required' using errcode='42501'; end if;
 if p_received_at is not null and (p_received_at>t or p_received_at<t-interval '2 years') then raise exception 'Invalid actual mailbox receipt time' using errcode='22023'; end if;
 insert into private.privacy_requests(reference,received_at,response_due_at,request_kind,subject_scope,parent_id,child_id)
 values(p_reference,coalesce(p_received_at,t),coalesce(p_received_at,t)+interval '1 month',p_kind,p_scope,p_parent_id,p_child_id) on conflict(reference) do update set reference=excluded.reference returning * into result;
 if result.request_kind is distinct from p_kind or result.subject_scope is distinct from p_scope or result.parent_id is distinct from p_parent_id or result.child_id is distinct from p_child_id then raise exception 'Support reference belongs to another scope' using errcode='22023'; end if;
 return jsonb_build_object('id',result.id,'receivedAt',result.received_at,'responseDueAt',result.response_due_at,'state',result.state);
end $$;
revoke all on function private.register_privacy_request(text,text,text,uuid,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function private.register_privacy_request(text,text,text,uuid,text,timestamptz) to authenticated;
create function public.register_privacy_request(p_reference text,p_kind text,p_scope text,p_parent_id uuid default null,p_child_id text default null,p_received_at timestamptz default null) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.register_privacy_request(p_reference,p_kind,p_scope,p_parent_id,p_child_id,p_received_at) $$;
revoke all on function public.register_privacy_request(text,text,text,uuid,text,timestamptz) from public,anon,service_role; grant execute on function public.register_privacy_request(text,text,text,uuid,text,timestamptz) to authenticated;
-- Service-role-only worker contract. Service credential is automatic Edge
-- runtime configuration and is never supplied to Next/build/browser/GitHub.
create function public.verify_lifecycle_worker(p_token text) returns boolean language sql stable security invoker set search_path='' set timezone='UTC' as $$ select private.verify_lifecycle_worker(p_token) $$;
create function public.claim_lifecycle_jobs(p_limit integer default 5) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.claim_lifecycle_jobs(p_limit) $$;
create function public.get_lifecycle_job_context(p_job_id uuid,p_lease_id uuid) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.get_lifecycle_job_context(p_job_id,p_lease_id) $$;
create function public.complete_lifecycle_job(p_job_id uuid,p_lease_id uuid,p_provider_id text default null,p_auth_deleted boolean default false,p_storage_checked boolean default false) returns boolean language sql security invoker set search_path='' set timezone='UTC' as $$ select private.complete_lifecycle_job(p_job_id,p_lease_id,p_provider_id,p_auth_deleted,p_storage_checked) $$;
create function public.fail_lifecycle_job(p_job_id uuid,p_lease_id uuid,p_error text) returns boolean language sql security invoker set search_path='' set timezone='UTC' as $$ select private.fail_lifecycle_job(p_job_id,p_lease_id,p_error) $$;
create function public.lifecycle_candidate_report() returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.lifecycle_candidate_report() $$;
do $$ declare sig text; begin foreach sig in array array['verify_lifecycle_worker(text)','claim_lifecycle_jobs(integer)','get_lifecycle_job_context(uuid,uuid)','complete_lifecycle_job(uuid,uuid,text,boolean,boolean)','fail_lifecycle_job(uuid,uuid,text)','lifecycle_candidate_report()'] loop
 execute 'revoke all on function private.'||sig||' from public,anon,authenticated,service_role'; execute 'grant execute on function private.'||sig||' to service_role';
 execute 'revoke all on function public.'||sig||' from public,anon,authenticated,service_role'; execute 'grant execute on function public.'||sig||' to service_role';
 end loop; end $$;

create function private.manage_privacy_request(p_request_id uuid,p_action text,p_verification_method text default null,p_extension_reason text default null,p_parent_id uuid default null,p_child_id text default null) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); r private.privacy_requests; t timestamptz:=private.lifecycle_now(); f public.family_documents; children jsonb; active text; operation uuid;
begin
 if not private.is_confirmed_email_admin(actor) then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into strict r from private.privacy_requests where id=p_request_id for update;
 if r.state in ('completed','declined') then return jsonb_build_object('id',r.id,'state',r.state,'responseDueAt',coalesce(r.extended_due_at,r.response_due_at)); end if;
 if p_action='bind_subject' then
  if r.verification<>'pending' or r.state not in ('received','extended') or r.parent_id is not null or p_parent_id is null or not exists(select 1 from private.account_lifecycle where parent_id=p_parent_id) then raise exception 'Only unverified unbound cases may bind a subject' using errcode='22023'; end if;
  if (r.subject_scope='parent' and p_child_id is not null) or (r.subject_scope='child' and (p_child_id is null or not exists(select 1 from private.child_profile_consents where parent_id=p_parent_id and child_id=p_child_id))) then raise exception 'Subject does not match fixed case scope' using errcode='22023'; end if;
  update private.privacy_requests set parent_id=p_parent_id,child_id=p_child_id where id=r.id;
 elsif p_action='verify' then
  if p_verification_method not in ('verified_parent','proportionate_support') or r.parent_id is null or not exists(select 1 from private.account_lifecycle where parent_id=r.parent_id) then raise exception 'Proportionate subject verification required' using errcode='22023'; end if;
  if r.subject_scope='child' and not exists(select 1 from private.child_profile_consents where parent_id=r.parent_id and child_id=r.child_id) then raise exception 'Unknown scoped subject' using errcode='22023'; end if;
  update private.privacy_requests set verification='verified',verification_method=p_verification_method,state='verified',first_response_at=coalesce(first_response_at,t) where id=r.id;
 elsif p_action='extend' then
  if t>r.response_due_at or p_extension_reason is null or length(btrim(p_extension_reason)) not between 10 and 300 then raise exception 'Notify requester with a reason within first calendar month' using errcode='22023'; end if;
  update private.privacy_requests set state='extended',first_response_at=coalesce(first_response_at,t),extension_reason=p_extension_reason,extended_due_at=r.response_due_at+interval '2 months' where id=r.id;
 elsif p_action='execute_erasure' then
  if r.verification<>'verified' or r.request_kind not in ('erasure','consent_withdrawal') then raise exception 'Verified scoped erasure required' using errcode='42501'; end if;
  -- Serialize with parent restore/write/activity. Child requests always stay
  -- inside that child scope; an administrator cannot accidentally close family.
  perform 1 from private.account_lifecycle where parent_id=r.parent_id for update;
  if r.subject_scope='parent' then
   if r.request_kind<>'erasure' then raise exception 'Parent erasure must be explicit' using errcode='22023'; end if;
   update private.account_lifecycle set state='deleting',deletion_reason='privacy',deletion_deadline=t where parent_id=r.parent_id;
   delete from auth.sessions where user_id=r.parent_id;
   update private.lifecycle_outbox set state='cancelled' where parent_id=r.parent_id and kind<>'delete_account' and state in ('pending','working');
   insert into private.lifecycle_outbox(parent_id,kind,dedupe_key,payload) values(r.parent_id,'delete_account','delete:'||r.parent_id::text,jsonb_build_object('reason','privacy')) on conflict(dedupe_key) do update set id=private.lifecycle_outbox.id returning id into operation;
   update private.privacy_requests set state='executing',deletion_operation_id=operation,first_response_at=coalesce(first_response_at,t) where id=r.id;
  else
   update private.child_profile_consents set withdrawn_at=coalesce(withdrawn_at,t) where parent_id=r.parent_id and child_id=r.child_id;
   select * into f from public.family_documents where parent_id=r.parent_id for update;
   if found then
    select coalesce(jsonb_agg(child order by n),'[]'::jsonb) into children from jsonb_array_elements(f.snapshot#>'{family,children}') with ordinality c(child,n) where child->>'id'<>r.child_id;
    active:=f.snapshot#>>'{family,activeId}'; if active=r.child_id then active:=coalesce(children->0->>'id',''); end if;
    update public.family_documents set snapshot=jsonb_set(jsonb_set(jsonb_set(f.snapshot,'{family,children}',children),'{family,activeId}',to_jsonb(active)),'{data}',(f.snapshot->'data')-r.child_id),revision=revision+1,updated_at=t where parent_id=r.parent_id;
   end if;
   update private.privacy_requests set state='completed',first_response_at=coalesce(first_response_at,t),completed_at=t,expires_at=t+interval '12 months' where id=r.id;
  end if;
 elsif p_action='complete' then
  if r.request_kind in ('erasure','consent_withdrawal') then raise exception 'Erasure execution receipt required' using errcode='22023'; end if;
  if r.verification<>'verified' then raise exception 'Verify before completion' using errcode='42501'; end if;
  if r.state='executing' and r.subject_scope='parent' and exists(select 1 from auth.users where id=r.parent_id) then raise exception 'Erasure still incomplete' using errcode='22023'; end if;
  update private.privacy_requests set state='completed',first_response_at=coalesce(first_response_at,t),completed_at=t,expires_at=t+interval '12 months' where id=r.id;
 elsif p_action='decline' then
  update private.privacy_requests set state='declined',first_response_at=coalesce(first_response_at,t),completed_at=t,expires_at=t+interval '12 months' where id=r.id;
 else raise exception 'Invalid privacy case action' using errcode='22023'; end if;
 select * into r from private.privacy_requests where id=r.id;
 return jsonb_build_object('id',r.id,'state',r.state,'responseDueAt',coalesce(r.extended_due_at,r.response_due_at),'completedAt',r.completed_at);
end $$;
revoke all on function private.manage_privacy_request(uuid,text,text,text,uuid,text) from public,anon,service_role; grant execute on function private.manage_privacy_request(uuid,text,text,text,uuid,text) to authenticated;
create function public.manage_privacy_request(p_request_id uuid,p_action text,p_verification_method text default null,p_extension_reason text default null,p_parent_id uuid default null,p_child_id text default null) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.manage_privacy_request(p_request_id,p_action,p_verification_method,p_extension_reason,p_parent_id,p_child_id) $$;
revoke all on function public.manage_privacy_request(uuid,text,text,text,uuid,text) from public,anon,service_role; grant execute on function public.manage_privacy_request(uuid,text,text,text,uuid,text) to authenticated;
-- Freeze recipient, copy and sender for a provider idempotency key before first
-- send. A template/key rotation must never change a retry's message bytes.
create function private.freeze_lifecycle_email(p_job_id uuid,p_lease_id uuid,p_delivery jsonb) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare o private.lifecycle_outbox;
begin
 if jsonb_typeof(p_delivery)<>'object' or octet_length(p_delivery::text)>240000 or not (p_delivery ?& array['from','to','replyTo','message']) or exists(select 1 from jsonb_object_keys(p_delivery) k where k not in ('from','to','replyTo','message')) then raise exception 'Invalid safe message snapshot' using errcode='22023'; end if;
 select * into o from private.lifecycle_outbox where id=p_job_id and lease_id=p_lease_id and state='working' and locked_until>private.lifecycle_now() for update;
 if not found or o.kind='delete_account' then return null; end if;
 if o.payload ? 'delivery' then return o.payload->'delivery'; end if;
 update private.lifecycle_outbox set payload=jsonb_set(payload,'{delivery}',p_delivery) where id=o.id;
 return p_delivery;
end $$;
revoke all on function private.freeze_lifecycle_email(uuid,uuid,jsonb) from public,anon,authenticated; grant execute on function private.freeze_lifecycle_email(uuid,uuid,jsonb) to service_role;
create function public.freeze_lifecycle_email(p_job_id uuid,p_lease_id uuid,p_delivery jsonb) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$ select private.freeze_lifecycle_email(p_job_id,p_lease_id,p_delivery) $$;
revoke all on function public.freeze_lifecycle_email(uuid,uuid,jsonb) from public,anon,authenticated; grant execute on function public.freeze_lifecycle_email(uuid,uuid,jsonb) to service_role;

create function private.list_privacy_requests(p_limit integer default 100,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=private.lifecycle_identity(); total bigint; result jsonb; count_rows integer;
begin
 if not private.is_confirmed_email_admin(actor) then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Invalid case pagination' using errcode='22023'; end if;
 select count(*) into total from private.privacy_requests;
 select coalesce(jsonb_agg(item),'[]'::jsonb),count(*) into result,count_rows from (
  select jsonb_build_object('id',id,'reference',reference,'receivedAt',received_at,'responseDueAt',response_due_at,
  'kind',request_kind,'scope',subject_scope,'parentId',parent_id,'profileId',child_id,'verification',verification,'state',state,
  'verificationMethod',verification_method,'firstResponseAt',first_response_at,'completedAt',completed_at,
  'extendedDueAt',extended_due_at,'extensionReason',extension_reason) item
  from private.privacy_requests order by case when state in ('completed','declined') then 1 else 0 end,
  case when state not in ('completed','declined') then coalesce(extended_due_at,response_due_at) end asc,
  completed_at desc nulls last,received_at desc,id limit p_limit offset p_offset
 ) page;
 return jsonb_build_object('cases',result,'total',total,'nextOffset',case when p_offset+count_rows<total then p_offset+count_rows end,'truncated',p_offset+count_rows<total);
end $$;
revoke all on function private.list_privacy_requests(integer,integer) from public,anon,service_role; grant execute on function private.list_privacy_requests(integer,integer) to authenticated;
create function public.list_privacy_requests(p_limit integer default 100,p_offset integer default 0) returns jsonb language sql security invoker set search_path='' set timezone='UTC' as $$select private.list_privacy_requests(p_limit,p_offset)$$;
revoke all on function public.list_privacy_requests(integer,integer) from public,anon,service_role; grant execute on function public.list_privacy_requests(integer,integer) to authenticated;
