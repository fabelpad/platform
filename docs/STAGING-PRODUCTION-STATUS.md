# Fabelpad — actuele status staging en production

Controledatum: **23 november 2026, Europe/Amsterdam**. Appbron **`228d951ac0db0bac03c7a74c9d67a8c547b005fa`**, repository `fabelpad/platform`, integratiebranch `main`. Beide kandidaatbouwen en activeringen zijn geslaagd. Zie het [releasebewijs](deploy-evidence/birth-release-2026-11-23.json), de [profielvalidatie](VALIDATIE-GEBOORTEDATUM-2026-11-23.md) en de [ondertekende Android-bouw](ANDROID-PRODUCTIE-1.0.1.md).

**Staging en productie zijn publiek bereikbaar via HTTPS: https://staging.fabelpad.nl en https://fabelpad.nl.** De eigenaar heeft de publieke productievrijgave op 23 november expliciet opgedragen. Alleen de eigen voorbereide productiesnippet is toegevoegd; DNS, bestaande proxysnippets, releases, accounts, runners en alle service-PID’s zijn behouden. De publieke privacy-URL https://fabelpad.nl/privacy geeft HTTP 200 zonder login. Zie [uitvoering en acceptatie](PRODUCTIE-LIVE-2026-11-23.md).

## Geboortedatum en leesniveau

Nieuwe persoonlijke kindprofielen vereisen een geboortedatum. Datum en handmatige leesvoorkeur staan uitsluitend bij het kind in de ouderinstellingen. De gedeelde kalenderfunctie gebruikt `Europe/Amsterdam`, voltooide jaren, de zesde en negende verjaardag en 1 maart voor 29 februari in een niet-schrikkeljaar. De categorie wordt opnieuw bepaald bij profielwisseling, verhaalopen, middernacht en terugkeer naar de app. Een bewuste handmatige voorkeur blijft staan totdat de ouder automatisch kiest en bewaart.

Bestaande profielen blijven leesbaar zonder geboortedatum. Tot toevoegen geldt de eerder bewaarde geldige categorie, anders `6to8`; oude readerkeuzes worden geen expliciete ouderoverride. De reader heeft geen niveaukiezer meer. Directe links en downloads gebruiken het profielniveau met behoud van verhaal-ID, hoofdstuk, route, aandenkens en voltooide geschiedenis. De kindnaam vervangt oude naamcodes en de hoofdletterplaceholder Avonturier; de hero toont steeds het avontuur van het kind.

Alle dertien avonturen behouden vijf hoofdstukken, twee keuzes en de 65 speelprenten. Hero, tekst en keuzemoment blijven in dezelfde volgorde staan. Stationsopdrachten, treinanimatie, gewone knoppen, teruglezen en herstart blijven werken. Alle 403 hoofdstukvarianten en 416 eindroutes per niveau zijn gecontroleerd.

## Uitgevoerde controles

| Controle | Resultaat / bewijs |
| --- | --- |
| Schone volledige lokale webbuild | **PASS, 52,734 s**; Node 24.18.0 / pnpm 11.25.0 / Next 16.3.4; [rapport](deploy-evidence/birth-local-validation-2026-11-23.json) |
| Browser | **76 unieke checks PASS**, inclusief nieuwe aanmaak/bewerking, legacy/import, profielen 5/7/9, verjaardag/foreground, handmatige reset en routebehoud; [rapport](deploy-evidence/birth-web-browser-2026-11-23.json) |
| Backend | Volledige regressies plus 30 JS/PostgreSQL DOB-gevallen, 22 API-gevallen en privacycatalogus-upgrade; [contract](KINDPROFIEL-GEBOORTEDATUM-CONTRACT.md) |
| Native | TypeScript, runtime, Metro-export, Kotlin, lint en echte releasebuild PASS; [ondertekende AAB](deploy-evidence/birth-native-signed-2026-11-23.json), [inhoud](deploy-evidence/birth-native-content-2026-11-23.json) |
| Hosted databases | Beide 14 juiste migraties; eerdere twaalf, accounts, gezins-/juridische gegevens en 26 releases behouden; vijftien pure validatorgevallen per project PASS |
| Publieke staging | Echte HTTPS-/asset-/anonieme browserchecks plus afzonderlijke volledig onderschepte synthetische ouderflow PASS; [rapport](deploy-evidence/birth-staging-browser-2026-11-23.json) |
| Host | Exacte app-/configuratiecombinaties, loopbackhealth, gescheiden rechten en behoud overige services/runners/proxy; [voorcontrole](deploy-evidence/birth-host-before-2026-11-23.json), [eindcontrole](deploy-evidence/birth-host-after-2026-11-23.json) |

| Stap | Geslaagde run op deze app-SHA |
| --- | --- |
| Web-CI | [45090519395](https://github.com/fabelpad/platform/actions/runs/45090519395) |
| Native Android-controles | [45090519222](https://github.com/fabelpad/platform/actions/runs/45090519222) |
| Stagingkandidaat | [45092314545](https://github.com/fabelpad/platform/actions/runs/45092314545) |
| Stagingactivering | [45092641979](https://github.com/fabelpad/platform/actions/runs/45092641979) |
| Productiekandidaat | [45092530884](https://github.com/fabelpad/platform/actions/runs/45092530884) |
| Productieactivering | [45092968383](https://github.com/fabelpad/platform/actions/runs/45092968383) |

## Omgevingen

| Onderdeel | Staging | Production |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Supabase-account / project | fabelpad / `tlwfpivafcokcjyjwgmq` | Duindorpdoet / `aptprpkosqctwrzeetgs` |
| Service / poort | `fabelpad-vps08-staging.service` / 4188 | `fabelpad-vps08-production.service` / 4189 |
| Runner | ID 21, `fabelpad-vps08-staging` | ID 22, `fabelpad-vps08-production` |
| Actieve kandidaat | `228d951ac0db0bac03c7a74c9d67a8c547b005fa-45092314545-1` | `228d951ac0db0bac03c7a74c9d67a8c547b005fa-45092530884-1` |
| Configuratie-ID | `birth-20261123-stg` | `birth-20261123-prd` |
| Artefact-SHA-256 | `b07d197382bf0bed1ffdb6d4bc9b65c9c53157edccff2d9ea1912e14e5027c77` | `16c2f747d5eec6e2dd5f317dad1285ac5ef0c52ca0347444893ecbe836177436` |
| Runtimeconfiguratie-SHA-256 | `db4e247fec947b0aca635e73a4d0cd3ff602a5852f4700b2ba61609c872514ec` | `2d131808af41676b4cc5c66d4a226291154c26f2f116e7db02c3059ff790e268` |
| Vorige kandidaat | `ec82395ba57904302bc4a93e71e5dba63def2950-45085866014-1` | `ec82395ba57904302bc4a93e71e5dba63def2950-45086060176-1` |
| Vorige configuratie | `complete-20261123-stg` | `complete-20261123-prd` |
| Publieke HTTPS | Actief, noindex | **Actief**, geldig certificaat voor `fabelpad.nl` |

De releasepaden zijn `/srv/sites/fabelpad-vps08-staging/releases/KANDIDAAT` en `/srv/sites/fabelpad-vps08-production/releases/KANDIDAAT`. App en de bijbehorende versiegebonden runtimeconfiguratie blijven gekoppeld. Beide environments houden uitsluitend `FABELPAD_APP_ORIGIN`, `FABELPAD_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Er zijn geen GitHub-variabelen, secrets of environments toegevoegd.

## Database, privacy en mail

Beide projecten hebben de additieve migraties `20261123002951_child_birth_date_reading_profile.sql` en `20261123003259_child_birth_date_privacy_information.sql`. Geen gezin is herschreven; er zijn geen gebruikers of geboortedatums verzonnen. Staging behoudt één gebruiker/gezin/aanvaarding/toestemming; production nul. Beide behouden 26 verhaalreleases. [Stagingbewijs](deploy-evidence/birth-database-staging-2026-11-23.json), [productiebewijs](deploy-evidence/birth-database-production-2026-11-23.json).

Voorwaarden blijven `2026-11-22`; actuele privacy is **`2026-11-23`**, inclusief geboortedatum en automatische indeling. De oorspronkelijke documenten blijven bytegelijk beschikbaar. Bestaande ouders herhalen hun 18+/ouderverklaring niet. Online toegang, afzonderlijke profieltoestemming, RLS, CAS en volledige profielverwijdering behouden hun werking. Auth-mail blijft Supabase Custom SMTP → Resend met zes cijfers; geen hook-, Auth-, mail- of Vault-wijzigingen uitgevoerd. Applicatiemail blijft afzonderlijk beheerbaar via `/studio/email` en `/studio/email/templates`.

Bestaande retentie blijft behouden: zeven dagen onafgeronde onboarding, dertig dagen vrijwillige accountverwijdering en 210 dagen minimaal gehasht wisbewijs. Automatische inactiviteitswissing blijft uit. Back-ups maximaal 180 dagen; gewone Stackmail-support maximaal twaalf maanden na afsluiting. Externe mailbox-/back-upopschoning is geen appcron.

## Android, gebruik en herstel

De gratis lokale React Native-app is aangeleverd als **ondertekende 1.0.1 (2), `nl.fabelpad.app`**. AAB **38.917.985 bytes**, SHA-256 `6e32d9faed68febb783e9a0c2a0a2683cd418858fbc7af3e78ca539bea9de746`. Twintig runtimebeelden, native datumkiezer, signing en alle 44 ELF-/bundle-/APK-alignments zijn gecontroleerd. De Android-profielen zijn lokaal en gebruiken geen Supabase-account. De spraakengine ontvangt een generieke naam; geen kindnaam of geboortedatum.

Ververs de gebruikte omgeving om de nieuwe client te laden; wis geen bestaande profielen of browsergegevens. Voeg ontbrekende geboortedatums in de ouderinstellingen toe. Bestaande verhalen blijven intussen leesbaar.

De vorige procesgezonde app/configuratiecombinaties blijven behouden. Een kale approllback naar `ec82395...` is **geen functioneel veilige herstelroute**: oude clients kennen `birthDate`/`readingLevelOverride` en privacyversie 23 niet. Houd de additieve database en historische documenten in stand en gebruik een compatibele herstelbuild of vooruitreparatie. Verwijder geen profielvelden om oude code passend te maken. Activatie en herstel gebruiken hetzelfde eigen activatielock; er is geen live rollback uitgevoerd. Zie de [releaseprocedure](DG-VPS-08-TWEE-OMGEVINGEN.md) en het [profielcontract](KINDPROFIEL-GEBOORTEDATUM-CONTRACT.md).

Alle build-/CI-/activeringsclaims horen bij de bovenstaande applicatiecommit. Latere documentatiecommits zijn geen opnieuw gebouwde app. Health is `process-liveness-only`, backend `configured-unverified`. De browserouderflow gebruikt onderschepte API's; echte OTP-/Google-login, hosted profielopslag en mailbezorging zijn niet als getest geclaimd. Er is geen Android-toestel-/emulatortest, TalkBack-acceptatie of Google Play-upload uitgevoerd. Publieke productie-HTTPS en de privacybereikbaarheid zijn inmiddels afgerond en onafhankelijk gecontroleerd. Play-account/testgate, Store-assets, toestelacceptatie en Cloud-/Play-inrichting blijven afzonderlijke stappen in het [actuele invulblad](GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md) en het Android-uploadverslag.
