# Fabelpad — gegevensbeschermingseffectbeoordeling

Beoordelingsdatum: **22 november 2026**. Beoordelde scope: de gratis webdienst met optioneel online kinderprofiel, volwassen ouderaccount, e-mail-OTP/Google-login, Supabase custom SMTP via Resend, afzonderlijke Resend-API-outbox en accountlevenscyclus. De lokale Android-app is een afzonderlijke beperkte gegevensstroom. Betaalde abonnementen, advertenties, kindchat, open gebruikersprofielen, AI en biometrie zijn niet in gebruik en krijgen geen impliciete goedkeuring uit deze beoordeling.

**Uitkomst:** voer voor de online kinderfuncties een DPIA uit. Kinderen zijn kwetsbare betrokkenen; het langdurig per profiel bewaren van leeskeuzes en activiteit beoordelen we voorzichtig ook als stelselmatige gedragsregistratie. Deze beoordeling beschrijft noodzaak, risico’s en maatregelen. De eigenaar heeft daarna de maximale back-upbewaring van 180 dagen, Stackmail als supportleverancier en de verwerkers-/doorgifteafspraken bevestigd. Die feiten sluiten de overeenkomstige informatievragen. De eigenaar heeft gewone supportbewaring vervolgens expliciet op maximaal 12 maanden na afsluiting bevestigd. Toepasselijke providerlogcriteria, het interne hostingregister en operationele herstel-/verwijderdekking blijven afzonderlijk te beoordelen; zij worden niet automatisch laag restrisico. De toepasselijke maatregelen moeten vóór de desbetreffende verwerking of herstelhandeling op orde zijn. De gratis lokale leesroute kan onafhankelijk beschikbaar blijven. Een geteste implementatie bewijst geen goedkeuring van een toezichthouder.

## Aanvulling op basis van de eigenaar

Bron: de projecteigenaar bevestigde op **22 november 2026** maximale technische back-upbewaring **180 dagen**, supportleverancier **Stackmail**, gewone supportcorrespondentie **maximaal 12 maanden na afsluiting**, toepasselijke verwerkers-/doorgifteafspraken en overgenomen Supabase Auth-templates. Deze aanvulling is een vastgelegde eigenaarbron. Zie het [nieuwe eigenaarbewijs](deploy-evidence/privacy-owner-confirmation-2026-11-22.json). De eerdere technische bewijsbestanden blijven historische momentopnamen. Er is geen nieuwe providerinspectie, echte mailontvangst of back-upherstelproef uitgevoerd door deze documentwijziging.

De 180 dagen worden uitsluitend op technische back-ups toegepast. Gewone supportmail heeft de bevestigde termijn van maximaal 12 maanden na afsluiting; minimale AVG-zaakmetadata heeft in SQL een afzonderlijke 12-maandentermijn. De eerder toegepaste SQL laat wisbewijzen na 90 dagen vervallen. Een lokale opvolgmigratie bereidt 210 dagen voor minimale ouder-/kindwisbewijzen voor. Deze wijziging maakt geen onafhankelijke hersteljournal: latere verwijderingen staan niet in een oudere kopie van dezelfde database. Een volledige actuele wis-/intrekkingsstatus buiten het teruggezette domein, of weigering van ongedekte herstelpunten, blijft nodig vóór herstelverkeer.

## 1. Besluit en methode

De [Autoriteit Persoonsgegevens](https://autoriteitpersoonsgegevens.nl/themas/avg-privacy/praktisch-avg/data-protection-impact-assessment-dpia) en de [EDPB](https://www.edpb.europa.eu/sme/be-compliant/be-compliant_en) beschrijven indicatoren voor waarschijnlijk hoog risico. We gebruiken die indicatoren om de omvang van deze beoordeling te bepalen. De verwerking wordt niet automatisch onschadelijk doordat een profiel een bijnaam heeft. Een account- en profiel-ID zijn nog persoonsgegevens wanneer een gezin eraan kan worden gekoppeld.

| Indicator | Beoordeling voor huidige scope |
| --- | --- |
| Beoordeling/scoring van personen | Geen school-, gezondheids-, advertentie- of geschiktheidsscore. Wel vaste verhaalkeuzes; geen diagnostische conclusies daaruit trekken |
| Besluiten met wezenlijk gevolg | Geen profielgebaseerde rechtsgevolgen. De automatische inactiviteitsdeadline kan wel voortgang doen verdwijnen; waarschuwing, recentgebruikcontrole en herstelbeleid zijn noodzakelijk |
| Stelselmatige monitoring | Uit voorzorg toepasselijk voor duurzame online lees- en activiteitregistratie. Geen cross-site tracking, camera of locatie |
| Gevoelige/zeer persoonlijke data | Niet gevraagd. Vrije bijnaam/supporttekst kan onbedoeld gevoelige informatie bevatten: minimaliseren, begrenzen en verwijderen |
| Grote schaal | Niet aangetoond. Geen fictieve aantallen of voorspelde marktdekking. Groei en duur van opslag zijn herbeoordelingstriggers |
| Onverwachte datasetkoppeling | Geen derde-partijleesprofielen, advertentiedata of socialgraph. Google-identiteit alleen voor door de ouder gekozen login |
| Kwetsbare betrokkenen | Ja: kinderen 0–12 jaar |
| Nieuwe technologie | Geen noodzakelijke innovatieve surveillance. Standaard Auth/database/offline TTS is geen reden om risico’s over te slaan |
| Recht of dienst wordt onbereikbaar | Online accountgates en verwijdering kunnen toegang stoppen. Gastleesroute en openbare privacyroute voorkomen onnodige afhankelijkheid van accounttoegang |

Deze voorzichtige keuze volgt de [WP29/EDPB DPIA-richtsnoeren](https://ec.europa.eu/newsroom/article29/items/611236). Er wordt geen beroep gedaan op een vrijstelling. Als na de maatregelen waarschijnlijk een hoog restrisico overblijft, moet DG Webservices vóór die verwerking de procedure voor voorafgaande raadpleging beoordelen; een technische release kan die verplichting niet vervangen.

## 2. Verantwoordelijke, betrokkenen en gegevensstromen

DG Webservices bepaalt doeleinden en middelen. Geautoriseerde beheerders behandelen support/verwijdering en onderhouden de app. Kinderen en ouders zijn de betrokkenen. De volledige stroominventaris, rollen, locaties, codepaden en retentiebeperkingen staan in [PRIVACY-DATASTROMEN.md](PRIVACY-DATASTROMEN.md).

Het ouderaccount bevat een mailadres/ID; Supabase Auth verwerkt ook sessie- en verificatiegegevens. Google kan een provideridentiteit en naam/foto doorgeven. Alleen minimale identificatie wordt aangevraagd; geen Gmail/agenda/contacten. De online profielblob bevat bijnaam, avatar, profiel-ID, leesvoortgang, keuzes, favorieten, herinneringen en voorkeuren. Een losse consentregistratie koppelt het profiel aan de ouderverklaring, versie en tijd. De server registreert één laatste geldige gezinsactiviteit voor de inactiviteitsregel. De mailstroom bevat oudermailadres en noodzakelijke service-informatie, zonder kindnamen of leesinhoud. De native versie verstuurt deze profielen niet.

Supabase is voor de gezinsdienst verwerker, met database `eu-west-1`. Resend verwerkt Auth-mail via Supabase custom SMTP; de afzonderlijke lifecycle-mailroute via de Resend-API vereist een eigen Vault-koppeling. Google heeft daarnaast eigen verantwoordelijkheden voor de gekozen Google-identiteit. Stackmail is door de eigenaar bevestigd voor supportmail; de verwerkers-/doorgifteafspraken zijn eveneens bevestigd. De feitelijke hostingpartij en hostplaats staan nog niet in het register en worden uit bestaande hostinggegevens overgenomen; een VPS-naam bewijst die plaats niet. Een Europese database bewijst geen afwezigheid van toegang buiten de EER.

## 3. Noodzaak, grondslag en proportionaliteit

| Verwerking | Waarom noodzakelijk / minder ingrijpend alternatief | Begrenzing |
| --- | --- | --- |
| Oudermailadres + Auth-ID | Online gezin tussen browsers terugvinden en beveiligen; zonder account blijft lokaal/gast lezen mogelijk | Volwassene meldt aan, geen kindmailadres vragen; geen wachtwoord of ID-document als standaardbewijs |
| Ouderverklaring en voorwaardenversie | Contract en volwassen rol aantonen; succesvolle login alleen bewijst mailbox/providerbezit | Afzonderlijke actieve verklaring en termscheckbox, privacy alleen informatie; geen terugwerkend bewijs |
| Optioneel kinderprofiel | Gevraagde bewaarde leesplek | Losse toestemming per profiel; bijnaam/defaultavatar; geen geboortedatum/foto; intrekking zonder gezinsverlies |
| Leeskeuzes en voortgang | Het gekozen verhaal hervatten | Geen secundaire analyse/scoring/marketing; geen langere inhoudelijke historie dan functie nodig heeft; geen onbeperkte gebeurtenissenstroom voor activiteitsmeting |
| Laatste activiteit en verwijderstatus | Dataminimalisatie en uitvoerbare accountregels | Server-UTC, gededupliceerde echte activiteit; geen tokenrefresh/emailtracking als activiteit |
| Serviceberichten | Noodzakelijke toegang, waarschuwing en verwijderbevestiging | Geen campagne, tracking, kindnamen of leeskeuzes; ontvanger alleen bevestigd volwassen adres |
| Support/AVG-dossier | Vraag behandelen en wettelijke rechten uitvoeren | Minimale scope, rollen, kalenderdeadline, eigen bewaarbeleid; 12-jarige zonder ouderlogin bereikbaar |
| Logs en back-ups | Beschikbaarheid/beveiliging | Korte aantoonbare termijnen; geen OTP/tokens/body; deleties herhalen vóór herstelde omgeving verkeer krijgt |
| Voorlezen | Gebruiker kiest voorlezen; zelf lezen blijft alternatief | Alleen expliciet lokale Nederlandse stem, Avonturier in plaats van profielnaam, geen online fallback of microfoon |

Voor online profielverwerking is de toestemming van de ouder met gezag of voogd apart van de overeenkomst vastgelegd. Het ontbreken van objectieve gezagscontrole blijft een risico: de combinatie bevestigde login + specifieke verklaring + profieltoestemming is een proportionele standaard voor niet-openbare, niet-gevoelige leesprofielen, geen bewijs van een gecontroleerd gezagsregister. Bij een betwist gezag of gericht privacyverzoek volgt menselijke minimale verificatie; geen structurele ID-inzameling.

De [wijziging van artikel 5 UAVG](https://zoek.officielebekendmakingen.nl/stb-2026-154.html), in werking [1 september 2026](https://zoek.officielebekendmakingen.nl/stb-2026-196.html), ondersteunt de eigen uitoefening van rechten en intrekking vanaf 12 jaar. De openbare route vraagt daarvoor geen ouderaccount. Een eigen kindverzoek mag niet ongemotiveerd de gegevens of toegang van andere gezinsleden vernietigen.

## 4. Risicoregister

Schaal: kans 1–5 × impact 1–5; 12 of hoger is een projectsignaal voor hoog risico, geen wettelijke rekensom. Het lagere doelrisico geldt pas met uitvoeringbewijs; open controles blijven open.

| Risico voor betrokkenen | Initieel | Maatregel / verificatie | Doelrest / open punt |
| --- | --- | --- | --- |
| Ander gezin of aanvaller leest kindvoortgang | 3×5=15 | RLS, servergetUser, accountstatus/consentgate, echte gezinsisolatietests en oude tokens | 1×5=5 na slagen; live-/migrationbewijs vereist |
| Een kind maakt ouderaccount of onbevoegde volwassene uploadt profiel | 3×4=12 | Aparte 18+/gezagsverklaring, serveronboarding, opt-in per profiel, geen kindmail, proportionele supportverificatie | 2×4=8; verklaring is geen formele gezagsverificatie. Signalen/misbruik herbeoordelen |
| Profiel leeft voort na intrekking of verwijdering | 4×4=16 | Consent- en lifecycle-RLS, scrub + revisie, geen oude-syncresurrectie, idempotente worker/Auth-delete, offline uitleg | 1×4=4 na grens/race/retrytests; nooit claimen vóór bewijs |
| Verkeerde automatische wissing verliest verhaalgegevens | 3×4=12 | Serveractiviteit, waarschuwingen, kandidatuurrapport, overgang oudere accounts, exactdeadline-lock, initieel geen bulkactivatie | 1×4=4 na stagingtest en gecontroleerde activatie; geen verzonnen last-used |
| Logboeken/mail/back-ups bewaren kind-/oudergegevens te lang of laten gewiste data herleven | 4×4=16 | Eigen logs 29d met zesuurlijkse opruiming; eigenaar bevestigt back-ups maximaal 180d. Gewone support maximaal 12 maanden is bevestigd; wis-/intrekkingsstatus vóór herstel toepassen | **Deels gesloten:** back-upmaximum, Stackmail en supporttermijn bekend. Providerlogcriteria en uitvoering blijven te controleren. Lokale 210-dagenbewijsretentie vervangt geen onafhankelijke actuele hersteljournal; geen vrijgave van ongedekt herstelverkeer |
| Internationale toegang zonder passende waarborg | 3×4=12 | Eigenaar bevestigt toepasselijke verwerkers-/doorgifteafspraken en Stackmail; minimale mailinhoud en beperkt beheer | **Afspraken bevestigd.** Leveranciers-/landenregister aanvullen met feitelijke hostingpartij en plaats; geen algemene EU-onlyclaim op basis van de databaseregio. Beheer de bevestigde afspraken operationeel |
| Externe TTS ontvangt naam/verhaaltekst | 3×3=9 | Web kiest alleen localService true, native offlineengine, naam vervangen; tests onlineeerste/geenlocalevoice | 1×3=3; browser rapporteert localService, geen cryptografisch bewijs van apparaatleverancier |
| Mailboxbezetter krijgt account of kind steelt OTP | 3×4=12 | Zescijferige kortlevende Supabase-OTP, rate limits, geen logging, HTTPS, verse auth voor destructieve actie | 2×4=8; mailbox/Google-account zelf buiten Fabelpadbeheer |
| AVG-recht van kind onbereikbaar of te brede export | 3×4=12 | Openbare 12+-route, menselijke verificatie, scope per kind, beperkte export, kalenderdeadline | 1×4=4 na proceduretoets; inboxregister handmatig zolang geen integratie |
| Onjuiste uitleg of gedwongen privacytoestemming | 3×3=9 | Los privacy-informatielabel, onveranderlijke voorwaarden-/privacydownload, hashes, kindvriendelijke tekst | 1×3=3 na UI-/versieracecheck |
| Beheerder of servicekeymisbruik | 3×5=15 | Database-adminrol, Vault, service-only RPCs, geen clientmetadataautorisatie, minimale adminsurface | 1×5=5; operationele beheertoegang/incidentrespons onderhouden |
| Betalingen lopen na accountwissing door | 3×4=12 bij betaald | Er is geen betaalroute; geen billinglivegang vóór echte verlengstop/pro-rata/herroepingtests | N.v.t. huidige gratis scope; verplicht nieuwe beoordeling vóór verkoop |

## 5. Controle en incidentrespons

Voor een release: voer RLS/gezinsisolatie en actuele sessiecontrole uit, bewijs documenten/hash + onboarding, consentintrekking en oude sync, deadlines/restore/races, duurzame mailretries en providerdeelstappen. Controleer native manifest/SDK’s voor de afzonderlijke storebuild. Logs bevatten alleen noodzakelijke technische IDs/status en nooit OTP, key of kindnamen.

Na een mogelijk incident: beperk de betrokken toegang, bewaar alleen noodzakelijk beveiligingsbewijs, bepaal bereik en gevolgen voor kinderen, herstel eigen fout, beoordeel meldplicht en communicatie onder de AVG, registreer afweging en tijdstippen. Deze beoordeling beweert niet dat een incidentplan automatisch een melding heeft uitgevoerd.

De [AVG artikelen 25, 28 en 32–36](https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX%3A32016R0679) zijn de uitgangspunten voor ontwerp, verwerkers, beveiliging en risicobeoordeling. Een onafhankelijke hersteltest met werkelijk ingestelde back-uprotatie en providerstoring blijft apart bewijs.

## 6. Operationeel besluit en opvolging

| Controle | Eigenaar / concreet bewijs nodig | Effect |
| --- | --- | --- |
| Leveranciers-/landenregister | Eigenaar bevestigt Stackmail en verwerkers-/doorgifteafspraken; hostingpartij/hostplaats overnemen uit bestaande beheergegevens | De bevestigde afspraak niet opnieuw als onbeantwoord behandelen; publieke uitleg met de werkelijke ontvangers/doorgiften laten overeenkomen |
| Back-upmaximum | Eigenaar bevestigt maximaal 180 dagen voor technische back-ups | Passende privacyversie bijwerken; dit is geen termijn voor actieve gegevens, support of logs |
| Gewone support | Eigenaar bevestigt maximaal 12 maanden na afsluiting | Voer inbox-/archiefbeleid uit; de keuze is bevestigd, de opschoonproef nog niet |
| Providerlogs | Neem toepasselijke termijnen of concrete criteria over uit gebruikte plan-/providerinstellingen | Gebruik 180 dagen niet als verzonnen logtermijn; beperk de resterende registercontrole tot werkelijk gebruikte diensten |
| Herstel zonder herleving | Actuele wis-/intrekkingsstatus moet het gekozen herstelpunt dekken; lokale opvolging bereidt 210 dagen bewijsretentie voor bij back-ups maximaal 180 dagen | Houd het actuele bewijs buiten het teruggezette domein beschikbaar of weiger ongedekte herstelpunten. De lokale retentiefix is geen onafhankelijke journal. Geen gebruikersverkeer vóór volledige toepassing van latere verwijderingen |
| Consent/onboarding/RLS/deletionworker en deadlineproof | Migraties/gerichte tests, stagingkandidatenrapport, echte Authcleanup, oude tokenweerstand | Vereiste implementatiecontrole, niet vervangen door document |
| Automatische90d-bulkactivatie | Stagingbewijs en overgangskandidaten + waarschuwingstatus | Bewust uit tot aantoonbaar veilig; geen massawissing bij release zonder review |
| Ouders/kinderen begrijpen uitleg | Kindvriendelijke taal is geïmplementeerd; doelgroeponderzoek nog niet uitgevoerd | Verzamel geanonimiseerde feedback; geen usabilitytest claimen |
| Restrisico | DG Webservices als verantwoordelijke, na feitelijke controles | Bij blijvend waarschijnlijk hoog risico voorafgaande raadpleging beoordelen, verwerking beperken |

Herbeoordeel bij nieuw betaalmodel, publieke sociale functie, AI/personalisatie, analytics, nieuwe leverancier/land, gevoelige profielvelden, aanzienlijke schaalgroei, een incident of wijziging van bewaartermijnen. Dit document is een uitgevoerde technische/proportionele analyse met expliciete resterende bewijsacties; geen verzonnen juridische goedkeuring of afgesloten provideraudit.
