# Validatie avonturen en leesniveaus — 23 november 2026

Beoordeelde applicatiecommit: **`ec82395ba57904302bc4a93e71e5dba63def2950`**, repository `fabelpad/platform`, integratiebranch `main`. Beide eigen appservices zijn actief en boot-enabled op deze exacte bron. **Staging is publiek bereikbaar; production blijft op loopback en haar publieke HTTPS-route blijft uit.** Zie het [releasebewijs](deploy-evidence/complete-release-2026-11-23.json).

## Geïntegreerd gedrag

Alle **13 avonturen** bevatten **5 hoofdstukken**, precies **2 keuzes per hoofdstuk** en een speelprent bij elk van de **65 hoofdstukken**. De leesvolgorde is **hero → volledige verhaaltekst → Wat kies jij? → actieve speelprent of gewone keuzeknoppen → voorlezen/opslagstatus**. Dezelfde twee route-indexen `0` en `1` gelden in beide modi. Na een keuze begint het volgende hoofdstuk bovenaan bij de hero; keuze vijf opent de afsluiting van hoofdstuk vijf en kent het bijbehorende aandenken toe.

De eerste twee stationshoofdstukken behouden op web hun eigen opdrachten: het kaartje met de sterrensticker of de gouden sleutel, gevolgd door de spoorkeuze en treinanimatie. De overige hoofdstukken gebruiken geïllustreerde directe keuzes. Wisselen van modus behoudt hoofdstuk en voortgang; ontkoppelen annuleert onvoltooide callbacks. De native reader gebruikt de bestaande native componenten en op alle hoofdstukken illustraties met twee directe keuzes, met behoud van de wissel naar gewone keuzeknoppen; er is geen WebView toegevoegd.

De drie meegeleverde leesniveaus zijn **5 jaar en jonger** (`under6`), **6 t/m 8 jaar** (`6to8`) en **9+ jaar** (`9plus`). Zonder opgeslagen profielvoorkeur geldt `6to8`. Een niveauwissel verandert de woorden, niet de route, het hoofdstuk, de voortgang of de vastgezette contentversie. De jongere teksten zijn overgenomen uit de meegeleverde redactionele versies met kortere zinnen en meer alinea's; er is geen automatische leesbaarheidsbeoordeling uitgevoerd. De oorspronkelijke `9plus`-bron is behouden. Een voltooide route kan worden teruggelezen zonder nieuwe beloning of herschrijven van de voortgang, of opnieuw worden gespeeld vanaf hoofdstuk één. De laatst voltooide route en contentversie blijven per profiel beschikbaar als toekomstige continuïteitsinformatie; er is geen vervolgverhaal verzonnen.

## Lokale build en regressies

| Controle | Uitkomst |
| --- | --- |
| Schone werkmap uit `git archive` van exact `ec82395ba57904302bc4a93e71e5dba63def2950` | Eigen geïsoleerde lokale configuratie; geen externe provider-, account- of mailactie |
| `pnpm install --frozen-lockfile` en `bash scripts/local-build.sh` | **PASS, 46,8 seconden**; Node 24.18.0, pnpm 11.25.0, Next 16.3.4 |
| Volledige Playwright-suite | **68/68 PASS**, geen failures, skips of flaky tests; 18 nieuwe complete-avontuurgevallen |
| Responsive reader | 360, 390, 768 en 1440 px, grotere tekst, minder beweging, hero-/tekst-/keuzevolgorde en bruikbare aanraakdoelen |
| `node scripts/story-reading-levels-check.mjs` | Alle **403 hoofdstukvarianten en 416 eindroutes per niveau**; vijf hoofdstukken, twee keuzes, 34 behouden eindtitels, exacte aandenkens en geen invloed van toekomstige keuzes |
| Omvang volledige routes t.o.v. oorspronkelijke versie | `under6`: **95,2–101,9%**; `6to8`: **95,7–101,8%**; iedere route blijft binnen 5% |
| Bestaande speelopdrachtcontrole en browserregressies | Beide stationsopdrachten, routebetekenissen, treinanimatie, enkele keuzeverwerking en annulering bij wisselen/sluiten behouden |
| Voltooide route, herlezen en opnieuw spelen | Vijfde keuze sluit af; teruglezen overschrijft voortgang/geheugen/aandenken niet; herstart bewaart de laatst voltooide route |
| Oudere vastgezette en redactioneel aangepaste releases | Bestaande bytes en pin blijven behouden; een afwijkende oude editie wordt niet door actuele leesniveauherschrijvingen vervangen |
| Nieuwe gezins-/contentcontracten | **38 JS/SQL-snapshotgevallen en 37 bundelgevallen**; legacy-upgrade, JSONB-roundtrip, CAS, consent, ouderisolatie, publicatiehash en private rechten |
| Registratiebasis | Bestaande **27 echte SQL-registratiegevallen** en overige normale auth-/privacy-/mail-/deploy-/nativecontroles behouden |
| Vijf volledig verkende profielen | **219.763 bytes**, binnen de bestaande **262.144 bytes** documentlimiet |

Bewijs: [schone lokale validatie](deploy-evidence/complete-local-validation-2026-11-23.json). De productiebuild voert de normale configuratie-, TypeScript-, content-, backend-, e-mail-, deploy- en nativecontractcontroles uit en controleert de reproduceerbare web/native-export.

## Native Android en AAB

De Android-typecontrole, bestaande native runtimecontroles en `expo export --platform android` zijn geslaagd. De export bevat **1.209 hoofdstukvarianten**, **1.248 afsluitingen** over de drie niveaus, **20 gebundelde runtimebeelden** en 1139 Metro-modules. De bron-/assethashes en reproduceerbaarheid zijn gecontroleerd; bestaande mobiele releasearchieven zijn bytegelijk behouden. De afzonderlijke AAB-inspectie heeft bovendien alle **20 runtime-WebP-bestanden**, inclusief de verhaal-/speelprenten en merkbeelden, in het daadwerkelijke AAB teruggevonden en met de bronhashes vergeleken.

De verplichte native CI bouwde een echt **ongetekend productie-AAB**. De onafhankelijke inspectie controleerde GitHub-digest en ZIP-CRC, bronidentiteit, rapporthash/omvang, `bundletool validate`, pakket **`nl.fabelpad.app`**, versie **1.0.0 (1)**, target SDK **36**, min SDK **24**, beide ABI's (`arm64-v8a`, `x86_64`) en **44 native libraries** met minimaal 16-KiB-ELF-/bundle-alignment. AAB-SHA-256: `8b721b648b293583ce415f276f2cb68490381ab5e1cebc294f31b3ef650731a3`; omvang **38,871,026 bytes**. Signing/Play-job: **overgeslagen**. Het bestand is niet ondertekend en niet geüpload naar Google Play.

Het AAB bevat gecontroleerde **Hermes-bytecode versie 99**. Daarin zijn de huidige en gearchiveerde contentversietokens, alle dertien verhaal-ID's en de drie leesniveautokens statisch aangetroffen. Dit betreft bytecode-identiteit en aanwezigheid van teksttokens; het is geen uitvoering op een toestel en geen volledige decompilatie of bewijs van correcte runtimewerking.

Bewijs: [native export/runtime](deploy-evidence/complete-native-validation-2026-11-23.json) en [onafhankelijke CI-/AAB-inspectie](deploy-evidence/complete-native-ci-2026-11-23.json). **Een toestel- of emulatortest is niet uitgevoerd.** Rendering, TalkBack, systeemtekstschaling en hoorbare offline-spraak blijven afzonderlijke toestelacceptatie.

## Databases

Beide eigen Supabase-projecten hebben **12 migraties en 26 onveranderlijke releases**: 13 oude releases bytegelijk behouden en 13 nieuwe releases met drie volledige leesniveaus toegevoegd. Staging behoudt **1 Auth-gebruiker / 1 gezin**, production **0 / 0**. Bestaande gezins-/Auth-gegevens, eerdere migratiehistorie en publieke functies/rechten zijn ongewijzigd gecontroleerd; er zijn geen gebruikers aangemaakt of gebruikersrijen herschreven. De twaalfde migratie is additief en bewaart de bestaande sessie-, consent-, CAS- en privacygrenzen. De eigen nieuwe MCP-historierij is uitsluitend na begrensde naam-/timestamp-/SQL-hashcontrole op de CLI-bronversie `20261122233351` gezet.

Bewijs: [staging](deploy-evidence/complete-database-staging-2026-11-23.json) en [production](deploy-evidence/complete-database-production-2026-11-23.json); het [Supabase-contract](../supabase/README.md) beschrijft de optionele leesniveau-/routevelden en de volledige bundelvalidator.

## CI, kandidaten en activering

| Stap | Run | Resultaat |
| --- | --- | --- |
| Verplichte web-CI `verify` | [45084662737](https://github.com/fabelpad/platform/actions/runs/45084662737) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Verplichte `Native Android-controles` | [45084662867](https://github.com/fabelpad/platform/actions/runs/45084662867) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Stagingkandidaat | [45085866014](https://github.com/fabelpad/platform/actions/runs/45085866014) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Stagingactivering | [45086062913](https://github.com/fabelpad/platform/actions/runs/45086062913) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Productiekandidaat | [45086060176](https://github.com/fabelpad/platform/actions/runs/45086060176) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |
| Productieactivering | [45086241991](https://github.com/fabelpad/platform/actions/runs/45086241991) | **SUCCESS** op `ec82395ba57904302bc4a93e71e5dba63def2950` |

| Doel | Actieve kandidaat | Configuratie | Artefact-SHA-256 | Runtimeconfiguratie-SHA-256 |
| --- | --- | --- | --- | --- |
| staging | `ec82395ba57904302bc4a93e71e5dba63def2950-45085866014-1` | `complete-20261123-stg` | `fe475181d48b5231652212ec6f2b54a72e458e4accb0f5528f66c13587e3066b` | `c4ddef2350d174daee33787fede61307741a7b104e4412395d5a27365290d842` |
| production | `ec82395ba57904302bc4a93e71e5dba63def2950-45086060176-1` | `complete-20261123-prd` | `51c661f8781967064ec25991442f03b70d263d10bc49d749d1938e2c44ef0f59` | `83ffbd21e60be511fd75a777ade86b6845242dc3f731c34a5af1991e1e70c7c7` |

De [gezamenlijke activeringsaudit](deploy-evidence/complete-activated-2026-11-23.json) bevestigt beide services en exacte SHA-health. De [voorcontrole](deploy-evidence/complete-host-before-2026-11-23.json) en [routingcontrole](deploy-evidence/complete-routing-2026-11-23.json) bevestigen behoud van zes bestaande services, gedeelde configuratie, stagingproxy en standaard-hostantwoorden. Productie blijft uitsluitend op `127.0.0.1:4189`; staging gebruikt `127.0.0.1:4188` en HTTPS. Er zijn geen nieuwe GitHub-variabelen/secrets of wijzigingen aan gedeelde SSH, DNS, firewall, pakketten of hostadapters.

Publieke staging slaagt voor **23 HTTP/TLS-controles** en **1817 browsercontroles**. Zie [HTTP/TLS](deploy-evidence/complete-staging-public-2026-11-23.json) en [browserbewijs](deploy-evidence/complete-staging-browser-2026-11-23.json). Dit zijn anonieme controles zonder echte OTP-/Google-/mailhandelingen; zij bewijzen geen inboxbezorging of volledige geauthenticeerde gezinsacceptatie.

## Herstel en grenzen

De vorige procesgezonde combinatie is bron `96ef208439a8b4af1dca985ed7192fb286686b13`: staging `96ef208439a8b4af1dca985ed7192fb286686b13-45080430787-1` met `reader-20261122-stg`, production `96ef208439a8b4af1dca985ed7192fb286686b13-45080609989-1` met `reader-20261122-prd`. App en bijbehorende runtimeconfiguratie blijven samen behouden. Er is geen live rollback uitgevoerd.

Een kale terugkeer naar deze oude app is **geen functioneel veilige gezinsherstelroute zodra nieuwe velden zijn opgeslagen**: haar oude TypeScript-validator weigert `prefs.readingLevel`, `lastCompletedPicks` en `lastCompletedContentVersion`. Houd de additieve databasemigratie en alle onveranderlijke releases staan. Gebruik voor ouder-/gezinssynchronisatie een herstelbuild met compatibele validatie of een gecontroleerde vooruitreparatie; test bestaande snapshots en de volledige gebruikersflow vóór verkeer terugkeert. Verwijder geen nieuwe voorkeuren of routegeschiedenis om de oude validator te laten passen. Een health 200 bewijst uitsluitend procesliveness. Zonder vorige gezonde combinatie stopt een mislukte eerste installatie alleen de eigen app en verwijdert zij de eigen `current`-verwijzing.

Voorwaarden blijven `2026-11-22`, privacy `2026-11-22.1`. Eenmalige ouderverklaring bij registratie, echte sessie-/beheercontrole en afzonderlijke toestemming per online kinderprofiel blijven behouden. Auth-mail blijft **Supabase Custom SMTP → Resend** met zes cijfers; activeer geen Send Email Hook. De afzonderlijke API-servicemail wordt beheerd via `/studio/email`, templates via `/studio/email/templates`; een werkende SMTP-koppeling bewijst geen API- of inboxacceptatie.

De bestaande lifecycle behoudt **7 dagen** voor onafgeronde onboarding, **30 dagen** voor vrijwillige verwijdering en **210 dagen** voor minimaal gehashte wisbewijzen. **Automatische 90-dageninactiviteitswissing blijft uit** totdat waarschuwingen en overgang zijn geaccepteerd. Back-ups maximaal **180 dagen** en gewone Stackmail-support maximaal **12 maanden na afsluiting** blijven bevestigd beleid; externe opschoning en een echte herstelproef worden niet als appcron geclaimd.

Alle CI-, build- en activeringsclaims horen bij de bovenstaande applicatiecommit. Een latere documentatiecommit wordt niet als opnieuw gebouwd, getest of geactiveerd voorgesteld. Health heeft scope `process-liveness-only`, backend `configured-unverified`. Er is geen echte OTP-/Google-aanmelding, mailbezorging, native toestel-/emulatortest, TalkBack-/systeemlettertest, signing of Google Play-upload uitgevoerd. Een synthetische spraakstem bewijst geen hoorbare apparaatstem. De ongebruikte toegangsgrens heeft uitsluitend bronreview: de huidige App geeft geen `previewLimit` door.

De [release-/herstelprocedure](DG-VPS-08-TWEE-OMGEVINGEN.md) behoudt de aparte productievrijgave en de eis dat een back-upherstel alle latere verwijderingen/intrekkingen dekt of wordt geweigerd.
