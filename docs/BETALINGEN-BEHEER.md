# Abonnementen en betalingen beheren

Deze wijziging levert de code en lokale migraties voor webabonnementen via Mollie, Google Play Billing in een aparte gekoppelde Android-build, Founders en kortingscodes. De vier betaalschakelaars beginnen uit. Deze handleiding is geen bewijs van een uitgevoerde hosted migratie, provideractivering, echte testbetaling of storepublicatie.

## Omgeving en bediening

Open **Beheer → Abonnementen & betalingen** (`/studio/betalingen`) met een geverifieerd beheeraccount. Controleer bovenaan staging of productie. Geheime configuratie, activering en andere gevoelige handelingen vragen een recente aanmelding. Sla configuratie eerst op; activering gebeurt via de afzonderlijke schakelaar. Een revisieconflict betekent dat een andere beheerder de configuratie heeft gewijzigd: laad opnieuw voordat je nogmaals bevestigt.

| Schakelaar | Betekenis bij uit |
| --- | --- |
| Betaling vereist | Online bibliotheek vrij toegankelijk; geen nieuwe checkouts of Founders-toekenningen |
| Founderskorting | Geen nieuwe toekenningen; bestaande vaste rechten blijven gelden |
| Google Play betaling | Geen nieuwe Play-checkouts in Fabelpad; bestaande rechten en providerafhandeling blijven gelden |
| Mollie betaling | Geen nieuwe webcheckouts; bestaande verplichtingen blijven gelden |

De effectieve status is het serverbesluit na controle van de hoofdschakelaar, providerconfiguratie en bevestigde teststatus. Een gekozen instelling kan daarom aan staan terwijl het kanaal effectief nog uit is. Een instelling opslaan, migreren, bouwen, testen of uitrollen activeert geen schakelaar.

## Mollie op het web

Vul de API-sleutel in onder **Mollie → Geheime koppeling**, met afzonderlijke test- en livekeuze. Staging accepteert uitsluitend testmodus. Vul het verwachte Mollie-profiel in, kies de eerste betaalmethoden en omschrijving en sla op. Een leeg sleutelveld behoudt de opgeslagen sleutel. De sleutel wordt in Supabase Vault opgeslagen en verschijnt niet opnieuw in het scherm, de audit of een export. Oude sleutelrevisies blijven beschikbaar voor bestaande verplichtingen; verwijder alleen een werkelijk ongebruikte revisie.

Gebruik **Verbinding testen** voor een controle van Profile en Methods zonder transactie. Het bevestigen van sleutel, profiel, geschikte eerste methode en terugkerende methode bewijst nog geen werkende betaalroute. De afgeschermde beheerproef controleert daarna, afzonderlijk en alleen op expliciete opdracht, de eerste betaling, callback en webhook. Er is bij het bouwen van deze wijziging geen echte Mollie-transactie uitgevoerd. Een productieproef mag alleen zichtbaar zijn voor de beheerder en mag geen gewone ouder naar Mollie-testmodus sturen.

De callback verwijst naar de eigen abonnementsomgeving; de webhook is `/api/billing/mollie/webhook` met de vaste sleutelrevisie van de betaalpoging. Gebruik de door de omgeving afgeleide URL. Kies iDEAL alleen wanneer het eigen profiel de eerste betaling voor een geldig terugkerend mandaat ondersteunt. Zet andere methoden, waaronder Wero, pas aan nadat de officiële documentatie én het profiel de benodigde mandaatflow bevestigen.

Op het web geldt deze Mollie-route ook voor bezoekers met iPhone, iPad of Mac. Er is geen Apple-app of Apple-betaalintegratie. De gekoppelde Android-app bevat geen Mollie-checkout, kortingscode-invoer of link naar externe betaling.

## Google Play, WIF en RTDN

Configureer pakket `nl.fabelpad.app`, de maand- en jaarproducten en hun exacte basisplannen. De perioden moeten `P1M` en `P1Y` zijn, met een beschikbaar EUR-aanbod voor Nederland. De ouder ziet vóór het kopen de prijs die de Billing SDK daadwerkelijk uit Play ophaalt. Een afwijkende prijs of productbinding stopt de aankoop.

Een releasecredential voor GitHub-publicatie is niet automatisch een beschikbare servercredential voor aankoopcontrole. De backend gebruikt bij voorkeur WIF met een door de eigen runtime aangeleverde, kortlevende OIDC-tokenbron. Zonder zo'n bron blijft WIF onbruikbaar en het verkoopkanaal effectief uit. De code ondersteunt als alternatief een reeds bestaand serviceaccount-JSON in serverzijdige Vault-opslag. Deze wijziging maakt geen nieuwe Google-sleutels of permanente credentials. Zet geen Google-secret of Play-aankooptoken in een mobiele omgevingsvariabele, GitHub-artefact, browser of log.

In Cloud/Play blijven de volgende beheerhandelingen nodig:

1. Geef de serveridentiteit voor de juiste app de noodzakelijke Android Publisher-rechten voor aankoopcontrole, bevestiging, abonnementsbeheer en waar toepasselijk restitutie. Controleer productrechten afzonderlijk van rechten voor bestaande aankopen.
2. Maak in hetzelfde Google-project een Pub/Sub-topic en geef `google-play-developer-notifications@system.gserviceaccount.com` publicatierecht. Stel dit topic in onder de RTDN-instellingen van de app in Play Console.
3. Maak een geauthenticeerd Pub/Sub-pushabonnement naar de eigen `/api/billing/play/notifications`-URL. Gebruik een afzonderlijk pushserviceaccount en stel de exacte audience in. De Pub/Sub-serviceagent heeft de benodigde tokencreatorrechten op die identiteit nodig.
4. Vul in Fabelpad exact de audience, het pushserviceaccount en de volledige abonnementsnaam `projects/.../subscriptions/...` in. De backend controleert Google's handtekening, issuer, audience, vervaldatum en geverifieerde serviceaccountidentiteit; het bericht zelf is alleen een aanleiding voor een nieuwe providercontrole.
5. Gebruik geautoriseerde licentietesters en een eigen native stagingbuild. Na de geslaagde productprobe verschijnt in het ouderhoekje van een geverifieerde beheerder **Beheertest maand/jaar bekijken**. Controleer het bedrag, bevestig zelf de voorwaarden en automatische verlenging en gebruik uitsluitend het door Google getoonde testbetaalmiddel. Deze aparte, recent geauthenticeerde beheerproef maakt in staging een testreservering terwijl de vier schakelaars uit blijven. Een echte testkoop moet nog via Play worden uitgevoerd. De aankoopcontrole gebruikt `purchases.subscriptionsv2.get` en de officiële acknowledgementroute. Stuur ook de RTDN-test uit Play Console.
6. Controleer vóór indiening de actuele Payments- en Families-regels, de Data safety-verklaring, ouderroute en openbare accountverwijderlink. Fabelpads gezinsrecht is een eigen accountrecht; het is geen belofte dat een Play-abonnement via Googles Family Library kan worden gedeeld.

Productcontrole, servercontrole van een echte testkoop en geauthenticeerde RTDN-bezorging zijn afzonderlijke bewijzen. Een geslaagde productprobe vervangt de andere twee niet. Bij ontbrekende rechten blijft een provideractie open. Deactiveren van een basisplan onder **Play Console → Inkomsten genereren → Producten → Abonnementen → basisplan → Deactiveren** stopt nieuwe verkoop bij Google; bestaande automatische verlengingen moeten afzonderlijk worden gestopt en bevestigd.

Voor de productieverbinding bestaat een afzonderlijke **Play-licentietest voor beheer** in het ouderhoekje van de gekoppelde productiebuild. Deze verschijnt pas na een bevestigde beheerrol en geslaagde productcontrole van de live-serveridentiteit. Bevestig zelf dat je een door Google geautoriseerd licentietestaccount gebruikt en controleer in Google's scherm het testbetaalmiddel. Een kort geldig beheerticket bindt de test aan de actuele configuratie en het eigen ouderaccount. Alleen een door Google bevestigde sandboxaankoop met correcte producten, prijs, eigenaarbinding en acknowledgement wordt als technisch bewijs opgeslagen. Deze route maakt geen betaling, abonnement of gezinsrecht in Fabelpad aan en wijzigt geen schakelaar. Een echte aankoop wordt afgewezen. Productie-RTDN moet daarnaast afzonderlijk met de eigen geauthenticeerde testmelding worden bevestigd.

## Founders

De standaardactie heeft vijftig plaatsen en twaalf kalendermaanden toegang. Stel het venster en de duur in en controleer de expliciete campagnestart. Alleen de eerste geldige afronding van ouderonboarding van een vanaf de start nieuw geverifieerd gezin telt. Eerdere, demo- en testaccounts en een herhaalde voorwaardenbevestiging tellen niet mee. De database verdeelt plaatsen atomair.

De teller gebruikt werkelijk toegekende plaatsen. Pauzeren stopt nieuwe toekenningen; hervatten gebruikt dezelfde voorraad. Verwijderen of verlopen geeft geen plaats terug. Een Founders-gezin hoeft geen betaalgegevens op te geven en wordt niet automatisch een betaald abonnement. Een servicebericht voor het einde gebruikt de bestaande duurzame mailuitvoer. De normale dertig dagen herstel en de afzonderlijk geschakelde negentig dagen inactiviteitsregel blijven van toepassing.

## Kortingscodes voor bijvoorbeeld scholen

Onder **Kortingscodes voor scholen en gezinnen** kies je een percentage of vast bedrag, de duur in kalendermaanden of onbeperkt en het geldigheidsvenster. Een vast bedrag kan per betaalperiode gelden of als maandbedrag worden omgerekend voor een jaarperiode. Het formulier toont de gekozen betekenis. Genereer één of meerdere codes in het formulier of plak ze, één per regel, en sla de reeks op.

Je stelt per code een maximaal aantal toekenningen in of kiest onbeperkt gebruik; het beheer toont het totale verbruik van de reeks en de limiet per code. Eén gezin kan een reeks eenmaal gebruiken, ook wanneer de reeks meerdere codes bevat. Kortingen stapelen niet. De ouder voert de code bij het webaanbod in en ziet de eerste prijs, kortingsduur en vervolgtarief vóór bevestiging. Een volledig gratis code geeft een niet automatisch betalend gezinsrecht zonder Mollie-mandaat. Een school krijgt door het uitdelen van codes geen toegang tot kinderprofielen of leesgegevens.

## Stopzetten, herstel en terugbetalingen

Een verkoopkanaal uitzetten stopt nieuwe aankopen. Webhooks, herstel van aankopen, opzegging, terugbetalingen en periodieke reconciliatie blijven draaien. De ouder kan online automatische verlenging stoppen en ziet de betaalde einddatum en de werkelijk bevestigde providerstatus.

Bij het uitzetten van **Betaling vereist** met lopende verplichtingen toont beheer eerst aantallen per provider en open betaalpogingen. Na bevestiging verdwijnen betaalmuur, Founders-uitgifte en nieuwe betaalstarts meteen. Duurzame taken stoppen de toekomstige verlengingen bij de providers; onzekere acties blijven zichtbaar. Opnieuw aanzetten herstart geen gestopte verlenging. Eerder betaalde tijd blijft gerespecteerd. Na stilzwijgende verlenging gelden de wettelijke opzegtermijn en toepasselijke pro-rata restitutie; waar Play geen passende veilige toekomstige restitutieactie biedt, blijft de Console-actie zichtbaar voor afhandeling via support.

Directe webaankopen kunnen via `/herroepen` zonder verplicht account of app worden herroepen. De ontvangst- en verificatiestap voorkomt dat een ander zomaar een aankoop beëindigt. Een geldige tijdige directe herroeping geeft de toegezegde volledige terugbetaling. De ouder gebruikt voor Play de eigen Google-aankoop- en terugbetalingsroute, met `support@fabelpad.nl` als vangnet. Accountverwijdering is een afzonderlijke route; zij start ook de echte providerstop en toepasselijke restitutie. Herstel van het account herstart afschrijving nooit.

## Androidvarianten en controles

`FABELPAD_VARIANT=production` blijft de lokale gratis uitgave met de bestaande dertien verhalen, profielen en onveranderlijke gebundelde verhaalversies. Deze variant heeft geen INTERNET- of BILLING-recht en resolveert de Google Billing SDK niet. De afzonderlijke variant `connected` vereist expliciete staging- of productieorigin, het bijbehorende Supabase-project, uitsluitend de openbare publishable key en een versionCode hoger dan `2`. De overige privacybeperkingen blijven gelden.

De gekoppelde variant gebruikt Billing Library **9.1.0**, ouderlogin in beveiligde opslag, expliciete profielimport met toestemming en een apart online leesscherm. Premiumdownloads zijn via de Android Keystore versleuteld, per gezin en omgeving gescheiden en maximaal vierentwintig uur geldig, begrensd door het serverrecht. Uitloggen en een geconstateerde accountintrekking wissen deze cache. De bestaande lokale opslag en gratis bundels gebruiken deze cache niet.

Online leesvoortgang wordt vóór iedere netwerkpoging als versleutelde lokale conceptkopie bewaard, met een aparte Keystore-sleutel. Daardoor blijft nog niet gedeelde voortgang na het sluiten van de app of het verlopen van een verhaaldownload beschikbaar. Bij verbinding gebruikt de app revisiecontrole en voegt alleen de gewijzigde leesroutes samen met actuele online profielgegevens. Een conflict op dezelfde route vereist een bewuste keuze; verwijderde profielen worden niet teruggezet. Uitloggen en een bevestigde account- of profielintrekking wissen ook deze conceptkopie; de app meldt dat bij uitloggen.

Op 23 november 2026 zijn lokaal uitgevoerd: de Play-providertests en native importtests, TypeScript, de bestaande dertien-verhalenruntimecontrole, de verbonden Android-prebuild, Metro-export, `:fabelpad-play-billing:compileReleaseKotlin` in beide varianten en Gradle `dependencyInsight`. De gekoppelde variant resolveert daadwerkelijk `com.android.billingclient:billing:9.1.0`; de lokale variant heeft die dependency niet. De volledige nieuwe AAB-build is nog geblokkeerd door de bestaande preflight: minder dan zes GiB vrije schijfruimte. Een modulecompilatie of JavaScript-export bewijst geen volledige releasebuild of toestelwerking.

Niet uitgevoerd bij deze codewijziging: hosted migratie, staginggebruikersacceptatie, een Mollie-transactie, echte Play-licentietest/acknowledgement, bezorgde RTDN-test, aangesloten Android-toestel, productiebetaalactivering en storepublicatie. Houd productieschakelaars uit totdat deze afzonderlijke bewijzen en beheerhandelingen zijn afgerond.

## Juridische versies en bronnen

Voorwaarden en privacy krijgen versie `2026-11-23.1`; eerdere downloads, hashes, ouderacceptaties en toestemmingen blijven behouden. Bestaande ouders bevestigen de gewijzigde voorwaarden bewust voordat de online gezinsomgeving opnieuw wordt gebruikt. Dat schrijft eerdere acceptaties niet over en geeft geen nieuwe Founders-plaats. Financiële afhandeling gebruikt minimale afgescheiden gegevens; kinderen en leesgegevens zijn geen financiële administratie.

Geraadpleegde officiële bronnen op 23 november 2026:

- [Google Billing-integratie en huidige libraryversie](https://developer.android.com/google/play/billing/integrate), [release notes](https://developer.android.com/google/play/billing/release-notes).
- [Play SubscriptionPurchaseV2](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2), [cancel](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/cancel), [revoke](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/revoke).
- [Pub/Sub-pushauthenticatie](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions), [Play Payments](https://support.google.com/googleplay/android-developer/answer/10281818), [Families](https://support.google.com/googleplay/android-developer/answer/9893335).
- [ACM ConsuWijzer: abonnement opzeggen](https://consument.acm.nl/aankoop-dienst-annuleren/abonnement-opzeggen), [bedenktijd](https://consument.acm.nl/aankoop-dienst-annuleren/bedenktijd).
- [Google Play: EER-terugbetalingsbeleid](https://support.google.com/googleplay/answer/15576634), [Belastingdienst: administratieve bewaartermijnen](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/).
