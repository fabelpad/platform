# Geboortedatum en profielgebonden leesniveau

Deze aanvulling bewaart het bestaande `schemaVersion: 1`-gezin en alle verhaal-ID's, profiel-ID's, routekeuzes, voltooide routes en bewaargegevens. Een kind kan in de profielmetadata twee nieuwe optionele velden hebben:

- `birthDate`: kalenderdatum als `YYYY-MM-DD`, zonder tijdstip of tijdzone.
- `readingLevelOverride`: `under6`, `6to8` of `9plus`, uitsluitend na een bewuste keuze in de ouderinstellingen. Het ontbreken van dit veld betekent automatisch. `null`, lege waarden en `auto` worden niet als opgeslagen categorie geaccepteerd.

Leeftijd en automatische categorie worden niet opgeslagen. `src/profileReading.ts` bepaalt ze op basis van de kalenderdatum in `Europe/Amsterdam`. Een verjaardag op 29 februari verschuift voor deze indeling in een niet-schrikkeljaar op 1 maart. Een geldige oude `prefs.readingLevel` blijft alleen een tijdelijke terugval voor een bestaand profiel zonder geboortedatum; deze waarde wordt nooit een expliciete override.

## Online opslag en migratie

`20261123002951_child_birth_date_reading_profile.sql` is met Supabase CLI 3.2.0 gemaakt. De migratie herschrijft geen gezin, toestemming of verhaalrecord en verzint geen geboortedatums. Zij behoudt de bestaande strikte JSONB-validator als afgeschermde helper en voegt de datum-/override-validatie toe. Het huidige Nederlandse kalenderdagcriterium is `STABLE`, niet `IMMUTABLE`.

`validateFamilySnapshot` controleert de vorm en geldigheid van aanwezige waarden. De aanvullende `validateFamilyProfileChanges` vergelijkt met de werkelijk opgeslagen snapshot van de geverifieerde ouder. De API leest uitsluitend `parent_id = geverifieerde ouder`; een profiel-ID of revision uit de aanvraag bewijst geen bestaande status. `save_family_snapshot` herhaalt de vergelijking binnen de bestaande lifecycle-lock, vóór de CAS-write. Ook een directe RPC kan de geboortedatumeis dus niet omzeilen.

Een bestaand opgeslagen profiel zonder datum mag worden geladen en bijgewerkt zonder het lezen te blokkeren. Een nieuw profiel-ID vereist een geldige datum, ook wanneer een lokaal profiel voor het eerst in een leeg online gezin wordt geïmporteerd. Nadat een datum is toegevoegd, kan deze worden vervangen door een andere geldige datum, maar niet worden leeggemaakt. Verwijderen van het gehele profiel gebruikt de bestaande toestemmingsintrekking; die verwijdert de volledige profielmetadata, inclusief datum en override, en de bijbehorende verhaalgegevens.

Lege waarden, niet-bestaande datums zoals 31 april, niet-schrikkeldatums, andere formaten en toekomstige datums worden vóór opslag geweigerd. De datumvalidatie gebeurt aan client-, API- en databasekant. De bestaande ouderverificatie, sessiecontrole, lifecycle-toegang, aparte profieltoestemming, RLS, maximumbudgetten en CAS blijven van kracht. Er worden geen nieuwe publieke tabellen of brede rechten toegevoegd. De private validators zijn niet rechtstreeks uitvoerbaar door `anon`, `authenticated` of `service_role`.

## Uitrolvolgorde en herstel

Pas de schema-aanvulling en de daaropvolgende privacycatalogus-aanvulling toe vóór de bijbehorende webrelease. Controleer na migratie eerst de nieuwe validatie en vervolgens de aanmaak-/bewerkflow in dezelfde omgeving. Een actuele apprelease moet de nieuwe optionele velden in een gezinsantwoord behouden. Oude appversies die profielmetadata op precies drie velden beperken zijn geen geschikte rollback voor snapshots met de nieuwe velden. Gebruik daarvoor een compatibele release of een gerichte herstelrelease; verwijder geen echte geboortedatums om een oude client passend te maken.

Dit document op zichzelf bewijst geen hosted migratie of publicatie. De taakrapportage moet vermelden welke omgevingen werkelijk zijn aangepast. De native Android-app bewaart deze profielgegevens lokaal volgens zijn bestaande opslagcontract en gebruikt geen Supabase-account of online gezin.

## Uitgevoerde contractcontroles

- `node scripts/profile-birth-date-db-check.mjs`: 30 gedeelde JS/PostgreSQL gevallen voor datum en override; echte upgrade over een legacy-snapshot zonder herschrijven; onderscheid bestaande en nieuwe IDs; JSONB-roundtrip; routebehoud; override en terugschakelen; CAS; toestemming; gezinsisolatie; private helperrechten; volledige profielwissing.
- `node scripts/profile-birth-date-api-check.mjs`: 22 gevallen tegen de echte Next-route en geïnstalleerde SSR/PostgREST-client met onderschepte provider; verkeerde datums; nieuwe versus opgeslagen profielen; uitsluitend eigen gezin; bewerken; automatische reset; CAS; account-/origin-/toestemmingsgrenzen; private responses.
- `node scripts/profile-birth-date-privacy-db-check.mjs`: werkelijke upgrade van privacyversie `2026-11-22.1` naar `2026-11-23`, zonder gewijzigde historische documentbytes, aanvaardingen, toestemmingen of gezinsrecords; alle vijf actuele private functie-implementaties blijven afgezien van het privacyversienummer exact gelijk en behouden hun rechten. Nieuwe OTP-, Google- en directe onboarding en profieltoestemmingen leggen de juiste nieuwe versie en hash vast; een bestaande ouder hoeft geen tweede verklaring af te leggen.
- De bestaande Supabase-, lifecycle- en leescontractcontroles zijn met de nieuwe schemamigratie geslaagd. Nieuwe profiel-fixtures bevatten een geldige synthetische datum; de afzonderlijke upgradeproef behoudt bewust een legacy-profiel zonder datum.

Het volledige `pnpm check:backend` is met Node `24.18.0` en pnpm `11.25.0` geslaagd, inclusief beide nieuwe migraties en alle bovenstaande checks. De oorspronkelijke registratieproef warmt de bestaande worker nu direct vóór de oorspronkelijke registratiemigratie en past alle latere migraties daarna in tijdsvolgorde toe. Zij zet dus niet ongemerkt een oudere privacyversie terug na een nieuwere migratie. De aparte historische `2026-11-22` → `2026-11-22.1` upgradeproef blijft intact.

De lokale databaseproeven draaien PostgreSQL via PGlite en stubben Auth, Vault en providergrenzen. Ze bewijzen geen externe e-mailbezorging, hosted Auth, echte gelijktijdige databaseverbindingen of toestelgedrag. De API-proef mag geen echte provider aanroepen en schrijft uitsluitend synthetische testgegevens.
