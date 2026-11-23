# Geboortedatum en automatisch leesniveau — 23 november 2026

## Gedrag

Web en native Android gebruiken dezelfde pure functies uit `src/profileReading.ts`. Geboortedatums zijn kalenderdatums in `YYYY-MM-DD`; de huidige kalenderdag komt altijd uit `Europe/Amsterdam`. Leeftijd wordt niet opgeslagen. Vanaf de zesde verjaardag geldt `6to8`, vanaf de negende `9plus`. Een verjaardag op 29 februari gaat in een niet-schrikkeljaar op 1 maart over naar het volgende jaar.

Nieuwe persoonlijke profielen vereisen een echte, niet-toekomstige datum. De webformulieren gebruiken een datumveld met Nederlandse datumcaption, Android een native Nederlandse datumkiezer. Ouders kunnen de datum en een afzonderlijke handmatige voorkeur bewerken. Een handmatige voorkeur blijft bestaan bij datumwijzigingen en verjaardagen; na automatisch kiezen en bewaren volgt het profiel weer de geboortedatum. De reader bevat geen niveaukeuze en negeert oude niveauqueryparameters.

Bestaande profielen krijgen geen verzonnen datum of handmatige voorkeur. Zonder datum blijft een geldige oude categorie tijdelijk gelden, anders `6to8`. Na toevoegen van de datum geldt automatisch het afgeleide niveau. Een lokaal profiel dat voor het eerst naar een leeg online gezin wordt geïmporteerd heeft bij die import wel een datum nodig; het importformulier vraagt deze uit zonder de route te wissen. De algemene, nog niet gepersonaliseerde starter blijft zonder datum bruikbaar.

Profielwisseling, openen/hervatten, verjaardag en terugkeer naar een app of browsertab verversen de effectieve tekstvariant. Verhaal-ID, contentversie, hoofdstuk, keuzes, aandenkens en laatst voltooide route blijven behouden. Gedownloade verhalen gebruiken dezelfde profielbepaling. Historische, redactioneel afwijkende versies blijven hun eigen onveranderlijke teksten gebruiken.

Geboortedatums verschijnen uitsluitend in ouderinstellingen. De lokale webomgeving gebruikt de bestaande oudervraag; Android beschermt beheer met de bestaande geboortejaarvraag en een korte sessie die bij achtergrondgebruik of verlopen sluit. Dit zijn lokale ouderdrempels, geen identiteitsverificatie. De online omgeving behoudt echte sessie-, gezins-, toestemmings- en CAS-controles.

De gekozen kindnaam vervangt zowel actuele naamcodes als de oude hoofdletterplaceholder `Avonturier`, ook in gecachte teksten. De hero toont bij elk hoofdstuk het avontuur van het kind. Algemene woorden zoals “een avonturier” blijven gewone verhaaltekst. De bestaande bescherming voor voorlezen blijft behouden: de spraakengine krijgt de generieke naam, geen kindnaam of geboortedatum.

## Database en privacy

Zie [opslagcontract](KINDPROFIEL-GEBOORTEDATUM-CONTRACT.md). Twee additieve migraties moeten vóór de nieuwe webrelease worden toegepast:

1. `20261123002951_child_birth_date_reading_profile.sql` — validatie van kalenderdatum/override, verplichte datum voor nieuwe profielen, behoud van bestaande snapshots, herhaalde controle onder de bestaande schrijfvergrendeling.
2. `20261123003259_child_birth_date_privacy_information.sql` — privacycatalogus `2026-11-23` en dezelfde versie voor nieuwe registratie en profieltoestemming.

De privacyverklaring beschrijft nu de echte geboortedatumverwerking. Historische documenten en hun hashes blijven behouden. Bestaande ouders hoeven hun volwassenverklaring of voorwaarden niet opnieuw te bevestigen. De bestaande profielverwijdering verwijdert ook de nieuwe velden. Een terugkeer naar een oude validator die de velden niet kent is geen veilige rollback; gebruik een compatibele herstelbuild. Verwijder geen geboortedatums om oude code passend te maken.

## Gecontroleerd

- Node **24.18.0**, pnpm **11.25.0**, Next **16.3.4** en de gecommitte lockbestanden.
- Gedeelde kalenderproef: ontbrekend/leeg, 31 april, correcte en onjuiste schrikkeldatums, toekomst, dag vóór/op/na beide verjaardagsgrenzen, 29 februari, Nederlandse middernacht en verschillende systeemzones; legacy, overrides en naamvervanging.
- `pnpm check:profiles`: normalisatie, lokale opslag, JSONB-volgorde, snapshotroundtrip, legacy en routebehoud.
- `pnpm check:backend`: volledige bestaande regressies plus **30 JS/PostgreSQL datumgevallen**, **22 API-gevallen** en een echte privacycatalogus-upgradeproef. Alleen synthetische lokale gegevens; providergrenzen onderschept.
- `pnpm check:content`: alle **403 hoofdstukvarianten en 416 eindroutes per leesniveau**, bestaande speelopdrachten, immutable releases en reproduceerbare web/native-contentexport.
- **76 unieke browserchecks geslaagd**: volledige aanmaak/bewerking met synthetische gegevens, drie leeftijdsprofielen, handmatige reset, beide verjaardagen over middernacht/foreground, downloaden/cache, directe links, gezinsimport/synchronisatie, alle dertien complete avonturen, auth en ouderverklaring, beheer, e-mail en juridische pagina's. Twee oude juridische testverwachtingen zijn aangepast; daarbij is ook de historische `2026-11-22.1`-redirect hersteld en zijn beide oude documenthashes gecontroleerd. De definitieve juridische suite slaagt **4/4**.
- Native TypeScript, runtime-/opslag-/verjaardags-/ouderdrempelproeven, Metro Android-export (**1.143 modules, 20 beelden**) en Kotlin releasecompilatie geslaagd.

De definitieve browser-, schone build- en ondertekeningsresultaten worden hieronder vastgelegd zodra ze voltooid zijn. Een compiler-/exportcontrole is geen toesteltest. Er is geen fysieke Android- of emulatortest uitgevoerd. Deze documentatie is geen bewijs van Google Play-indiening of externe mailbezorging.
