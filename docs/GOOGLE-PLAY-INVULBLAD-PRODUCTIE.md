# Play Console-invulblad — Fabelpad

**Beoordeelde versie:** voorbereiding van Fabelpad 1.0.0, versionCode 1, applicationId **nl.fabelpad.app**, Android-productievariant. **Status voor de productietrack: Open punten vóór indienen.** De productie-AAB is uploadkey-ondertekend en technisch gecontroleerd. Toestelacceptatie, publieke privacybereikbaarheid, Console-/beleidsafronding en productie-indiening staan nog open. Dit blad is geen verklaring dat de app al kan worden ingediend.

**Bevestigde productomvang:** een volwaardige gratis lokale verhalenapp met dertien gebundelde verhalen, interactieve verhaalkeuzes, lokale profielen, favorieten, voortgang en leesinstellingen. Geen online accounts, cloudsync, betaalmuur, advertenties of abonnementen. Dat zijn geen bereikbare functies van de huidige native bron. De eigenaar heeft deze zelfstandige lokale app als eerste release bevestigd. Een productieversie kan deze functies zelfstandig aanbieden; de Store-vermelding mag geen toekomstige platformfuncties beloven.

**Identiteit:** repository https://github.com/fabelpad/platform.git; reviewbranch codex/android-production-play-20261118; gebouwde commit **8dcb98c4287dc78421b092ee395ace05f492baaa**, bij buildstart schoon vastgelegd. Het productieartefact is [fabelpad-production.aab](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.aab), **37.005.584 bytes**, SHA-256 **ffc22ec85449074a667a243dc132dfa46e9a484c756dc57c859433ba68ba6e1c**. Beoordeel dit pakket; latere documentatie-/workflowwijzigingen veranderen deze vastgelegde artefactherkomst niet.

**Console-taal:** Nederlands. **Store-taal:** voorstel Nederlands, nl-NL. **Gewenste distributie:** productie voor Android-telefoons en geteste tablets, voorafgegaan door echte acceptatietests en eventuele verplichte gesloten test. Play-accountdisplaynaam **DG Webservices** is bevestigd; landen, accounttype, leeftijdsgroepen en publicatiedatum zijn open. Website **fabelpad.nl** en publiek supportadres **support@fabelpad.nl** zijn bevestigd; bereikbaarheid en aflevering nog te verifiëren. **Controledatum:** 18 november 2026, Europe/Amsterdam.

De ondertekende productie-AAB en het buildmanifest zijn beschikbaar; er is geen ingelogde Play Console of huidig formulierexport. Officiële Help bevestigt de vermelde schermroutes; een niet-zichtbare afslag heet **Formuliertekst te bevestigen**. Onbekende compliance-antwoorden blijven **Open — nog niet invullen**. Alleen de ontbrekende specifieke Console-schermen zijn nodig, geen accountdump. Een ingevuld blad bewijst geen goedkeuring door Google.

De gebruiker laat Store-icoon, functieafbeelding en telefoon-, 8-inch- en 10-inch-tabletbeelden extern maken. Het aparte [release-runbook](/home/codex/repos/fabelpad/docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md) beschrijft signing, eerste upload, Google Cloud-toegang en automatische vervolgreleases. Geheimen, accountwachtwoorden, privécontacten en testeridentiteiten horen niet in dit blad.

## Wat vóór indienen nog moet gebeuren

1. De bevestigde identiteit nl.fabelpad.app en lokale productomvang in de release toepassen; bestaand Play-account en eventueel eerder gebruikte versionCodes controleren.
2. Productieconfiguratie en privacy afronden: publiek beleid en supportkanaal, definitieve launcher-assets, uitsluitend lokale voorleesroute zonder netwerkmotorfallback, minimale rechten. De lokale voorleesroute en manifestbeperkingen zijn in de bron geïmplementeerd; gedrag van het definitieve artefact en de geselecteerde spraakmotor moet nog worden geverifieerd. “Geen gegevensverzameling” is nog geen bewezen eindantwoord.
3. De gebouwde productie-AAB op toestellen accepteren en vervolgens de Console-bootstrap uitvoeren. Uploadsigning, schone bron-SHA, gemergd manifest, twee 64-bits ABI’s, 16-KB-ELF/bundle/ZIP-uitlijning en universele APK zijn technisch gecontroleerd; zie G2.
4. Diezelfde versie op telefoon en beide tabletformaten testen: eerste start, lezen/keuzes, profielscheiding, wissen/heropenen, voorlezen zonder internet en zonder lokale Nederlandse stem, toegankelijkheid en levenscyclus.
5. Account-/pakketverificatie, publieke contact-/privacygegevens, externe beelden, leeftijd/Families, IARC en alle App-content-taken afronden.
6. Indien het account de 12/14-testgate heeft: echte gesloten test doorlopen en productietoegang krijgen. Daarna de eerste productie-indiening in Console uitvoeren. Automatisering neemt geen juridische bevestigingen of Google-review over.

De vroegere schijfruimtebeperking geldt niet meer: op 18 november is circa 49 GiB beschikbaar op de ontwikkelhost. De productiebuild is inmiddels geslaagd; capaciteit is geen open blokkade. Een Supabase-project of betaalaccount is voor de bevestigde lokale release niet vereist; bij toevoeging daarvan moeten de betreffende verklaringen worden herzien.

## Bewijs en begrenzing

| Onderdeel | Bron / vaststelling | Nog te bewijzen |
| --- | --- | --- |
| Native functies | [App.tsx](/home/codex/repos/fabelpad/mobile/App.tsx:139), [content.json](/home/codex/repos/fabelpad/mobile/src/content.json), [runtimecontrole](/home/codex/repos/fabelpad/scripts/native-runtime-check.mjs) | Bereikbaar gedrag op de definitieve productie-AAB |
| Lokale opslag | [storage.ts](/home/codex/repos/fabelpad/mobile/src/storage.ts:8) | Duurzaam bewaren, volledig wissen en backup-/toesteloverdracht op release |
| Variant en versies | [app.config.ts](/home/codex/repos/fabelpad/mobile/app.config.ts:8), [package-lock.json](/home/codex/repos/fabelpad/mobile/package-lock.json); eigenaar bevestigt nl.fabelpad.app en 1.0.0/code1 | Buildidentiteit en schone SHA vastgelegd; onbekende Play-historie vóór upload controleren |
| Voorlezen | [Generieke spraaktekst](/home/codex/repos/fabelpad/mobile/App.tsx:102), [lokale native module](/home/codex/repos/fabelpad/mobile/modules/fabelpad-offline-speech/android/src/main/java/nl/fabelpad/speech/FabelpadOfflineSpeechModule.kt:71) | AAB technisch gecontroleerd; motor/stem, netwerkcontrole en ontbrekende-stemgedrag op toestel nog open |
| Rechten en SDK’s | [Geblokkeerde rechten](/home/codex/repos/fabelpad/mobile/app.config.ts:29), [Android-plugin](/home/codex/repos/fabelpad/mobile/plugins/withFabelpadProduction.cjs:6), [dependencies](/home/codex/repos/fabelpad/mobile/package.json:18) | Productiemanifest gecontroleerd: uitsluitend VIBRATE en eigen signaturepermission; SDK Index/Play-signalen na upload nog open |
| Ouderlinks / lokale controle / wissen | [Externe-linkcontrole](/home/codex/repos/fabelpad/mobile/App.tsx:114), [productie-ouderhoek en reset](/home/codex/repos/fabelpad/mobile/App.tsx:143) | Externe browser/mailactie, lege geboortejaarstate en duurzaam wissen op release |
| Verhaalversies bij app-update | [Routepinning](/home/codex/repos/fabelpad/mobile/App.tsx:88), [opslagmigratie](/home/codex/repos/fabelpad/mobile/src/storage.ts:26) | Upgradepad met oude opgeslagen route en nieuwe content op toestel |
| Store-beelden | Externe opdracht van eigenaar | De echte bestanden, resoluties, rechten en vergelijking met release |
| Console/account | Geen actuele account- of formuliertoegang | Accounttype/datum, verificaties, pakketregistratie, testgate en getoonde vertakkingen |

### Regels op de geplande publicatiedatum

De datum is nog onbekend. De volgende stand geldt op 18 november 2026; controleer deze opnieuw bij een latere indiening.

| Onderwerp | Nu geldende regel | Latere aangekondigde wijziging / open punt | Officiële bron |
| --- | --- | --- | --- |
| Target API telefoon/tablet | Nieuwe apps en updates minimaal API 36 sinds 31-08-2026. Uitstel tot 01-11-2026 is verstreken. | Geen nieuwe API37-deadline uit alleen de beschikbaarheid van Android 17 afleiden. | [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=nl) |
| Pakketregistratie | Identiteit en Play-pakketregistratie vereist sinds 30-09-2026; automatische registratie controleren. | Zo nodig uitsluitend de aangeboden herstelroute volgen. | [Pakketregistratie](https://support.google.com/googleplay/android-developer/answer/16984799?hl=en) |
| Android-ontwikkelaarsverificatie | Regionale installatiebescherming in Brazilië, Indonesië, Singapore en Thailand vanaf 30-09-2026. | Verdere uitbreiding in 2027; feitelijke landen en actuele Console-taak controleren. | [Verificatie](https://developer.android.com/developer-verification) |
| Handelaarsstatus | Werkelijke status aangeven; gratis distributie bepaalt die niet. | Bestaande accounts uiterlijk 01-02-2027; huidige accounttaak kan eerder nodig zijn. | [Handelaarsstatus](https://support.google.com/googleplay/android-developer/answer/17594752?hl=nl) |
| 16-KB-pagina’s | API35+ op 64-bit moet compatibel zijn. | Android noemt expliciete blokkering van niet-compatibele updates vanaf 01-02-2027; geen vrijstelling voor een nieuwe app nu. | [16 KB](https://developer.android.com/guide/practices/page-sizes) |
| Nieuw persoonlijk account | Na 13-11-2023: minstens 12 gesloten testers, minstens 14 dagen doorlopend aangemeld, vervolgens productieaanvraag. | Geen vroegste datum berekenen zonder echte opt-ins en verloop. | [Testgate](https://support.google.com/googleplay/android-developer/answer/14151465?hl=nl) |
| Play Billing | Niet van toepassing op het voorgestelde lokale aanbod zonder aankopen. | Als later geïntegreerd: actuele ondersteunde versie en regionale betaalregels opnieuw toetsen. | [Billing-versies](https://developer.android.com/google/play/billing/deprecation-faq) |
| Technische kwaliteit | Geheugen, stabiliteit en native compatibiliteit moeten echt worden gemeten. | Nieuwe kwaliteitsvoorwaarden vanaf februari/april 2027 alleen toepassen waar functie en deadline dit activeren. | [Technische kwaliteit](https://support.google.com/googleplay/android-developer/answer/17492799?hl=en) |

## A. Ontwikkelaarsaccount en nieuwe app aanmaken

Route: accounttaken afronden; daarna Alle apps → App maken. Publieke contactvelden en privéverificatievelden blijven gescheiden.

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Bestaand account / bevoegde rol | Gebruik het bestaande Play-account met displaynaam DG Webservices; controleer rechten en verificatie. | Bevestigd | Eigenaar bevestigt displaynaam; [registratie](https://support.google.com/googleplay/android-developer/answer/6112435?hl=nl) | Geen tweede account maken; displaynaam bewijst geen accounttype. |
| Accounttype | Open — nog niet invullen: Persoonlijk of Organisatie. | Blokkeert indienen | [Accounttypen](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en) | Accounttype bevestigen; een verhalenlezer activeert op zichzelf geen eis voor gereguleerde organisaties. |
| Aanmaakdatum / productietoegang | Open — nog niet invullen. | Te verifiëren | Niet uit broncode af te leiden; [testgate](https://support.google.com/googleplay/android-developer/answer/14151465?hl=nl) | Datum en getoonde productietoegangsstatus controleren. |
| Ontwikkelaarsnaam / uitgever | Displaynaam DG Webservices bevestigd; juridische uitgever/verantwoordelijke: Open — nog niet invullen. | Te verifiëren | Bevestiging eigenaar; displaynaam bewijst geen rechtspersoon. | Juiste juridische naam voor beleid/account bevestigen. |
| Registratiekosten | Bij bestaand account N.v.t.; alleen bij een nieuw account eenmalig US$25 door eigenaar. | Te verifiëren | [Registratie](https://support.google.com/googleplay/android-developer/answer/6112435?hl=nl) | Geen betaling voor een tweede account zonder noodzaak. |
| Identiteits- en contactverificatie | Open — nog niet invullen; alle open accounttaken controleren. | Blokkeert indienen | [Verificatiegegevens](https://support.google.com/googleplay/android-developer/answer/13628312?hl=nl) | Documenten en codes uitsluitend bij Google invullen. |
| D-U-N-S / organisatiebewijs | Als Organisatie: correcte organisatiegegevens volgens Console. N.v.t. — veld verschijnt bij toepasselijk organisatieaccount. | Te verifiëren | [Accounttypen](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en) | Eigenaar levert bewijs rechtstreeks aan Google. |
| Openbare contactgegevens | Open — nog niet invullen. Organisatie-/handelaargegevens kunnen publiek zijn. | Blokkeert indienen | [Verificatiegegevens](https://support.google.com/googleplay/android-developer/answer/13628312?hl=nl) | Alleen bedoelde openbare bedrijfs-/rolcontacten kiezen. |
| Contactgegevens alleen voor Google | Open — nog niet invullen. | Te verifiëren | Zelfde verificatiebron; geen gegevens bekend. | Privégegevens buiten dit bestand houden. |
| Apparaatverificatie persoonlijk account | Als taak zichtbaar: eigenaar gebruikt vereist fysiek Android-toestel. Anders N.v.t. | Te verifiëren | [Apparaatverificatie](https://support.google.com/googleplay/android-developer/answer/14316361?hl=en) | Alleen werkelijk toepasselijke taak afronden. |
| Website-/betalingsprofielcontrole | Open — nog niet invullen; huidige accounttaken controleren. | Te verifiëren | [Accountgegevens](https://support.google.com/googleplay/android-developer/answer/13628312?hl=nl) | Geen merchantaccount aanmaken voor niet-bestaande aankopen. |
| Android-ontwikkelaarsverificatie | Open — nog niet invullen. Home → Android developer verification; status van het definitieve pakket controleren. | Blokkeert indienen | [Pakketregistratie](https://support.google.com/googleplay/android-developer/answer/16984799?hl=en) | Bij succesvolle autoregistratie niets opnieuw registreren. |
| Pakket / certificaat registreren | Controleer nl.fabelpad.app en de aangeboden Play-certificaatroute; uploadcertificaatvingerafdruk staat in G2. | Te verifiëren | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Play-appsigningcertificaat ontstaat afzonderlijk bij Google; geen debugcertificaat gebruiken. |
| Handelaarsstatus account | Open — nog niet invullen. Kies Handelaar of Geen handelaar op basis van werkelijke activiteit. | Te verifiëren | Account beheren → Accountgegevens → Over jou; [handelaar](https://support.google.com/googleplay/android-developer/answer/17594752?hl=nl) | Niet uit gratis of accounttype afleiden. |
| Handelaarsstatus per app / voorwaarden | Als Handelaar: app-specifiek bevestigen en echte toepasselijke voorwaarden-URL invullen. Anders N.v.t. — tak verschijnt bij Handelaar. | Te verifiëren | App-content; zelfde bron. | Publieke voorwaarden en eventuele vereiste bedrijfscontacten regelen. |
| Appnaam | Fabelpad. | Bevestigd | Productienaam in [config](/home/codex/repos/fabelpad/mobile/app.config.ts); 8/30 tekens. | Vergelijk met uiteindelijke app-label. |
| Pakketnaam | nl.fabelpad.app. | Bevestigd | Expliciet bevestigd door eigenaar; [app maken](https://support.google.com/googleplay/android-developer/answer/9859152?hl=nl) | Exact met AAB/applicationId vergelijken vóór eerste registratie/upload. |
| Standaardtaal | Nederlands, locale nl-NL. Andere talen uit laten zolang niet gekozen. | Voorstel | Native interface en verhalen Nederlands. | Eventuele vertalingen later toevoegen. |
| App of Game | App aanvinken; Game uit laten. | Voorstel | Kern is lezen en verhaalkeuzes; stationinteractie aanvullend. | Bij ander productbesluit herzien. |
| Kosteloos of betaald | Kosteloos aanvinken; Betaald uit laten. | Bevestigd | Gratis lokale release door eigenaar bevestigd; [prijskeuze](https://support.google.com/googleplay/android-developer/answer/6334373?hl=en) | Gratis aanbieden kan niet later op hetzelfde pakket in een betaalde download worden veranderd. |
| Support-e-mailadres | support@fabelpad.nl. | Bevestigd | Door eigenaar bevestigd openbaar roladres; [app maken](https://support.google.com/googleplay/android-developer/answer/9859152?hl=nl) | Aflevering en beheer vóór publicatie testen. |
| Programmabeleid / Amerikaanse exportregels | Eigenaar leest en vinkt na instemming de getoonde bevestigingen aan. | Te verifiëren | Zelfde app-maken-bron. | Juridische bevestiging niet namens eigenaar veronderstellen. |
| Servicevoorwaarden Play App Signing | Eigenaar beoordeelt en accepteert; Google-standaard signing is voorstel. | Te verifiëren | [Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=nl) | Uploadsleutel en Google-appsigningkey afzonderlijk beheren. |

**Afsluiten A:** klik App maken wanneer pakket, account en bevestigingen kloppen. Er is binnen deze voorbereiding geen Console-app aangemaakt.

## B. Store-instellingen, vermelding en beeld

Route: Aantal gebruikers vergroten → Aanwezigheid in Google Play Store → Store-instellingen / Primaire Store-vermelding. Zoek op de schermnaam als het menu afwijkt.

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Categorie | App → Boeken en referentie. | Voorstel | Verhalenbibliotheek in [App](/home/codex/repos/fabelpad/mobile/App.tsx); [categorieën](https://support.google.com/googleplay/android-developer/answer/9859673?hl=nl) | Geen onderwijs-/therapieresultaten claimen. |
| Tags | Open — nog niet invullen. Kies maximaal vijf werkelijk aangeboden passende lees-/verhalentags. | Te verifiëren | Exacte huidige Console-lijst ontbreekt; zelfde bron. | Alleen Tags beheren-scherm nodig voor exacte opties. |
| Toegankelijkheidstags | Open — nog niet invullen; alleen bewezen ondersteuning aanvinken. | Te verifiëren | Grotere tekst is aanwezig; TalkBack/deviceacceptatie niet aangetoond. | De betreffende ondersteuning echt testen. |
| Contact-e-mail | support@fabelpad.nl. | Bevestigd | Openbaar roladres door eigenaar bevestigd. | Aflevering en beheer testen. |
| Website / telefoon | Website https://fabelpad.nl pas overnemen na herstel publieke toegang; optionele telefoon leeg tenzij bewust gekozen. | Te verifiëren | Eigenaar bevestigt domein; publieke privacycontrole geeft HTTP 401 via StackProtect. | Website/beleid zonder login/blokkade bereikbaar maken; geen productieactivatie binnen deze voorbereiding. |
| Externe marketing | Voorstel uitvinken. | Voorstel | Dit betreft Google-promotie, niet advertenties in de app; [assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=nl) | Eigenaar kan anders kiezen. |
| Taal / vertalingen | Nederlands, nl-NL; andere talen voorlopig uit laten. | Voorstel | Beschikbare UI/content Nederlands. | Taalkeuze bevestigen. |
| Naam / korte / volledige beschrijving | Kopieer B1 na vergelijking met de release. | Voorstel | Tellingen 8/30, 73/80 en bij B1; [metadata](https://support.google.com/googleplay/android-developer/answer/9859152?hl=nl) | Geen cloud-/koopfuncties toevoegen die niet bereikbaar zijn. |
| Store-icoon | Extern laten maken: fabelpad-store-icon-512.png, 512×512, 32-bits PNG met alfa, maximaal 1024 KB. | Blokkeert indienen | Opdracht eigenaar; [assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=nl) | Werkelijk bestand ontbreekt. Dit Storebestand vervangt de app-launcher niet. |
| Launcher / adaptive icon | Laat ook een passend bronbestand en eventuele aparte voor-/achtergrondlagen voor de app leveren. | Te verifiëren | Productieconfiguratie vereist echte app-assets. | Voor finale AAB inbouwen; geen ander icoon alleen in Store gebruiken. |
| Functieafbeelding | Extern: fabelpad-feature-1024x500.png, 1024×500, JPEG of 24-bits PNG zonder alfa. | Blokkeert indienen | Nog niet aanwezig; zelfde assetbron. | Geen badges/ranglijsten of gefingeerde functies. |
| Telefoonscreenshots | Extern afwerken op echte captures; voorstel zes beelden, 1080×1920, JPEG/24-bits PNG zonder alfa, maximaal 8 MB per bestand. | Blokkeert indienen | [Captureguide](https://developer.android.com/google/play/requirements/screenshots-android-cli); B2. | Minstens twee voor publicatie; vier 9:16/16:9-beelden voor promotiegeschiktheid. |
| Tabletveld 7 inch / fysieke 8-inch-tablet | Gebruik de werkelijk aangeboden 7-inch-tabletsectie voor passende kleine-tabletcaptures. De gebruiker vraagt 8-inch-beelden; er is geen afzonderlijk bevestigd 8-inch-veld. | Voorstel | Help noemt 7-inch en 10-inch; [assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=nl) | Vier tot acht beelden van echte 8-inch-layout; geen telefoonscreenshot uitrekken. |
| Tabletveld 10 inch | Vier tot acht echte 10-inch-tabletbeelden; eigen Console-sectie. | Blokkeert indienen | Ondersteuning beoogd, acceptatie en assets ontbreken. | Echte release op groot scherm testen. |
| Tabletresolutie | Broncaptures 1600×2560 of 2560×1600 zijn volgens de huidige captureguide bruikbaar voor beide tabletslots. | Voorstel | [Captureguide](https://developer.android.com/google/play/requirements/screenshots-android-cli) | Voor 9:16/16:9-promotie zo nodig opnieuw op die viewport capturen; niet rekken of UI afsnijden. |
| Algemene screenshotgrenzen | Veilige doorsnede: 1080–3840 px per zijde, 9:16 of 16:9, zonder alfa, maximaal acht per type. | Voorstel | Algemene Help noemt max. 2:1; nieuwe captureguide max. 2,3:1. | Gebruik de veilige doorsnede bij twijfel; tablet 16:10 is uploadbaar maar niet dezelfde promotieaanbeveling. |
| Chromebook | Open — nog niet als ondersteund/uitgesloten verklaren. | Te verifiëren | Productie-ABI’s en Device Catalog onbekend; [vormfactoren](https://support.google.com/googleplay/android-developer/answer/13295490?hl=en) | Resizen, keyboard en compatibiliteit toetsen; geen fictieve captures. |
| Android TV / TV-banner | N.v.t. — geen TV-variant of TV-distributie gekozen. | N.v.t. | Geen leanback-app. | Alleen bij echte TV-release banner en TV-screenshot maken. |
| Wear OS | N.v.t. — geen Wear-app. | N.v.t. | Native scope. | Geen Wear-assets. |
| Automotive / Auto | N.v.t. — geen auto-app. | N.v.t. | Native scope. | Geen voertuig-/templateclaims. |
| Android XR | N.v.t. — geen XR-app. | N.v.t. | Native scope. | Geen XR-assets. |
| Alt-tekst | Maximaal 140 tekens per zichtbaar veld; concrete voorstellen B2. | Voorstel | [Assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=nl) | Definitieve beschrijving met het beeld vergelijken. |
| YouTube-preview | Leeg laten; optioneel, geen video beschikbaar. | Voorstel | Zelfde bron. | Eventueel later een echte productvideo toevoegen. |
| Rechten / regionale beeldregels | Open — nog niet invullen als algemene goedkeuring. | Te verifiëren | Licenties voor merk, verhalen en illustraties niet bevestigd. | Rechten en eisen van gekozen landen bevestigen. |

### B1. Kopieerklare Store-tekst — voorstel Nederlands

De tekst beschrijft de bevestigde lokale productomvang. Bij een latere andere productomvang eerst herschrijven. Telling gebruikt Unicode-tekens inclusief interne regeleinden, exclusief blokmarkeringen en afsluitend regeleinde.

**Naam: 8/30**

~~~text
Fabelpad
~~~

**Korte beschrijving: 73/80**

~~~text
Kies samen een verhaalpad vol fantasie, verrassingen en kleine avonturen.
~~~

**Volledige beschrijving: 1332/4000 Unicode-tekens.**

~~~text
Een trein zonder bestemming, een tuin vol geheimen en een avontuur dat met jouw keuze verdergaat. In Fabelpad ontdekken kinderen en hun ouders samen dertien geïllustreerde verhalen.

LEES, KIES EN ONTDEK
Elk verhaal bestaat uit vijf delen. Na ieder deel kies je wat er gebeurt. Een ander pad brengt een andere afloop. Zoek een verhaal in de bibliotheek, bewaar je favorieten en ga verder waar je gebleven was.

SPEEL MEE OP HET PERRON
In Het Verdwaalde Station help je draakje Dibbel met zijn kaartje of ontdek je de gouden sleutel. Stap daarna in de trein en bedien de spoorwissel. Jouw keuzes wijzen de weg.

IEDER EEN EIGEN VERHAALPAD
Maak maximaal vijf lokale kindprofielen met een voornaam of bijnaam en een avatar. Elk profiel heeft eigen favorieten en verhaalvoortgang. Na een voltooid avontuur vind je een herinnering in je schatkist.

EEN RUSTIG LEESMOMENT
Kies in het ouderhoekje voor grotere verhaaltekst of rustigere bewegingen. Lees zelf voor of gebruik de voorleesfunctie wanneer een ondersteunde lokale Nederlandse stem beschikbaar is. Zonder geschikte stem blijft zelf lezen mogelijk.

Alle verhaalteksten en illustraties zijn in de app opgenomen. Je begint zonder online account. Profielen, favorieten en leesvoortgang worden op het gebruikte apparaat bewaard. In het ouderhoekje kun je deze lokale gegevens wissen.
~~~

De voorleesalinea beschrijft de geïmplementeerde bronroute; overnemen nadat dezelfde route in de finale build is getest. Bij een andere ondersteunde route veranderen zowel deze tekst als C en E.

### B2. Briefing voor de externe maker

Lever per formaat dezelfde scenario’s in onderstaande volgorde. Bestandsnamen zijn voorstellen; geen bestand is hiermee al gemaakt. Gebruik uitsluitend captures van de finale release met synthetische profielen zoals Avonturier en Testlezer, zonder notificaties, persoonsgegevens of debugoverlays. Lever telefoon 1080×1920; tabletbroncaptures 1600×2560 en desgewenst aparte werkelijk gecapturede 9:16-promotiebeelden. Bewaar onbewerkte captures naast de vormgeving.

| Volgorde / naam | Scène | Alt-tekstvoorstel |
| --- | --- | --- |
| 01-bibliotheek-{telefoon,tablet8,tablet10}.png | Ontdek met verhalenbibliotheek | Bibliotheek met geïllustreerde verhalen in Fabelpad. |
| 02-stationsverhaal-{formaat}.png | Leespassage uit Het Verdwaalde Station | Een verhaalpassage uit Het Verdwaalde Station. |
| 03-stationskeuze-{formaat}.png | Echte ticket-, sleutel- of wisselinteractie | Kies hoe het stationsverhaal verdergaat. |
| 04-favorieten-{formaat}.png | Zelf bewaarde favorieten | Favoriete verhalen op dit apparaat. |
| 05-schatkist-{formaat}.png | Herinnering na voltooid verhaal | Schatkist met herinneringen uit afgeronde verhalen. |
| 06-leesinstellingen-{formaat}.png | Grotere verhaaltekst en rustige bewegingen | Leesinstellingen voor grotere tekst en rustige bewegingen. |

**Afsluiten B:** controleer Store-preview voor taal en apparaat, daarna Opslaan. De externe beelden moeten eerst aanwezig en technisch gecontroleerd zijn.

## C. App-content en toegang voor Google-review

Route: Controleren en verbeteren → Beleid en programma’s → App-content. Controleer Vereist aandacht én Actie ondernomen.

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Privacybeleid / URL | Open — nog niet invullen. https://fabelpad.nl/privacy geeft bij publieke controle HTTP 401 via StackProtect. | Blokkeert indienen | Lokale productie-webbuild geslaagd; /privacy, /support en /account-verwijderen lokaal HTTP 200. | Publieke hosting/toegang herstellen; beleid zonder login/regioblokkade opnieuw testen. |
| Privacybeleid / in-app route | Ouders → Privacybeleid → lokale oudercontrole → Open externe app. URL https://fabelpad.nl/privacy is bedoeld maar nog niet publiek geverifieerd. | Te verifiëren | [Linkactie](/home/codex/repos/fabelpad/mobile/App.tsx:114), [ouderhoek](/home/codex/repos/fabelpad/mobile/App.tsx:143) | Definitieve AAB en publiek beleid testen. |
| Inhoud privacybeleid | Concept C1 als basis; open verantwoordelijke, contact en spraakgedrag eerst invullen/verifiëren. | Voorstel | [Gebruikersgegevens](https://support.google.com/googleplay/android-developer/answer/10144311?hl=nl) | Werkelijke ontvangers, beveiliging, bewaartermijnen en wissen beschrijven. |
| Bevat de app advertenties? | Nee voor het lokale productievoorstel. | Bevestigd | Geen advertentie-UI of ad-SDK in geïnspecteerde native bron. | Productie-AAB gecontroleerd; toekomstige SDK-wijzigingen opnieuw controleren. |
| Advertentie-ID gebruikt? | Nee voor de geïnspecteerde bron; definitief manifest controleren in F. | Bevestigd | Productie-AAB: uitsluitend VIBRATE en eigen signaturepermission; AD_ID ontbreekt. | Niet met advertentieweergave of marketingdoel verwarren. |
| Marketing als gegevensdoel | Nee; niet selecteren zonder werkelijke marketingstroom. | Bevestigd | Geen native marketingstroom. | Externe marketing van Google is een andere instelling. |
| App-toegang | Geen account/koppeling/paywall. Leesfuncties vrij toegankelijk; externe privacy-/supportlinks vragen een lokale oudercontrole, beschreven in C2. Als het formulier oudercontroles onder beperkte toegang rekent, kies die tak en voeg C2 toe. | Voorstel | Geen login/koppeling/paywall; [reviewvereisten](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en) | Exacte Nederlandse optie: Formuliertekst te bevestigen. |
| Revieweraccount / OTP / QR | N.v.t. — velden verschijnen bij beperkte toegang; lokale release heeft geen account. | N.v.t. | Native bron; geen bereikbare web-authflow. | Geen webcredentials voor een ander pakket opgeven. |
| Reviewer-instructies | Gebruik C2 na praktijktest op dezelfde AAB. | Voorstel | Echte native flows; spraak-/resetlabels nog vergelijken. | Bij gewijzigde toegang alle rollen en beperkingen opnieuw beschrijven. |
| Nieuwe taken / Vereist aandacht | Open — nog niet als afgerond verklaren. | Te verifiëren | Geen actueel Console-scherm; [App-content](https://support.google.com/googleplay/android-developer/answer/9859455?hl=nl) | Alleen daadwerkelijk getoonde nieuwe taken toevoegen. |
| Actie ondernomen / Beleidsstatus | Controleer overeenstemming met exacte release en eventuele beleidsmeldingen. | Te verifiëren | Opslaan bewijst geen goedkeuring. | Getoonde fouten gericht oplossen. |

### C1. Privacytekst — redactieconcept

Niet publiceren met open onderdelen. De onderstaande lokale-voorleesclaim is alleen toegestaan na definitieve implementatie en verificatie.

~~~text
Privacyverklaring Fabelpad

Fabelpad is een Android-app met gebundelde geïllustreerde verhalen. In de beschreven versie maak je geen online account. Je kunt lokale profielen met een voornaam of bijnaam en een avatar gebruiken.

De app bewaart profielgegevens, favorieten, leesvoortgang en leesinstellingen op het gebruikte apparaat. Gebruik gerust een verzonnen bijnaam. De lokale appdatabase is geen online account en heeft geen automatische bewaartermijn van 90 dagen. Gegevens blijven staan totdat je ze wist of de appgegevens verwijdert. De route voor volledig wissen staat in het ouderhoekje.

Voorlezen gebruikt uitsluitend een ondersteunde lokale Nederlandse apparaatstem. De app kiest geen online stem als terugval. Als geen geschikte stem beschikbaar is, blijft zelf lezen mogelijk. Deze beschrijving moet vóór publicatie met de definitieve release en ondersteunde spraakmotoren zijn gecontroleerd.

De hier beschreven app bevat geen advertenties, aankopen, analytics-upload, cloudsync, chat of online gebruikersaccounts. Een openbare privacy- of supportlink opent buiten de app. De website kan eigen technische toegangsgegevens verwerken; het beleid moet de werkelijk gebruikte hosting en contactverwerking apart beschrijven.

Nog vóór publicatie aanvullen: officiële verantwoordelijke en openbare privacycontactgegevens, datum en versie van dit beleid, daadwerkelijke verwijderknop, backup-/toesteloverdrachtgedrag, ondersteunde spraakroute en eventuele ontvangers, beveiliging en bewaartermijnen voor website-/supportverwerking.
~~~

### C2. Google reviewer instructions — English

**Proposed title:** Access to Fabelpad’s local story reader

**Reviewer role:** no account required; an adult reviewer can complete the local external-link check using synthetic year 1990.

Use only after these steps pass on the exact submitted build. This is a local reading product; it does not require a special demonstration account.

~~~text
No sign-in, subscription, invitation, QR code, location, or additional hardware is required. All story content in this version is available without an online account.

1. Launch Fabelpad. The “Ontdek” library opens using the local profile “Avonturier”.
2. Open “Het Verdwaalde Station”. Read the passage and follow the displayed story choices. On the ticket route, use “Help Dibbel”, place the star sticker when prompted, then choose “Instappen”. The cabinet route lets you discover and use the golden key. Continue with the displayed track choices.
3. Complete the five story parts. Open “Naar mijn schatkist” to see the keepsake for the completed route.
4. Open “Wie speelt?” and create a synthetic local profile such as “Testlezer”. Switch profiles to inspect their separate favorites and reading progress.
5. Open “Ouders” to change “Grotere verhaaltekst” or “Rustige bewegingen”. There is no separate parent account or parent PIN in this version.
6. In a story, tap “Lees voor met offline apparaatstem”. Read-aloud is optional and uses a supported offline Dutch voice, with no online fallback. Saved child names are replaced with the generic name “Avonturier” for speech. If no suitable voice is installed, a message appears and on-screen reading remains available.
7. To clear local test data, choose “Ouders” → “Alle gegevens op dit apparaat wissen” → “Wissen”.
8. In “Ouders”, choose “Privacybeleid” or “Contact en hulp”. The external-link parent check accepts a synthetic adult birth year such as 1990. Enter 1990 and select “Open externe app”. This is a local check, not account authentication; the year is not stored or sent. Privacy opens the public policy in the browser; support opens the mail app for support@fabelpad.nl. Verify both destinations on the submitted build.

Do not use credentials for the separate Fabelpad website. If account-based features or purchases are added, these instructions must be replaced and any reusable review credentials must be entered directly in Play Console’s App access fields.
~~~

**Afsluiten C:** per verklaring Opslaan zodra de betreffende feiten en links kloppen; geen beperkte toegang als onbeperkt verklaren.

## D. Doelgroep en IARC-contentclassificatie

Leeftijdsdoelgroep, eventuele technische toegangsbeperking en IARC-rating zijn afzonderlijke beslissingen. De kindprofielen, dierfiguren en verhaalvorm maken kinderen relevant; begeleid gebruik door ouders verandert dit niet in een uitsluitend volwassen doelgroep.

### D1. Doelgroep en content

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Getargete leeftijdsgroepen | Open — nog niet invullen. Voorstel 6–8 jaar; 9–12 alleen indien bewust bedoeld en passend. | Te verifiëren | Kindgerichte teksten/beelden; [doelgroep](https://support.google.com/googleplay/android-developer/answer/9867159?hl=nl) | Eigenaar bevestigt precieze groepen. |
| Beschikbare leeftijdsvakken | Selecteer uitsluitend passende: 5 jaar en jonger; 6–8; 9–12; 13–15; 16–17; 18 jaar en ouder. | Voorstel | Zelfde officiële bron. | Niet alle groepen selecteren; voor 5-en-jonger passende lees-/luisterervaring aantonen. |
| Ontwerp aantrekkelijk voor kinderen | Ja als de getoonde vraag dit onderwerp bedoelt; exacte vertakte vraag: Formuliertekst te bevestigen. | Te verifiëren | Verhalen, fantasiedieren en kindprofielen. | Alleen het ontbrekende vertakte scherm nodig. |
| Toegang voor minderjarigen | Open — nog niet invullen bij een onbekende afslag. Lezen heeft geen leeftijdsblokkade; externe links vragen een lokale oudercontrole. | Te verifiëren | Native bron; zelfde beleidsbron. | Geen niet-bestaande leeftijdsgate of ouder-PIN claimen. |
| Families-vereisten | Van toepassing bij gekozen kindergroep; de app moet er daadwerkelijk aan voldoen. | Bevestigd | [Gezinsbeleid](https://support.google.com/googleplay/android-developer/answer/9893335?hl=nl) | Voorlezen en alle SDK’s in de release toetsen. |
| Neutraal leeftijdsscherm aanwezig? | Nee voor de leesroute. De oudercontrole voor externe links is geen neutraal leeftijdsscherm voor gegevens-/advertentiescheiding. | Bevestigd | [Lokale controle](/home/codex/repos/fabelpad/mobile/App.tsx:117); geboortejaar blijft vluchtig lokaal. | Bij gemengde, verschillend verwerkte SDK-/advertentieroutes herbeoordelen; zo’n route is nu niet aanwezig. |
| Advertenties aan kinderen / gecertificeerde ad-SDK’s | N.v.t. — tak verschijnt bij advertenties, die deze versie niet bevat. | N.v.t. | C en native bron; Gezinsbeleid. | Bij toevoeging advertenties complete tak heropenen. |
| Teacher Approved / Goedgekeurd door docenten | Open — nog niet invullen als optionele deelnamekeuze verschijnt. | Te verifiëren | Geen deelname-/beoordelingsbewijs. | Geen keurmerk in beelden of metadata. |

**Afsluiten D1:** overzicht controleren en Opslaan.

### D2. IARC

Er zijn geen huidige IARC-schermen. Alle bekende onderwerpen staan afzonderlijk hieronder; onbekende frequentie-/ernstafslagen zijn niet als exacte vragen gereconstrueerd. Bron: [IARC/contentclassificatie, controle 18-11-2026](https://support.google.com/googleplay/android-developer/answer/9859655?hl=nl). Alle verhaalpaden en afbeeldingen hebben nog geen vastgelegde volledige menselijke redactionele beoordeling.

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| IARC-contactadres | support@fabelpad.nl indien eigenaar dit adres ook voor classificatiecontact wil gebruiken. | Voorstel | Supportadres door eigenaar bevestigd; rol voor IARC nog kiezen. | In Console bevestigen. |
| Vragenlijstcategorie | Voorstel de aangeboden categorie voor overige apps/verhalenlezer. | Te verifiëren | Geen sociale of communicatieapp. | Formuliertekst te bevestigen; Store-categorie niet als IARC-antwoord verzinnen. |
| Geweld | Open — nog niet invullen. Geen gevechtsmechaniek; volledige contentreview ontbreekt. | Te verifiëren | [Content](/home/codex/repos/fabelpad/mobile/src/content.json) | Getoonde hoofdvraag en alle ernst-/contextvragen beantwoorden. |
| Bloed / letsel / overlijden | Open — nog niet invullen. Scan leverde geen bewijs van zulke inhoud; dat is geen volledige certificering. | Te verifiëren | Verhaaltekst en beeldsteekproef. | Alle paden beoordelen. |
| Angst / horror / enge beelden | Open — nog niet invullen. De Knuffelwacht bevat een vriendelijk monstertje en angsttermen. | Blokkeert indienen | Content story toy, scènes 10/11. | Exact angstscherm en eventuele frequentie/ernst nodig. |
| Seksuele inhoud / naaktheid | Open — nog niet invullen; voorindicatie geen seksuele inhoud aangetroffen. | Te verifiëren | Kindverhalen/beeldsteekproef. | Redactioneel bevestigen; vervolgvelden N.v.t. na bevestigd Nee. |
| Seksuele verwijzingen / relaties | Open — nog niet invullen; geen seksuele feature aangetroffen. | Te verifiëren | Gewone vriendschap onderscheiden van seksuele thema’s. | Exacte vraag indien getoond. |
| Taalgebruik / discriminatie | Open — nog niet invullen; scan bewijst geen volledige tekst-/beeldreview. | Te verifiëren | Gebundelde verhaaltekst. | Alle actuele content beoordelen. |
| Alcohol / tabak / drugs | Open — nog niet invullen; geen middelenfeature aangetroffen. | Te verifiëren | Gebundelde kindverhalen. | Verhaalcontext en zichtbare vervolgvraag beoordelen. |
| Gokken / simulatie / geldprijzen | Nee voor de aanwezige appmechanieken. | Bevestigd | Verhaalkeuzes en vaste herinneringen; geen inzet of competitie. | IARC-woordkeuze met werkelijk scherm vergelijken. |
| Lootboxes / betaalde willekeurige items | Nee. | Bevestigd | Geen aankopen of kansitems. | Vervolgtak N.v.t. bij Nee. |
| Digitale aankopen | Nee. | Bevestigd | Eigenaar kiest gratis lokale release zonder abonnementen. | Release mag geen koopflow introduceren zonder herbeoordeling. |
| Chat / gebruikersinteractie | Nee. | Bevestigd | Lokale profielen communiceren niet onderling. | Sociale vervolgvelden N.v.t. bij Nee. |
| Publieke UGC / delen | Nee. | Bevestigd | Geen posts, upload of publieke naamdeling. | Een lokaal profiel is geen communityfunctie. |
| Locatie of persoonsgegevens delen als gebruikersfunctie | Nee. | Bevestigd | Geen locatie- of sociale deelfeature. | TTS/privacyvraag afzonderlijk in E behandelen. |
| Externe links | Ja; de productiebron bevat privacy-/supportlinks achter een lokale oudercontrole. | Bevestigd | [Externe linkactie](/home/codex/repos/fabelpad/mobile/App.tsx:114). | Geen onbeperkte webtoegang claimen; exacte IARC-vraag bepaalt vervolg. |
| Onbeperkte webtoegang / browser | Nee voor het lokale product; een externe privacy-/mail-link is geen ingebouwde vrije browser. | Bevestigd | Geen actieve WebView/browserfunctie. | Definitieve AAB/links testen. |
| Online veranderende / ingebedde content | Nee voor de gebundelde verhalen. | Bevestigd | Verhalen/illustraties meegebundeld; geen contentserver of actieve OTA-route. | Een gewone update via Play afzonderlijk beoordelen van live content. |
| Frequentie / context / ernst | Open — nog niet invullen; alleen werkelijke vervolgvelden. | Te verifiëren | Geen Console-schermen. | De specifieke getoonde afslag nodig. |
| Regionale classificaties | Open — nog niet invullen; kopieer de officiële Console-samenvatting. | Blokkeert indienen | IARC kent classificaties toe. | Geen PEGI 3/7 of “alle leeftijden” vooraf garanderen. |

**Afsluiten D2:** beantwoorde vragen en regionale samenvatting controleren, daarna Indienen. De exacte volledige IARC-vragenboom blijft afhankelijk van de getoonde Console-afslag.

## E. Veiligheid van gegevens

Route: App-content → Veiligheid van gegevens. Dit blad beoordeelt uitsluitend nl.fabelpad.app in het door eigenaar bevestigde lokale productieaanbod. De webapp/backend zijn geen bereikbare account-/cloudfuncties van dit pakket. Een gewone externe browsernavigatie naar privacybeleid is geen gecontroleerde WebView; de feitelijke website/supportverwerking moet wel in het privacybeleid worden beschreven.

### E1. Verzameling en beveiliging

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Is het formulier vereist? | Ja voor productie en gesloten/open testen. | Bevestigd | [Gegevensveiligheid](https://support.google.com/googleplay/android-developer/answer/10787469?hl=nl) | Uitzondering uitsluitend interne test niet als productie-vrijstelling gebruiken. |
| Verzamelt of deelt de app vereiste typen gebruikersgegevens? | Open — nog niet invullen. Als de volledige lokale implementatie en gebruikte spraakdienst aantoonbaar geen relevante overdracht doen: Nee. | Blokkeert indienen | Geen eigen backend; lokale spraakroute in bron aanwezig, eindartefact statisch gecontroleerd; motorgedrag op toestel nog te inspecteren. | E2/E3 en releasegedrag afronden; geen nulverzameling uit productbedoeling afleiden. |
| Alle verzamelde gegevens versleuteld tijdens overdracht? | Open — nog niet invullen. Bij bewezen geen verzameling: N.v.t. — vervolgveld verschijnt bij verzameling. | Te verifiëren | Productiedomein met HTTPS bewijst geen TTS-transport. | Bij enige echte stroom transport van apparaat tot ontvanger controleren. |
| Accountaanmaak: Gebruikersnaam en wachtwoord | Nee — uit laten. | Bevestigd | Geen accountflow; eigenaar bevestigt lokaal aanbod. | Opnieuw beoordelen bij toekomstige login. |
| Gebruikersnaam en andere verificatie | Nee — uit laten. | Bevestigd | Geen e-mail/telefoon + OTP. | Webplatformroadmap is geen native functie. |
| Gebruikersnaam, wachtwoord en andere verificatie | Nee — uit laten. | Bevestigd | Geen wachtwoord/2FA. | Geen reviewer-bypass verzinnen. |
| OAuth | Nee — uit laten. | Bevestigd | Geen Google/SSO-accountaanmaak. | Voorbereide library is geen actieve flow. |
| Overig | Nee — uit laten; beschrijvingsveld N.v.t. — verschijnt bij Overig. | Bevestigd | Lokale profielen zijn geen online accounts. | Geen lokale bijnaam als accountmethode aangeven. |
| Mijn app staat gebruikers niet toe een account te maken | Ja — als enige accountaanmaakoptie aanvinken. | Bevestigd | [Opslag](/home/codex/repos/fabelpad/mobile/src/storage.ts); [accountverwijdering](https://support.google.com/googleplay/android-developer/answer/13327111?hl=nl) | Ook geen accountwebsite vanuit dit pakket introduceren. |
| Account-URL verwijderen | N.v.t. — tak verschijnt bij toepasselijke accountaanmaak. | N.v.t. | Geen app-account. | Geen fictieve URL of algemene reset als web-accountverwijdering opgeven. |
| In-app accountverwijdering | N.v.t. — geen account. Lokale gegevens wissen blijft een echte functie. | N.v.t. | App/opslaan. | Bij latere accounts in-app én openbare webverzoekroute bouwen. |
| Gegevens verwijderen met behoud van account | Voorstel leeg laten indien optioneel; geen externe verwijderings-URL claimen. | Voorstel | Geen account of externe database. | Definitieve lokale resetroute en eventuele ontvangers verifiëren. |
| Binnen 90 dagen automatisch verwijderd | Nee — optie niet selecteren. | Bevestigd | Lokale gegevens blijven tot wissen; geen aangetoonde automatische termijn. | Geen bewaartermijn verzinnen. |
| Onafhankelijke beveiligingsbeoordeling | Nee — geen deelname/certificering claimen. | Bevestigd | Geen bewijs; gewone tests zijn geen onafhankelijke beoordeling. | Alleen heropenen bij echte deelname. |
| UPI-betalingen geverifieerd | N.v.t. — geen betalingen. | N.v.t. | Geen UPI/Billing. | Niet aanvinken. |
| Gegevenssamenvatting / Store-preview | Open — nog niet indienen. | Blokkeert indienen | AAB beschikbaar; E2/E3 en toestel-/motorgedrag nog open. | Privacybeleid, alle typen en preview vergelijken. |

De Nederlandse accountopties hierboven volgen de aangeleverde veldnamen; de actuele vertakte schermtekst blijft Formuliertekst te bevestigen wanneer Console anders presenteert. Verzameling betekent relevante overdracht vanaf het apparaat; zuiver lokale verwerking valt daarbuiten. Directe overdracht naar een andere app op hetzelfde apparaat kan daarentegen delen zijn, afhankelijk van inhoud, ontvanger en geldige uitzondering. Een lokale TTS-motor kiezen bewijst daarom niet zelfstandig het antwoord op iedere deelvraag.

### E2. Alle 38 gegevenstypen

“Nee” hieronder is bronbewijs voor de lokale hoofdroute; vóór indiening is een eindcontrole op het releasebestand vereist. De open spraak-/SDK-nevenstromen worden niet als vastgesteld Ja aangemerkt. Generieke gebundelde verhaaltekst is geen gebruikersopname; lokale profiel-ID’s zijn geen installatie-ID’s. Voor de onbesliste stromen staat steeds Open. Taxonomie en definities: [officiële Gegevensveiligheid, controle 18-11-2026](https://support.google.com/googleplay/android-developer/answer/10787469?hl=nl).

| Categorie / type | Aanvinken | Verzameld | Gedeeld | Kortstondig verwerkt | Vereist of optioneel | Doelen verzameld | Doelen gedeeld | App-bewijs / status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Locatie / Geschatte locatie | Open — nog niet invullen | Open | Open | Open | Open | Open | Open | Geen app-locatiefeature; eventuele spraakdienst-/netwerkafleiding niet vastgesteld. Te verifiëren. |
| Locatie / Exacte locatie | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen locatie-API, sensorrecht of exacte afleiding. Bevestigd bronroute. |
| Persoonlijke informatie / Naam | Open — nog niet invullen | Open | Open | Open | Open | Open | Open | Naam lokaal; App.tsx:109 geeft vaste Avonturier door. Geen naamstroom in nieuwe bron aangetroffen; finale AAB/motor nog te controleren. |
| Persoonlijke informatie / E-mailadres | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen app-e-mailveld of auth; een door gebruiker geopende externe mailclient is aparte gebruikersactie. Bevestigd bronroute. |
| Persoonlijke informatie / Gebruikers-ID’s | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Lokale random profiel-ID; geen upload/account-ID. Bevestigd bronroute. |
| Persoonlijke informatie / Adres | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen adresveld of overdracht. Bevestigd. |
| Persoonlijke informatie / Telefoonnummer | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen telefoon/OTP-feature. Bevestigd. |
| Persoonlijke informatie / Ras en etniciteit | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen betreffende invoer of afleiding. Bevestigd. |
| Persoonlijke informatie / Politieke of religieuze overtuigingen | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen betreffende invoer of afleiding. Bevestigd. |
| Persoonlijke informatie / Seksuele geaardheid | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen betreffende invoer of afleiding. Bevestigd. |
| Persoonlijke informatie / Andere informatie | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Avatarindex/voorkeuren lokaal; geboortejaar voor externe-linkoudercontrole uitsluitend vluchtig op apparaat, niet opgeslagen/verzonden. Bevestigd bronroute App.tsx:117. |
| Financiële informatie / Betalingsinformatie van gebruiker | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen betaling of betaal-SDK. Bevestigd. |
| Financiële informatie / Transactieoverzicht | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen aankoop; schatkist is lokale verhaalbeloning. Bevestigd. |
| Financiële informatie / Kredietscore | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen financiële functie. Bevestigd. |
| Financiële informatie / Andere financiële informatie | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen financiële functie. Bevestigd. |
| Gezondheid en fitness / Medische informatie | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen Health Connect/diagnose; grotere tekst is weergavevoorkeur. Bevestigd. |
| Gezondheid en fitness / Fitnessinformatie | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen fitness-/sensorfeature. Bevestigd. |
| Berichten / E-mails | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen toegang tot e-mailinhoud; fictieve Droompost geen gebruikersmail. Bevestigd. |
| Berichten / Sms of mms | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen SMS-API of recht. Bevestigd. |
| Berichten / Andere in-app berichten | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Dialoog in verhalen is vaste content, geen gebruikersberichten. Bevestigd. |
| Foto’s en video’s / Foto’s | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Bundelillustraties geen gebruikersfoto’s; geen picker/camera. Bevestigd. |
| Foto’s en video’s / Video’s | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen video/camera/upload. Bevestigd. |
| Audiobestanden / Spraak- of geluidsopnamen | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | TTS maakt spraak; neemt geen gebruikersstem op. Bevestigd. |
| Audiobestanden / Muziekbestanden | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen toegang tot gebruikersmuziek. Bevestigd. |
| Audiobestanden / Andere audiobestanden | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen invoer/upload van gebruikersaudio; TTS-output is geen gebruikersopname. Bevestigd. |
| Bestanden en documenten / Bestanden en documenten | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen import/picker/upload; eigen database geen documentcollectie. Bevestigd. |
| Agenda / Agenda-afspraken | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen agenda-API/recht. Bevestigd. |
| Contacten / Contacten | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen contacten-API/recht. Bevestigd. |
| App-activiteit / App-interacties | Open — nog niet invullen | Open | Open | Open | Open | Open | Open | Route/favorieten lokaal; gesproken scène kan route onthullen aan afzonderlijke motor. Lokale route en uitzondering toetsen. |
| App-activiteit / In-app zoekgeschiedenis | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Zoekterm alleen in lokale React-state; geen doorgifte aan TTS/server. Bevestigd. |
| App-activiteit / Geïnstalleerde apps | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | TTS-servicequery geen inventarisupload. Bevestigd bronroute; transitieve controle blijft nodig. |
| App-activiteit / Andere content van websitegebruikers | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen notities/publicaties; enige vrije invoer is lokale naam, afzonderlijk bovenaan. Bevestigd. |
| App-activiteit / Andere acties | Open — nog niet invullen | Open | Open | Open | Open | Open | Open | Keuzes lokaal; bij vastgestelde derde-stroom juiste typeafbakening naast App-interacties bepalen. Te verifiëren. |
| Browsen op internet / Browsegeschiedenis | Nee | Nee | Nee | N.v.t. | N.v.t. | N.v.t. | N.v.t. | Geen gecontroleerde WebView/browsergeschiedenis; expliciete privacy-link opent externe browser. Bevestigd bronroute. |
| App-gegevens en -prestaties / Crashlogboeken | Open — nog niet invullen | Open | Open | Open | Open | Open | Open | Geen eigen crashupload; leveranciernevenstromen van finale spraak-/SDK-route nog niet vastgesteld. |
| App-gegevens en -prestaties / Diagnostische gegevens | Open — nog niet invullen | Open | Open | Open | Open | Open | Open | Geen eigen telemetrie; definitieve SDK’s/motor en eerste start controleren. |
| App-gegevens en -prestaties / Andere app-prestatiegegevens | Open — nog niet invullen | Open | Open | Open | Open | Open | Open | Geen eigen meetdienst; onbekende nevenstromen niet op Nee of Ja zetten. |
| Apparaat- of andere ID’s / Apparaat- of andere ID’s | Open — nog niet invullen | Open | Open | Open | Open | Open | Open | Geen eigen AD_ID/push/installatie-ID; definitieve SDK-/motorscope verifiëren. |

### E3. Gebruik en verwerking van de open typen

Er is nog geen definitief geselecteerd gegevenstype. Onderstaande vertakkingen worden alleen overgenomen als een werkelijke relevante stroom is vastgesteld. Bij een aantoonbaar volledig lokale eindroute en geldige uitsluiting kunnen de betreffende E2-typen Nee worden en verschijnen deze velden niet. De uitsluiting volgt uit gedrag en Googles criteria, niet alleen uit het woord “offline”.

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Naam / Verzameld | Open — nog niet invullen. Ja indien naam het apparaat relevant verlaat; Nee bij bewezen uitsluitend lokale verwerking. | Blokkeert indienen | Naam staat lokaal; App.tsx:109 gebruikt voor spraak vaste Avonturier. Eindartefact moet dit behouden. | Werkelijke payload, native motor en finale build controleren. |
| Naam / Gedeeld | Open — nog niet invullen. Ja bij aangifteplichtige derde-overdracht; Nee alleen bij geen stroom of bewezen uitzondering. | Blokkeert indienen | TTS-motor is afzonderlijke dienst; [definities](https://support.google.com/googleplay/android-developer/answer/10787469?hl=nl) | Ook inter-app-overdracht onderzoeken; geen dienstverlenerstatus aannemen. |
| Naam / Kortstondig verwerkt | Open — nog niet invullen. Ja alleen uitsluitend geheugen voor realtimeverzoek; Nee zodra een relevante stroom bewaart. | Te verifiëren | Geen providerlog-/cache-/retentiebewijs. | Bijbehorende logs, queues, backup en profiling controleren. |
| Naam / Vereist of optioneel | Open — nog niet invullen. Optioneel alleen als gebruiker de verzameling echt kan vermijden en zonder kan lezen. | Te verifiëren | Voorlezen optioneel bedoeld; late motorinitialisatie is bronmatig aanwezig, toestelgedrag nog te testen. | Eerste start zonder tik en geweigerde/ontbrekende stem controleren. |
| Naam / Doelen verzameld | Alleen bij bevestigde stroom: App-functionaliteit; Personalisatie uitsluitend als naam werkelijk voor persoonlijk voorlezen wordt verwerkt. | Te verifiëren | App.tsx:109 geeft de echte profielnaam niet aan de motor door. | Analyse, marketing, ontwikkelaarberichten, accountbeheer en fraude uit laten zonder bewijs. |
| Naam / Doelen gedeeld | Open — nog niet invullen. Alleen doelen van werkelijk aangifteplichtige deling; bij Gedeeld=Nee N.v.t. | Te verifiëren | Ontvanger/eigen doeleinden onbekend. | Niet automatisch doelen van verzameling kopiëren. |
| App-interacties / Andere acties: verzameld en gedeeld | Open — nog niet invullen. Beoordeel gesproken gekozen verhaalpad; selecteer uitsluitend het passende type bij relevante derdeverwerking. | Te verifiëren | Geen eventupload; tekst kan een gekozen tak weergeven. | Geen dubbele aangifte zonder onderscheiden gegevensstromen. |
| App-interacties / Andere acties: kortstondig en keuze | Open — nog niet invullen; per vastgestelde stroom geheugen/opslag en echte keuzevrijheid bepalen. | Te verifiëren | Lokale database bewaart route; eventuele ontvanger onbekend. | Niet lokale bewaartermijn verwarren met externe verwerking. |
| App-interacties / Andere acties: doelen | Bij bewezen voorleesstroom alleen App-functionaliteit; overige doelen afzonderlijk onderbouwen. | Te verifiëren | Geen analytics/marketing in eigen bron. | Verzameld en gedeeld afzonderlijk invullen. |
| Geschatte locatie / apparaat-ID’s | Open — nog niet invullen. Niet uit alleen IP-connectiviteit of motoraanwezigheid een feit afleiden. | Te verifiëren | Geen eigen locatie-/ID-feature. | Werkelijke provider/configuratie, doelen, retentie, keuze en verwijdering nodig als stroom bestaat. |
| Crash / diagnose / prestatiegegevens | Open — nog niet invullen. Voor ieder bevestigd type Verzameld/Gedeeld/Kortstondig/Keuze/Doelen apart invullen. | Te verifiëren | Geen eigen SDK-upload aangetroffen. | SDK-versie, standaardcollectie en payload inspecteren; gebruikersinvoer/IDs in logs meenemen. |
| Dienstverlener-uitzondering | Open — nog niet invullen. Alleen toepassen bij verwerking uitsluitend namens ontwikkelaar onder passende afspraken. | Te verifiëren | Geen providerafspraak vastgesteld. | Ontvanger en eigen doeleinden vastleggen. |
| Specifieke gebruikersactie / toestemming | Open — nog niet invullen. Een tik op voorlezen bewijst geen geïnformeerde toestemming voor cloudverwerking. | Te verifiëren | Generieke tekst en offline route bedoeld. | Alleen toepasselijke criteria met feitelijk UI-bewijs gebruiken. |
| Wettelijke verstrekking / volledige anonimisering | N.v.t. zolang geen concrete stroom bestaat; niet als algemene uitvlucht selecteren. | N.v.t. | Geen dergelijke feature of aangetoonde keten. | Verwijderde naam maakt overige identifiers niet vanzelf anoniem. |
| Aggregeren meerdere stromen | Alle relevante versies, groepen en regio’s van dit pakket meenemen; een bewaarde stroom verhindert “alles kortstondig”. | Te verifiëren | Productievariant bronmatig begrensd; ondersteunde motoren en werkelijk gedrag nog te toetsen. | Alle ondersteunde routes controleren. |
| Retentie en verwijdering | Lokale gegevens tot volledig wissen; voor eventuele externe kopieën Open — nog niet invullen. | Te verifiëren | [Opslag](/home/codex/repos/fabelpad/mobile/src/storage.ts) | Lokale reset verwijdert geen onbewezen providerkopie. |

### E4. Bewijsbijlage gegevensstromen

| Type → feature | Bron → bestemming/verwerker | Doel | Opslag / bewaartermijn | Verwijdering / status |
| --- | --- | --- | --- | --- |
| Naam/bijnaam → profiel | App profielinvoer → eigen AsyncStorage-database | Lokale personalisatie | Tot wissen; AsyncStorage zelf biedt geen database-encryptie | Ouders → Alle gegevens op dit apparaat wissen → Wissen; releasegedrag testen |
| Lokale profiel-ID → profielscheiding | App → eigen database | Voortgang en voorkeuren scheiden | Tot wissen; geen serveraccount | Volledige lokale reset |
| Route/favorieten → hervatten/schatkist | Verhaalkeuzes → eigen database | Lezen/hervatten | Tot reset; herstart vervangt specifieke route | Herstart verhaal of alle lokale gegevens wissen |
| Zoekterm → filter | Tekstinvoer → React-geheugen | Lokaal zoeken | Sessie | Query vervangen of sessie beëindigen |
| Leesinstellingen → weergave | Ouders → eigen database | Grotere tekst/rust | Tot reset | Lokale reset |
| Generieke verhaaltekst → voorlezen | [Eigen module](/home/codex/repos/fabelpad/mobile/modules/fabelpad-offline-speech/android/src/main/java/nl/fabelpad/speech/FabelpadOfflineSpeechModule.kt:120) → geselecteerde offline Nederlandse TTS-motor | Optioneel voorlezen | Queue/motorretentie en eventuele eigen telemetrie nog te toetsen | Stop/achtergrond/routewissel testen; geen netwerkfallback of persoonsnaam doorgeven |
| Backup/overdracht | [Android-plugin](/home/codex/repos/fabelpad/mobile/plugins/withFabelpadProduction.cjs:8): allowBackup=false | Lokale privacy | allowBackup=false/cleartext=false in eindmanifest bevestigd; OEM-gedrag nog testen | Geen cloudbackupclaim vóór releasecontrole |
| Privacy-/supportactie | Expliciete gebruikersactie → externe browser/mailclient | Beleid lezen of contact opnemen | Website/mailontvanger volgens echt beleid | Supportretentie/contactkanaal eigenaar nog vaststellen |

**Geen CSV:** niet gevraagd, geen actuele importtemplate/export aangeleverd. Dit Markdown-blad is geen importbestand.

**Afsluiten E:** alle geselecteerde typen volledig invullen, samenvatting en Store-preview controleren, dan pas Opslaan/Versturen volgens het scherm.

## F. Aanvullende verklaringen, rechten en speciale categorieën

Route: App-content en de na AAB-upload werkelijk getoonde taken. Een algemeen formulier met een feitelijk negatieve hoofdkeuze moet worden ingevuld; N.v.t. is voor de niet-toepasselijke vervolgtak. Nieuwe Console-vragen niet verzinnen.

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Advertentie-ID gebruikt? | Nee voor de lokale release. | Bevestigd | Productiemanifest zonder AD_ID, geen ad-/analytics-feature; [advertentie-ID](https://support.google.com/googleplay/android-developer/answer/6048248?hl=nl) | Controleer definitief gemergd manifest op com.google.android.gms.permission.AD_ID en transitieve configuratie. |
| Advertentie-ID / doelen | N.v.t. — verschijnt bij Ja. | N.v.t. | Hoofdkeuze Nee. | Geen marketingdoelen bij afwezig gebruik. |
| Gezondheidsapps / hoofdkeuze | Kies de optie voor geen gezondheidsfuncties; exacte Nederlandse formuliertekst te bevestigen. | Bevestigd | Geen Health Connect, medische/fitness-/onderzoekfunctie; [gezondheidsverklaring](https://support.google.com/googleplay/android-developer/answer/14738291?hl=nl) | Geen therapie-/medische of diagnostische Store-claims toevoegen. |
| Gezondheid / categorieën, apparaten, onderzoek, vergunningen | N.v.t. — verschijnt bij toepasselijke gezondheidsfuncties. | N.v.t. | Grotere tekst en rustigere beweging zijn weergavevoorkeuren. | Heropenen bij echte medische feature. |
| Financiële functies | Mijn app heeft geen financiële functies. | Bevestigd | Geen betalen, krediet, bank, verzekering, trading of crypto; [financiële verklaring](https://support.google.com/googleplay/android-developer/answer/13849271?hl=nl) | Algemene verklaring afronden wanneer getoond. |
| Financiële landen / licenties / documenten | N.v.t. — verschijnt bij financiële functies. | N.v.t. | Geen betreffende feature. | Eventuele gewone appaankopen afzonderlijk bij G beoordelen. |
| Overheidsapp / uitgegeven namens overheid? | Open — nog niet invullen. Bij bevestigde onafhankelijke uitgave: Nee. | Te verifiëren | Displaynaam DG Webservices bewijst geen juridische relatie; [overheidsbeleid](https://support.google.com/googleplay/android-developer/answer/9514050?hl=nl) | Eigenaar bevestigt eventuele overheidsrelatie. |
| Overheidsinformatie | Nee. | Bevestigd | Uitsluitend fictieverhalen, geen publieke-informatievoorziening. | Bron-/bestuursniveau-/toestemmingvelden N.v.t. wanneer tak niet van toepassing is. |
| Nieuws / tijdschriften | Nee. | Bevestigd | Geen nieuwsfeed/redactionele actualiteit; [nieuwsverklaring](https://support.google.com/googleplay/android-developer/answer/10523915?hl=nl) | Uitgever-/frequentietak N.v.t. |
| UGC / publieke gebruikerscontent | Nee. | Bevestigd | Lokale naam, geen publieke posts of uploads. | Geen communitymoderatie claimen. |
| Chat / sociaal / dating / matchmaking | Nee. | Bevestigd | Geen communicatie of koppelservice. | Sociale/relationship-takken N.v.t. |
| Sociale kindveiligheid / CSAE / meldcontact | N.v.t. — bijzondere tak voor toepasselijke sociale/datingfuncties. | N.v.t. | [Kindveiligheidsnormen](https://support.google.com/googleplay/android-developer/answer/14747720?hl=nl) | Algemene Familiesplicht blijft wel gelden. |
| Generatieve AI-functie in app | Nee. | Bevestigd | Geen runtimegenerator of model-API; vaste gebundelde verhalen. | Vooraf gemaakte illustraties zijn geen in-app generator. |
| AI-rapportage / synthetische-media-tak | N.v.t. bij uitsluitend vaste content voor deze generatieve-AI-tak. | N.v.t. | [AI-beleid](https://support.google.com/googleplay/android-developer/answer/14094294?hl=nl) | Contentrechten en regionale regels blijven afzonderlijk te verifiëren. |
| Echtgeldgokken / loterij / geldprijzen | Nee. | Bevestigd | Geen inzet, betalingen of prijscompetitie. | Licentie-/landtak N.v.t. |
| Goksimulatie / lootboxes | Nee voor de mechanieken. | Bevestigd | Verhaalkeuze en vaste herinnering zijn geen betaalde kansitems. | Verhaalinhoud apart IARC D. |
| Achtergrond-/precieze locatie | Nee — geen kernfunctie of recht. | Bevestigd | Geïnspecteerde native bron/manifest; [rechtenbeleid](https://support.google.com/googleplay/android-developer/answer/9214102?hl=nl) | Definitieve AAB controleren. |
| SMS / gesprekslijst / contacten | Nee. | Bevestigd | Geen gebruik/permissions. | Specifieke declaraties N.v.t. |
| Brede foto-/videotoegang | Nee. | Bevestigd | Geen picker, camera of mediafeature. | READ_MEDIA_IMAGES/VIDEO en oudere opslagrechten in finale manifest controleren. |
| Alle-bestandentoegang | Nee. | Bevestigd | Geen MANAGE_EXTERNAL_STORAGE of bestandsbeheerfunctie. | Geen bestandsbeheerverklaring invullen. |
| Oude READ/WRITE_EXTERNAL_STORAGE | Nee — beide ontbreken in het gecontroleerde productie-AAB. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Bij toekomstige SDK-update opnieuw controleren. |
| SYSTEM_ALERT_WINDOW / overlays | Nee — ontbreekt in het gecontroleerde productie-AAB. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Geen overlayverklaring nodig voor deze variant. |
| Geïnstalleerde pakketten / QUERY_ALL_PACKAGES | Nee voor brede zichtbaarheid. | Bevestigd | Beperkte TTS-servicequery is geen brede appinventaris. | Geen QUERY_ALL_PACKAGES in finale manifest accepteren zonder nieuwe scope. |
| AccessibilityService / VpnService | Nee. | Bevestigd | Geen betreffende service. | Gewone toegankelijkheidslabels zijn geen AccessibilityService. |
| Pakketten installeren | Nee. | Bevestigd | Geen REQUEST_INSTALL_PACKAGES-feature. | Vervolgtak N.v.t. |
| Exacte alarmen | Nee. | Bevestigd | Geen alarmfunctie of recht. | Vervolgtak N.v.t. |
| Foreground service / types | Nee voor deze app. | Bevestigd | Geen gedeclareerde FGS-functionaliteit. | Voorleesknop is op zichzelf geen FGS; finale manifest controleren. |
| Full-screen intents | Nee. | Bevestigd | Geen inkomende oproep-/alarmflow. | Vervolgtak N.v.t. |
| Biometrie | Nee — geen gebruik en beide biometriepermissions ontbreken in het productie-AAB. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Geen biometrische login of gegevenscollectie claimen. |
| INTERNET / cleartext / backup | INTERNET ontbreekt; allowBackup=false en usesCleartextTraffic=false in het gecontroleerde productie-AAB. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | TTS-motor draait apart; eigen INTERNET-blokkade bewijst niet diens volledige gedrag. |
| Lokale-netwerktoegang | Nee voor de feature. | Bevestigd | Geen LAN-discovery/apparaatkoppeling. | Nieuwe API-/beleidstak alleen als werkelijk van toepassing; [tijdlijn](https://developer.android.com/distribute/play-policies) |
| Gezondheidsrechten | Nee. | Bevestigd | Geen health APIs/permissions. | Vervolgtak N.v.t. |
| Nieuwe taken / benodigde bewijs- of video-URL | Open — nog niet invullen zolang geen werkelijk formulier verschijnt. | Te verifiëren | Geen AAB-/Console-waarschuwingen. | Alleen getoonde extra taak en exacte kernfunctie beoordelen; geen fictieve demo/video-URL. |

**Afsluiten F:** Opslaan/Indienen per daadwerkelijk getoonde verklaring; na AAB-upload opnieuw App-content en Beleidsstatus controleren.

## G. Distributie, build, tests en productietoegang

### G1. Aanbod en landen

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Releaseproduct / doelgroep apparaten | Volledige lokale Fabelpad-release voor telefoons en geteste 8-/10-inch-tablets. | Bevestigd | Eigenaar: geen accounts of abonnementen, gratis eerste productie. | Geen demodistributie als eindproduct gebruiken. |
| Eindtrack | Productie. Interne/gesloten tracks gebruiken voor noodzakelijke acceptatie van dezelfde productvariant. | Bevestigd | Expliciete gebruikersopdracht. | Accounttestgate bepaalt de volgorde; geen testgate omzeilen. |
| Landen productie | Open — nog niet invullen. Voorstel Nederland; België alleen na besluit. | Te verifiëren | Taal is geen landautorisatie; [landen](https://support.google.com/googleplay/android-developer/answer/7550024?hl=en) | Exacte landen en ondersteuning bevestigen. |
| Landen gesloten/open | Open — nog niet invullen; bedoelde testlanden kiezen en synchronisatie controleren. | Te verifiëren | Zelfde bron. | Niet onbedoeld productielanden aanpassen. |
| Landen interne test | N.v.t. — interne test kent deze landtargeting niet. | N.v.t. | Zelfde bron. | Compatibiliteit en testerstatus blijven relevant. |
| Publiek / onvermeld / Managed Google Play | Voorstel publiek via productie; geen zakelijke privédistributie. | Voorstel | Consumentenverhalenapp. | Exact beschikbare distributiekeuze in Console bevestigen. |
| Telefoon / tablet / andere vormfactoren | Telefoon en geteste tablets; TV, Wear, Auto en XR niet toevoegen. Chromebook eerst testen. | Voorstel | Native touch-UI en tabletindeling. | Device Catalog na upload controleren. |
| Downloadprijs / valuta | Gratis/kosteloos; prijs en valuta N.v.t. | Bevestigd | Expliciete eigenaarskeuze; [prijzen](https://support.google.com/googleplay/android-developer/answer/6334373?hl=en) | Gratis kan voor hetzelfde pakket later niet betaald worden. |
| In-app aankopen / abonnementen | Nee. | Bevestigd | Expliciete lokale scope, geen Billing. | Geen product-ID’s of abonnementen aanmaken. |
| Merchant-/belastingprofiel / basisplannen | N.v.t. voor dit gratis aanbod zonder aankopen. | N.v.t. | [Betalingsbeleid](https://support.google.com/googleplay/android-developer/answer/10281818?hl=nl) | Bij echte toekomstige monetisatie afzonderlijk inrichten. |
| Alternatieve betaling / externe betaallinks | Nee — geen aanbod of betaalverwijzing toevoegen. | Bevestigd | Geen betaalfeature. | Bij wijziging landspecifiek programma/beleid toetsen. |
| Licenties / lokale vereisten | Open — nog niet als wereldwijd afgedekt verklaren. | Te verifiëren | Geen bevestigde content-/merklicenties of landenlijst. | Rechten en gekozen landen bevestigen. |
| Games op pc | N.v.t. — App gekozen, geen Game. | N.v.t. | Kern leesapp. | Geen pc-gamekanaal toevoegen. |

### G2. Exacte productiebuild

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| applicationId | nl.fabelpad.app. | Bevestigd | Expliciet door eigenaar bevestigd op 18-11-2026. | Exact match in config, AAB, Console, signing en automation. |
| Releasevariant / label | production / release; label Fabelpad. | Bevestigd | Gewenste configuratie; [config](/home/codex/repos/fabelpad/mobile/app.config.ts) | Werkelijk gegenereerde variant en launcherlabel controleren. |
| versionName | 1.0.0. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Match release in Console. |
| versionCode | 1 uitsluitend als voor dit pakket nog ongebruikt; anders hoogste gebruikte code verhogen. | Te verifiëren | Play-historie onbekend. | Eén keer geüpload betekent code niet opnieuw gebruiken. |
| Release-AAB / bestandsnaam | [fabelpad-production.aab](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.aab) — 37.005.584 bytes; SHA-256 ffc22ec85449074a667a243dc132dfa46e9a484c756dc57c859433ba68ba6e1c. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Gebruik exact dit ondertekende bestand voor de eerste upload na account-/beleidscontrole. |
| Volledige SHA / tag | 8dcb98c4287dc78421b092ee395ace05f492baaa; buildstart had een schone werkboom. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Dit is de artefactbron, geen claim van Android-CI of Google-goedkeuring. |
| Signing-configuratie | Eigen uploadsleutel; ondertekende AAB. Uploadcertificaat SHA-256 3598b0e2d3d6d7d5127110970352733e79e3f122f1bb60161704af2e421887de. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Privésleutel en wachtwoorden buiten Git; afgeschermde backup gecontroleerd. |
| Play App Signing | Standaard door Google gemaakte app-signing key gebruiken; eigen uploadsleutel blijft afzonderlijk. | Voorstel | [Play Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=nl) | Eigenaar beoordeelt voorwaarden bij eerste upload. |
| “Bestand voor ondertekening” | De uploadkey-ondertekende productie-AAB is het release-uploadbestand. Geen privé-JKS uploaden. | Bevestigd | Zelfde signingbronnen; runbook. | Openbaar PEM-certificaat alleen waar Console erom vraagt; PEPK alleen bij bewuste eigen app-signing-keyoverdracht. |
| minSdk / targetSdk / compileSdk | 24 / 36 / 37. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Target36 voldoet aan huidige ondergrens; deadlines bij latere release hercontroleren. |
| 64-bits ABI’s | arm64-v8a en x86_64. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Werkelijke apparaatondersteuning in Device Catalog en op toestel controleren. |
| 16-KB-native libraries | 44 native .so-bestanden; alle relevante ELF-loadsegmenten op 16 KB gecontroleerd. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Elke nieuwe build opnieuw inspecteren; runtime blijft aparte test. |
| Bundle / gegenereerde APK-uitlijning | Bundle valide, PAGE_ALIGNMENT_16K; universele APK heeft geldige signature en 16-KB-ZIP-uitlijning. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Dit bewijst statische compatibiliteit, geen succesvolle 16-KB-toestelrun. |
| 16-KB-runtime | Nog niet getest. | Te verifiëren | Geen toestel-/emulatorbewijs. | adb shell getconf PAGE_SIZE = 16384 en echte start/flow testen. |
| Directe/transitieve SDK’s | Gebouwd met Expo58.0.26, React Native0.88.1, AsyncStorage2.2.0; eigen offline-TTS-module. Node24.18.0, Gradle9.4.1, Build Tools37.0.0, NDK27.1.12297006. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1); gecommitte mobiele lockfile. | Versiegebonden SDK Index-/Play-waarschuwingen na upload controleren. |
| SDK Index / versiegebonden waarschuwingen | Open — nog niet als vrij van waarschuwingen verklaren. | Te verifiëren | [SDK Index](https://developer.android.com/distribute/sdk-index) is geen bewijs dat iedere versie is beoordeeld. | AAB-upload en werkelijke versie-/configuratiewaarschuwingen controleren. |
| OTA / WebView / backend | Geen actieve eigen OTA, WebView of backendroute in het lokale product. | Bevestigd | Native bron; transitive library is geen bereikbare functie. | Definitieve config en runtime opnieuw controleren. |
| App Links / OAuth / signingcertificaat | N.v.t. voor de accountvrije release zonder geverifieerde App Links. | N.v.t. | Geen OAuth-flow. | Later eventueel Play-appsigningfingerprint registreren, niet upload/debugfingerprint verwarren. |
| Symbolen / mapping | R8-mapping beschikbaar: [fabelpad-production-mapping.txt](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production-mapping.txt); DEX 4.760.040 bytes (~4,54 MiB). | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Alleen bij deze SHA/AAB horende mapping gebruiken; native symbolen indien Console vraagt afzonderlijk toevoegen. |
| Omvang / Device Catalog | AAB 37.005.584 bytes; universele uploadkey-APK 51.857.216 bytes. Play-downloadgrootte en Device Catalog nog onbekend. | Te verifiëren | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Universele APK is voor toesteltest; Google ondertekent eigen distributie-APK’s. |
| Bouwcapaciteit | Circa 49 GiB vrij op ontwikkelhost bij controle 18-11-2026; geen actuele ruimteblokkade vastgesteld. | Bevestigd | Read-only hostcontrole; nieuwe build blijft afzonderlijk resultaat. | Buildlocks en begrensd resourcegebruik respecteren. |
| Werkelijk geslaagde productiechecks | TypeScript, runtimecontracten, Expo-config, Kotlin/Gradle-productiebuild, AAB/signing, manifest, 44 ELF-libraries en 16-KB-bundle/APK-checks geslaagd. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1); productiebuildverslag. | Geen fysieke/emulated Android-runtime, geen Play-upload; Android-CI-resultaat nog niet als groen bevestigd. |

De eigen uploadcertificaat-SHA-256 is **3598b0e2d3d6d7d5127110970352733e79e3f122f1bb60161704af2e421887de**. Dit is openbare certificaatmetadata, niet de privé-uploadsleutel. Google Play levert later met zijn eigen app-signing key ondertekende APK’s; de lokale universele APK is met de uploadkey getekend.

R8 is toegepast: **4.760.040 ongecomprimeerde DEX-bytes** (circa 4,54 MiB). Bijbehorend bestand: [fabelpad-production-mapping.txt](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production-mapping.txt). Bundletool 1.18.3 valideerde de bundle; PAGE_ALIGNMENT_16K is aangevraagd en de gegenereerde universele APK doorstond signature- en 16-KB-ZIP-controle. Dit zijn statische controles, geen toesteltest. Web-CI is geslaagd; Android-CI is nog niet als geslaagd bevestigd.

### G3. Bouw- en inspectiestappen

De exacte uitvoerbare signing-/buildopdrachten en secretbronnen staan in het [release-runbook](/home/codex/repos/fabelpad/docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md). Wachtwoorden of JSON-sleutels horen niet in commando-argumenten, rapporten of logs.

De native implementatieagent meldt TypeScript-, runtimecontract- en Expo-configcontroles geslaagd. Deze checks moeten bij de release-SHA blijven horen; native compilatie, signing en toestelgedrag zijn afzonderlijke resultaten. De reproduceerbare controles zijn:

~~~bash
cd /home/codex/repos/fabelpad/mobile
npm ci
npm run check
npm run test:runtime
~~~

Na het bouwen van het daadwerkelijk vastgelegde releasebestand:

~~~bash
# Gebruik alleen geverifieerde tool- en artefactpaden uit het releaseverslag.
sha256sum "$RELEASE_AAB"
java -jar "$BUNDLETOOL_JAR" validate --bundle="$RELEASE_AAB"
java -jar "$BUNDLETOOL_JAR" dump manifest --bundle="$RELEASE_AAB" --module=base
java -jar "$BUNDLETOOL_JAR" dump config --bundle="$RELEASE_AAB"
adb shell getconf PAGE_SIZE
~~~

Uitgevoerd: productie-AAB-build en genoemde statische artefactcontroles. Niet uitgevoerd: Android-toestelinstallatie/runtime, Play-upload, pre-launch report of Google-goedkeuring. Een TypeScript-check bewijst geen native compilatie, runtime of policyconformiteit.

### G4. Tests, accountgate en eventuele productieaanvraag

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Eerste upload | Interne test → Nieuwe release maken → productie-AAB uploaden; releasevariant blijft productie. | Voorstel | [Release-instructie](https://support.google.com/googleplay/android-developer/answer/9859348?hl=nl) | Eerste upload en verplichte bevestigingen in Console, daarna API-route. |
| Intern testen | Kleine acceptatiegroep, maximaal 100 testers. | Voorstel | Officiële release-instructie. | Werkelijke testrelease en opt-in-link nog ontbreken. |
| Gesloten test | Na eerste technische acceptatie; verplicht indien accountgate geldt. | Te verifiëren | [Testgate](https://support.google.com/googleplay/android-developer/answer/14151465?hl=nl) | Accounttype/datum en actuele Console-status bepalen. |
| 12 testers / 14 dagen | Open — nog niet als voldaan invullen. Alleen toepasselijke persoonlijke accounttak. | Blokkeert indienen | Accounttype onbekend; displaynaam DG Webservices bewijst geen Organisatie. | Echte kwalificerende deelname en productieaanvraag nodig indien van toepassing. |
| Eerste aanvraagdatum | Open — nog niet invullen. Twaalfde blijvend kwalificerende opt-in +14 etmalen, daarna aanvraag/review. | Te verifiëren | Geen echte opt-indata. | Geen datum of uitkomst garanderen. |
| Intern naar gesloten | Controleer dat testers die gesloten moeten meetellen de interne test verlaten en de juiste gesloten opt-in gebruiken. | Te verifiëren | [Testtracks](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en) | Werkelijke deelname in Console controleren. |
| Open test | Optioneel; bij nieuw persoonlijk account pas na productieautorisatie. | Te verifiëren | Testgatebron. | Geen open test nodig om een fictieve wachttijd te omzeilen. |
| Opt-in / feedback | Open — nog niet invullen voor link. Feedbackkanaalvoorstel support@fabelpad.nl. | Voorstel | Supportadres bevestigd; tracklink ontbreekt. | Geen URL met onbekende track construeren of testeridentiteiten in rapport opnemen. |
| Pre-launch report / crashes / ANR | Open — nog geen rapport. | Te verifiëren | Geen upload. | Stabiliteit, schermen, accessibility- en veiligheidsbevindingen beoordelen. |
| Productieaanvraag verschijnt | Alleen bij daadwerkelijk getoonde aanvraag; Formuliertekst te bevestigen. | Te verifiëren | Geen aanvraagformulier beschikbaar. | Alleen dat scherm met persoonsgegevens afgeschermd nodig. |
| Werving / wervingsgemak | Open — nog niet invullen. | Te verifiëren | Geen echte wervingsresultaten. | Werkelijke opties en methode/aantallen gebruiken. |
| Betrokkenheid / scenario- en apparaatdekking | Open — nog niet invullen. | Te verifiëren | Nog geen gesloten-testverslag. | Werkelijke testperiode/gebruik en dekking vastleggen. |
| Feedback / methode / doorgevoerde wijzigingen | Open — nog niet invullen. | Te verifiëren | Geen echte feedback. | Zakelijk samenvatten zonder testeridentiteiten. |
| Doelgroep / waarde | Concept: Fabelpad biedt geïllustreerde keuzeverhalen met afzonderlijke lokale profielen en leesvoortgang, zonder online account. | Voorstel | Native functies; definitieve leeftijdsgroep nog open. | Aan exacte aanvraagvraag en echte doelgroep aanpassen. |
| Verwachte installaties eerste jaar | Open — nog niet invullen. | Te verifiëren | Eigenaarprognose, geen bedrijfsgegevens. | Getoonde bereikopties en onderbouwde schatting nodig. |
| Productierijp / bewijs | Open — nog niet als volledige productierijpheid invullen. Technische productie-AAB geslaagd; apparaat-, privacy-/content- en eventuele gesloten-testacceptatie staan open. | Blokkeert indienen | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Geen verzonnen gebruikerstests of tevredenheid claimen. |

### G5. Acceptatieplan met synthetische gegevens

| Scenario | Exacte controle | Status / evidence |
| --- | --- | --- |
| Eerste start | Schone installatie; Avonturier; geen login/paywall; geen onverwachte rechtenvraag of vroege TTS-init | Toesteltest open |
| Alle verhalen | Dertien verhalen openen; zoeken/favorieten/hervatten; vijf delen en juiste herinnering | Contracttests plus werkelijke UI nodig |
| Station | Ticket/sterrensticker en sleutelroute; instappen; beide wissels; dubbele tik; rustige beweging | Native touch-/animatietest open |
| Profielen | Testster/Testmaan; aparte favorieten/routes; wisselen; force-stop/heropenen | Opslag op finale release open |
| Voorlezen offline | Geïnstalleerde lokale Nederlandse stem; vliegtuigstand; alleen netwerkstem beschikbaar; geen stem; geen download/netwerkfallback | Eigen module, motorcontrole en runtimebewijs nodig |
| Persoonsnaam | Synthetische unieke naam op scherm; vaststellen dat spraakpayload generiek blijft | Native payload-/runtimecontrole open |
| Spraaklevenscyclus | Stop; achtergrond; scherm-/profiel-/routewissel; opnieuw starten | Geen doorlopende audio of vroege enginebinding |
| Wissen | Totale reset bevestigen; force-stop; heropenen; lege lokale voortgang; backup/overdracht testen | Knop bronmatig aanwezig; duurzame verwijdering en Android-regels testen |
| Leesinstellingen | Apptekst en grote systeemtekst; TalkBack; contrast; toetsenbord; rotatie; kleine/grote displays | Geen toegankelijkheidsbadge zonder test |
| Privacy/support | Werkelijke HTTPS-pagina zonder login; juiste app/uitgever; mailactie; terugkeer naar app | Publieke bereikbaarheid nog niet bevestigd |
| Compatibiliteit | ARM64-telefoon; fysieke/emulated 8-/10-inch; ondersteunde minimum/current API; 16-KB-start | Device Catalog en apparaatbewijs open |
| Stabiliteit | Play pre-launch report, crashes/ANR, geheugen, lage opslag, fout- en herstelroutes | Geen “0 crashes”-claim zonder meting |

**Afsluiten G:** noodzakelijke tests en accountgate werkelijk afronden. Automatische releases publiceren geen ongeteste eerste versie en laten geen testperiode fictief verlopen.

## H. Release maken, beoordeling en publicatiecontrole

| Scherm / veld of vraag | Exact invullen of aanklikken | Status | App-bewijs / officiële bron | Vervolgactie |
| --- | --- | --- | --- | --- |
| Gewenste track | Eerste technische upload via Interne test; uiteindelijke vrijgave via Testen en releasen → Productie. | Bevestigd | Productieopdracht eigenaar; [release](https://support.google.com/googleplay/android-developer/answer/9859348?hl=nl) | Accountgate en acceptatie eerst. |
| Nieuwe release maken | Maak na account-/Dashboardcontrole de eerste interne testrelease met het beschikbare productie-AAB. | Voorstel | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1); release-runbook. | Account-/beleids- en bereikbaarheidspunten eerst controleren. |
| Play App Signing / voorwaarden | Google-standaard kiezen; uploadcertificaat en app-signingcertificaat onderscheiden. | Voorstel | [Play Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=nl) | Eigenaar bevestigt juridische voorwaarden. |
| Appbundle toevoegen | [fabelpad-production.aab](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.aab); controleer hash ffc22ec85449074a667a243dc132dfa46e9a484c756dc57c859433ba68ba6e1c vóór upload. | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Nog niet naar Play geüpload; gebruiker voert eerste Console-bootstrap uit. |
| Symbolen / mapping | R8-mapping beschikbaar: [fabelpad-production-mapping.txt](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production-mapping.txt); DEX 4.760.040 bytes (~4,54 MiB). | Bevestigd | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Alleen bij deze SHA/AAB horende mapping gebruiken; native symbolen indien Console vraagt afzonderlijk toevoegen. |
| Interne releasenaam | Fabelpad 1.0.0 (1) — productie, mits versie/code bevestigd. | Voorstel | Alleen Console-naam, niet publieke naam. | Bij hoger versionCode aanpassen. |
| Releaseopmerkingen | Kopieer H1; locale nl-NL. | Voorstel | Limiet 500 Unicode-tekens per taal; telling hieronder. | Alleen getoonde locale-tags gebruiken. |
| Landen / apparaten | Open — nog niet afronden voor productie. | Te verifiëren | Landen en Device Catalog nog open. | G1-besluit en compatibiliteit controleren. |
| Waarschuwingen / fouten | Lokale AAB-controles geslaagd; Console-/SDK-waarschuwingen na de eerste upload nog onbekend. | Te verifiëren | [buildmanifest](/home/codex/repos/fabelpad/artifacts/native/fabelpad-production.json:1) | Echte Play-fouten oplossen en waarschuwingen inhoudelijk beoordelen. |
| Opslaan als concept / Volgende | Gebruik om gecontroleerde release voor te bereiden; dit is geen review of beschikbaarheid. | Bevestigd | Officiële release-instructie. | Alle A–G-open punten blijven zichtbaar. |
| Releasecontrole | Eerst app-content, testgate, AAB en reviewerstoegang afronden. | Blokkeert indienen | Dit blad bevat nog verplichte open feiten. | Niet “gereed” verklaren op basis van een ingevuld plan. |
| Eerste productie / gefaseerd percentage | N.v.t. — eerste productierelease heeft geen gefaseerd uitrolpercentage. | N.v.t. | Release-instructie. | Na werkelijke publicatie kunnen geschikte gebruikers in alle gekozen landen de app krijgen. |
| Beheerd publiceren | Niet als beschikbaar aannemen bij eerste app-publicatie. Na eerdere publicatie, bijvoorbeeld gesloten test, feitelijk controleren. | Te verifiëren | [Beheerd publiceren](https://support.google.com/googleplay/android-developer/answer/9859654?hl=nl) | Eerste release niet als gegarandeerd handmatig vastgehouden voorstellen. |
| Publicatieoverzicht / Versturen voor beoordeling | Controleer alle wijzigingen; pas bij echte gereedheid verzenden. | Te verifiëren | Zelfde bron. | Concept, ingestuurd, goedgekeurd en beschikbaar zijn afzonderlijke statussen. |
| App-content / Beleidsstatus na indiening | Volg de getoonde taak of afwijzing; pas de echte oorzaak aan. | Te verifiëren | Geen huidige beoordeling. | Geen Google-goedkeuring beloven. |
| Automatische vervolgreleases | Voorbereide route in release-runbook; alleen juiste pakket, geverifieerde bron en veilige signing/API-toegang. | Te verifiëren | [API-start](https://developers.google.com/android-publisher/getting_started), [Edits](https://developers.google.com/android-publisher/edits/) | Eerste upload/juridische bootstrap in Console; credentials en rechten nog in te richten. |
| API-reviewbescherming | Laat een lopende beoordeling niet standaard annuleren; gebruik ERROR_IF_IN_REVIEW wanneer committen. | Voorstel | [edits.commit](https://developers.google.com/android-publisher/api-ref/rest/v3/edits/commit) | Bestaande review en Console-edits controleren; alleen expliciet bedoelde release publiceren. |

### H1. Releaseopmerkingen — Nederlands

Voorstel eerste productierelease; **261/500 Unicode-tekens**. Tags zelf tellen niet mee. Pas aan als een genoemde functie de acceptatie niet haalt.

~~~text
<nl-NL>
Ontdek 13 geïllustreerde verhalen en kies telkens je eigen pad. Speel mee in Het Verdwaalde Station, bewaar favorieten en verzamel herinneringen in je schatkist. Gebruik lokale kindprofielen en kies grotere verhaaltekst of rustige bewegingen in het ouderhoekje.
</nl-NL>
~~~

**Afsluiten H:** Publicatieoverzicht → exacte wijziging controleren → Versturen voor beoordeling, uitsluitend na afronding van de toepasselijke open stappen. Na goedkeuring de werkelijke beschikbaarheid en publicatiestatus controleren. Voor latere releases de uitgevoerde CI-/API-run en Play-releasegegevens bewaren.

## Laatste controle vóór overnemen

Controleer Store-vermelding en beelden tegen de daadwerkelijke UI; privacy en werkelijke lokale wisroute; definitieve Gegevensveiligheid-preview; leeftijd/Families en advertenties afzonderlijk; officiële IARC-uitkomst; vrije reviewerstoegang; exact pakket/AAB/SHA/signing; 16-KB-/apparaat-/SDK-controles; accountverificatie, eventuele testgate en gekozen landen. De status blijft **Open punten vóór indienen** totdat deze feiten en controles zijn afgerond. De ondertekende productie-AAB is beschikbaar en statisch gecontroleerd; er is nog geen Google-goedkeuring of Android-toestelacceptatie.

## Officiële bronnen en controledatum

De hierboven gekoppelde relevante Google Help-/Android-/API-pagina’s zijn voor dit productieblad geraadpleegd op 18-11-2026. Niet-ingelogde bronnen kunnen de exacte vertakte Console-tekst niet bevestigen. De [App Store Review API](https://developers.google.com/android-publisher/app-store-review/policy-declarations) is aanvullende documentatie en geen bewijs dat een onbekende vraag letterlijk in dit Console-formulier verschijnt. Bij latere publicatiedatum deadlines opnieuw controleren.

Het [release-runbook](/home/codex/repos/fabelpad/docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md) bevat de concrete Google Cloud-/Play-rechten, signing- en bouwstappen en de nog in te richten geheimbronnen. De productie-AAB is geslaagd; publieke privacybereikbaarheid, deviceacceptatie en API-toegang blijven afzonderlijke open resultaten.

## Alleen nog open vragen voor de eigenaar

1. Welk accounttype heeft het Play-account met displaynaam DG Webservices: Persoonlijk of Organisatie, wat is de aanmaakdatum en is productietoegang/verificatie actief? Zijn er voor nl.fabelpad.app al andere versionCodes geüpload?
2. Welke landen en leeftijdsgroepen zijn voor de eerste productierelease bedoeld en wat is het beoogde publicatiemoment? Voorstel: Nederland, Nederlands, 6–8 jaar.
3. Wat is de officiële juridische uitgever/verantwoordelijke, welke handelaarsstatus is bevestigd, bestaat enige overheidsrelatie en zijn content-/merkrechten geregeld? Welke openbare privacy-/voorwaardeninformatie en werkelijke hosting-/mailverwerkers met bewaartermijnen moeten het beleid aanvullen?
4. Hoe wordt https://fabelpad.nl/privacy publiek zonder StackProtect/login beschikbaar gemaakt? De pagina en lokale build zijn gereed; publieke controle geeft nu HTTP 401. Dit is een concrete indieningsblokkade.
5. Alleen wanneer Console extra takken toont: het specifieke Tags beheren-, IARC-angst/ernst-, nieuwe App-content- of AAB-waarschuwingsscherm. Verberg persoonsgegevens; geen volledige accountdump.
6. Alleen indien de persoonlijke-accounttestgate geldt: echte kwalificerende opt-ins en doorloopdatum plus samengevatte testdekking/feedback/wijzigingen; geen testeridentiteiten. De productieaanvraag volgt pas met echte resultaten.
