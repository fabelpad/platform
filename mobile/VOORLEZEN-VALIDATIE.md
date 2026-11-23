# Voorlezen op Android — stagingkandidaat 23 november 2026

De lokale reader en de gekoppelde gezinsreader gebruiken hetzelfde gepubliceerde manifest als web: exacte tekstversie, effectieve leeslaag, stabiel stemslot en presetversie. Alle vijf slots zijn instelbaar. Alleen `voiceSlot` gaat via het bestaande gezinscontract; naammodus, uitspraakselectie en ouderopnamen staan daarbuiten.

## Bouwgrenzen

De gewone lokale productievariant behoudt standaard zijn bestaande offline netwerkgrens. De accountloze stagingproef krijgt uitsluitend met `FABELPAD_AUDIO_ENVIRONMENT=staging` en `FABELPAD_AUDIO_ORIGIN=https://staging.fabelpad.nl` toegang tot publieke audio voor meegeleverde verhalen. De gekoppelde variant gebruikt uitsluitend zijn reeds vastgepinde backendomgeving. De downloader accepteert HTTPS naar die vaste origin, geen redirects of vrij gekozen providerhosts.

`RECORD_AUDIO` is een afzonderlijke capability voor expliciet door een ouder gestarte, lokale opnamen. De toestemming wordt pas bij die handeling gevraagd. Een geweigerde of te laat verleende toestemming opent geen recorder. De recorder stopt en verwijdert een niet opgeslagen opname bij achtergrondgebruik, gesloten instellingen of limietoverschrijding. Er is geen microfoon in de gewone voorleesflow.

Audio en opnamen staan voor **alle** varianten in Android `noBackupFilesDir`. Opnamen hebben alleen onpersoonlijke scope- en cue-ID's in hun paden en geen naammetadata. Ze worden niet geüpload of geëxporteerd. Afgeschermde audio, manifesten en assetmetadata worden aanvullend met de Android Keystore versleuteld. Uitloggen en rechtenintrekking wissen afgeschermde pakketten, sleutels en gekoppelde persoonlijke opnamen; lokale opnamen van de accountloze variant blijven bij uitloggen behouden. Expliciet alle apparaatdata wissen verwijdert ook lokale naamkeuzes, opnamen en publieke pakketten. Alleen een audiopakket verwijderen laat leesvoortgang staan.

## Speler en downloads

De speler stopt bij account-, profiel-, route-, verhaalversie-, leesniveau- of stemwisseling, dempen, Android-audiofocusverlies, headsetonderbreking en appachtergrond. WAV PCM16 mono 24 kHz wordt via Android MediaPlayer afgespeeld, met prebuffer van het volgende fragment. Pauze en hervatten behouden de lopende clip. Keuzezinnen zijn apart te beluisteren; de optionele doorluisterstand begint na een bewuste keuze aan de juiste nieuwe scène. Een ontbrekende gepubliceerde opname biedt uitsluitend de bestaande aantoonbaar lokale Nederlandse apparaatstem met generieke Avonturiertekst; geen apparaatstem betekent verder lezen met een begrijpelijke melding.

Een pakket omvat de gehele geladen tekstgraaf, inclusief oorspronkelijke keuze-indexen, eindes en de **volledige** gedeelde namenbundel van die preset- en pakketversie. De volledige publieke catalogus wordt eerst gezamenlijk opgehaald; persoonlijke selectie verandert geen bundelverzoek. Alle naamzinnen en hun catalogus-/variantmetadata worden daarna in het eigen verhaalpakket gekopieerd, gebonden aan exact pakket-ID, pakketversie, stemslot, presetversie en taal. Een gezinsdownload bewaart ook deze kopieën versleuteld en onder dezelfde ouder, pakketsleutel en verlooptijd als de verhaalbytes. De losse publieke cache is alleen een download-/previewbron; het complete pakket blijft werken nadat die cache en losse metadata zijn gewist.

Downloads pauzeren en hervatten op gecontroleerde fragmentgrenzen. Een volledige download wordt pas met een atomische complete-verwijzing actief nadat verhaalbytes, **alle** naamvarianten en bijbehorende metadata zijn gecontroleerd. Bij koude start controleert de app de pakketbinding, bestandsgrootte, SHA-256, metadata en geldigheid. Ook een ontbrekende ongekozen naamvariant of metadata maakt het pakket onvolledig, zelfs wanneer de publieke cache die opname nog heeft. Oudere complete-verwijzingen zonder eigen naamzinnenbundel worden onvolledig en moeten worden hervat. Vóór elk fragment controleert de speler de opname opnieuw. De gezinslease geldt ook als de eerste of enige clip een publieke naamzin of lokale ouderopname is, en blijft tijdens pauze actief. Beschadigde pakketten kunnen worden hersteld. Versie- en stemwissels vervangen een bestaande download niet stilzwijgend.

## Uitgevoerde lokale controles

- `npm run check --prefix mobile`: geslaagd.
- `node scripts/native-narration-check.mjs`: 10 geslaagde contract-/privacy-/toestemmings- en buildconfiguratieproeven, inclusief exacte hele-bundelbinding, gezinsdownload met alle naamvarianten, offline herladen zonder losse cache en een vertraagde persoonlijke voorkeurschrijfactie tijdens uitloggen. Voor de bestaande 13 verhalen tellen de drie leeslagen en vijf stemmen 6.045 scènes, 12.090 keuzezinnen en 6.240 eindes. Dit is een geteste **verwachtingsnoemer**, geen verklaring van gegenereerde of goedgekeurde providerdekking.
- `node --test scripts/billing/native-connected.test.mjs`: 9 bestaande regressieproeven geslaagd, waaronder versleutelde offline voortgang, accountwissel, wisvolgorde en intrekking tijdens een late schrijfactie.
- Gerichte Kotlin-syntax-/Android-API-compilatie met bestaande JDK/Kotlin en Android-jar: geslaagd. De kleine Expo-DSL-typestubs bewijzen geen volledige Expo- of Gradlecompilatie.
- Een lokale JVM-harnasproef voert de huidige Kotlin-pakketcontrolefuncties rechtstreeks uit met echte JSON- en SHA-controles: 16 gevallen geslaagd, waaronder ontbrekende/corrupte ongekozen cue, gelijke bestandslengte met verkeerde hash, ontbrekende/corrupte metadata, afwijkende lease, verkeerde bundelbinding, oude complete-verwijzing en verlopen pakket. Dit bewijst de controlefuncties; Android-bestandsopslag en afspelen vereisen de kandidaatgebonden emulatorproef.
- De actuele native verlooptijdhelpers slagen lokaal voor 10 gerichte proeven op zowel het API-35- als API-24-parsepad: ontbrekend/JSON-null publiek, geldige ISO-tijd, ongeldige of letterlijk `"null"`-tijd, verlopen/buiten-24-uur-tijd en ontbrekende/null privélease. De CI-fixture herhaalt deze guards op de echte Android JSON-klassen voordat de eerste download start. `JSONObject.NULL` wordt daarbij vóór stringconversie herkend.

## Verplichte CI- en toestelproeven

De normale workflow bouwt de lokale en gekoppelde stagingvariant. `FABELPAD_NARRATION_FIXTURE=true` is alleen toegestaan als zowel `FABELPAD_UNSIGNED_CHECK=true` als `CI=1`; een gewone of gesigneerde build weigert die instelling. Alleen zo verschijnt achter de ouderpoort het paneel **CI-audiofixture**. De synthetische toon is expliciet geen Nederlandse providerstem.

Een downloadfout in uitsluitend deze fixture meldt een vaste fasecode en exceptiontype, zonder bericht, bestandspad, account of payload. Gewone builds houden de generieke foutmelding.

`scripts/native-ux-smoke.py --narration-fixture` voert in de echte kandidaatapp controles uit voor WAV-decoding, meerdere fragmenten, pauze/hervatten, keuze/einde, downloadpauze tussen verhaal- en cuebytes, herstel, opzettelijke checksumcorruptie, ontbrekende ongekozen cue en metadata, verlopen pakket en verhaal- plus cueafspelen na koude herstart zonder wifi, mobiele data, losse publieke cuebytes of losse bundelmetadata. Uitkomst en beelden horen bij de exacte CI-run en kandidaat-SHA. Ze zijn pas bewezen nadat die run slaagt.

Echte OpenAI-verbinding, Nederlandstalige luisterkwaliteit, volledige gepubliceerde catalogus, opname met fysieke microfoon, fysieke headset, echte externe audiofocus, apparaatprestaties en Play-publicatie zijn afzonderlijke acceptatiestappen. Deze lokale controles verklaren die niet geslaagd.
