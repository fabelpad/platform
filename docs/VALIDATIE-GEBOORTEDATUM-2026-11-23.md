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

De definitieve schone webbuild op `228d951ac0db0bac03c7a74c9d67a8c547b005fa` is geslaagd: `pnpm install --frozen-lockfile` plus volledige `bash scripts/local-build.sh`, **52,734 seconden**, Node 24.18.0, pnpm 11.25.0 en Next 16.3.4. Alle configuratie-, type-, content-, backend-, e-mail-, deploy- en nativecontractcontroles slagen. De geïsoleerde productiestart op een eigen loopbackpoort geeft health, privacy en verhaalcontent alle HTTP 200. Geen bestaande service of provider gebruikt. De eerdere poging op `8b72038` is niet als geslaagde release aangemerkt: een e-mailtestfixture gebruikte nog de vorige privacyversie; de definitieve commit corrigeert uitsluitend die fixture.

De daadwerkelijke ondertekende Android-bouw is geslaagd op dezelfde schone broncommit: **1.0.1 (2)**, pakket `nl.fabelpad.app`, **38.917.985 bytes**, SHA-256 `6e32d9faed68febb783e9a0c2a0a2683cd418858fbc7af3e78ca539bea9de746`. Signing, manifest, alle twintig runtimebeelden, native datumkiezer, 44 ELF-libraries en 16-KiB-bundle-/APK-alignment zijn op de bestanden gecontroleerd. Zie [Android-bouwverslag](ANDROID-PRODUCTIE-1.0.1.md).

Beide verplichte GitHub-controles zijn **SUCCESS** op deze applicatie-SHA: [web-CI 45090519395](https://github.com/fabelpad/platform/actions/runs/45090519395) en [Native Android-controles 45090519222](https://github.com/fabelpad/platform/actions/runs/45090519222). De aanvullende automatische signing-/Play-job is overgeslagen; de geleverde ondertekende bundel is afzonderlijk lokaal gebouwd en geverifieerd. Beide kandidaatbouwen en activeringen zijn geslaagd op `dg-vps-08`: staging kandidaat **45092314545**, activering **45092641979**; production kandidaat **45092530884**, activering **45092968383**. De app-SHA is overal dezelfde. Configuratie-ID's zijn `birth-20261123-stg` en `birth-20261123-prd`. Staging gebruikt HTTPS en poort 4188; de bestaande productionservice poort 4189, zonder publieke productieroute.

Beide Supabase-projecten hebben **14 bronmigraties**. Alle eerdere twaalf historie-/SQL-records, gebruikers, gezinsdocumenten, aanvaardingen, toestemmingen en 26 verhaalreleases zijn behouden. Alleen de eigen twee nieuwe MCP-historierijen zijn na exacte naam, gegenereerde versie, SQL-MD5, één statement/rij en ontbrekende bronversie aan de CLI-bronversie gekoppeld. De vijftien hosted pure validatorgevallen slagen per project; RLS, ACL's en publieke wrappers blijven behouden. Zie [stagingdatabase](deploy-evidence/birth-database-staging-2026-11-23.json) en [productiedatabase](deploy-evidence/birth-database-production-2026-11-23.json).

De [publieke stagingcontrole](deploy-evidence/birth-staging-browser-2026-11-23.json) slaagt op exact deze app-SHA: echte HTTPS-/anonieme browsercontroles en afzonderlijk een volledig onderschepte synthetische ouderflow. Dit bewijst geen echte OTP-/Google-aanmelding, hosted ouderopslag of mailbezorging. De laatste [alleen-lezen hostaudit](deploy-evidence/birth-host-after-2026-11-23.json) slaagt **91/91**: beide exacte releases en configuraties, vorige combinaties, gescheiden rechten, zes andere services en gedeelde configuratie/routing zijn behouden. Het [samengevoegde releasebewijs](deploy-evidence/birth-release-2026-11-23.json) koppelt deze resultaten aan dezelfde app-SHA. Een compiler-/exportcontrole is geen toesteltest. Er is geen fysieke Android- of emulatortest uitgevoerd. Deze documentatie is geen bewijs van Google Play-indiening of externe mailbezorging.
