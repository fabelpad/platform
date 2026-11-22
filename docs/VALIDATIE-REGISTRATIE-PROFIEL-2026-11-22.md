# Fabelpad — registratie, profielopslag en echte gebruikersteksten

Datum: **22 november 2026**. Beoordeelde appbron: **`003670aad04ecdf761b21627d8624dea50403ae5`**, repository `fabelpad/platform`, integratiebranch `main`.

**Uitrolstatus:** de schone lokale build en **43/43 browsertests** slagen; beide vereiste GitHub-CI-runs zijn **SUCCESS**. De registratiemigratie is op staging en production toegepast en gecontroleerd. Staging draait deze nieuwe app via HTTPS: de publieke HTTP/TLS-controle slaagt **23/23** en de mobiele browsercontrole **67/67**. Beide kandidaten en activeringen zijn **SUCCESS**. De gezamenlijke geactiveerde audit bevestigt beide apps op de nieuwe bron, met gezonde loopbackhealth en de vorige app/configuratie behouden. Production-HTTPS blijft uit. Echte nieuwe providerregistratie en mailboxaflevering worden door de anonieme controles niet bewezen.

## Resultaten en bewijslimieten

| Onderdeel | Bron / controle | Status |
| --- | --- | --- |
| Schone lokale installatie en build | Exacte `git archive` van `003670aad04ecdf761b21627d8624dea50403ae5`; frozen lockfile; normale projectbuild | **PASS**, 44,2 seconden inclusief de uitgevoerde bouwroute |
| Browserregressie | Productiebundel van dezelfde bron; synthetische browsergegevens en afgeschermde API-mocks | **43/43 PASS**, 29,2 seconden |
| Web-CI | [45070746885](https://github.com/fabelpad/platform/actions/runs/45070746885) | **SUCCESS** op exacte nieuwe bron |
| Native-CI | [45070746947](https://github.com/fabelpad/platform/actions/runs/45070746947) | **SUCCESS**; geen Play-upload of publicatie uitgevoerd |
| Registratiemigratie | `20261122210104_parent_registration_proof.sql` | Beide projecten toegepast; SQL-hash en historie gecontroleerd |
| Nieuwe stagingkandidaat / activering | [45072508682](https://github.com/fabelpad/platform/actions/runs/45072508682) / [45072723017](https://github.com/fabelpad/platform/actions/runs/45072723017), configuratie `regprof-20261122-stg` | Beide **SUCCESS**; kandidaataudit **PASS**; publieke health exacte nieuwe SHA |
| Nieuwe productionkandidaat / activering | Kandidaat [45072710965](https://github.com/fabelpad/platform/actions/runs/45072710965); activering [45072894209](https://github.com/fabelpad/platform/actions/runs/45072894209) | Beide **SUCCESS**; kandidaataudit en geactiveerde audit **PASS**; alleen intern op loopback |
| Gezamenlijke eindcontrole | [Geactiveerde audit](deploy-evidence/registration-activated-2026-11-22.json), [routing](deploy-evidence/registration-routing-2026-11-22.json) en [database](deploy-evidence/registration-database-final-2026-11-22.json) | **PASS**; beide nieuwe apps gezond, bestaande omgevingen en gegevens behouden |
| Publieke stagingcontrole van nieuwe app | Exacte SHA; alleen-lezen HTTPS en mobiele Chromium | **23/23 HTTP/TLS PASS**, **67/67 browser PASS**; production niet publiek getest |
| Echte nieuwe OTP-/Google-aanmelding en mailboxaflevering | Afzonderlijke interactieve acceptatie | Niet bewezen door de lokale mocks of alleen-lezen publieke controle |

De build is uitgevoerd in `/tmp/fabelpad-registration-clean-20261122-wpaebkaz`, met **Node 24.18.0**, **pnpm 11.25.0** en **Next 16.3.4**. Opdrachten: `pnpm install --frozen-lockfile`, daarna `bash scripts/local-build.sh`. De configuratie was expliciet lokaal, zonder productie- of stagingcredentials. Logs: `/tmp/fabelpad-registration-clean-build-20261122.log` en `/tmp/fabelpad-registration-clean-browser-20261122.log`.

De normale build omvat configuratie/TypeScript, domein- en contentcontroles, PostgreSQL/RLS/CAS, **51 Auth-contractscenario’s**, **36 ouder-API-scenario’s**, **48 AVG-beheer-API-scenario’s**, **27 registratiedatabasescenario’s**, accountlevenscyclus, signed scheduler, worker, mail, deploy en de Next-productiebundel. De web/native-contentvergelijking en native gedragscontrole slagen eveneens. De afzonderlijke Android-CI-compilatie is inmiddels ook geslaagd. De native app is niet gewijzigd en er is geen Google Play-release uitgevoerd.

## Profielopslag: oorzaak en herstel

De server kon een eerste kinderprofiel al correct opslaan, terwijl de browser het antwoord daarna ten onrechte afwees. `isFamilySnapshot` vergeleek het genormaliseerde gezinsobject met `JSON.stringify`. PostgreSQL JSONB kan de sleutels van hetzelfde object in een andere volgorde teruggeven. Daardoor leek een inhoudelijk geldig antwoord ongeldig en kon het scherm blijven vragen om het eerste profiel te bewaren.

De nieuwe controle in [profileStorage.ts](../src/profileStorage.ts) vergelijkt de toegestane vorm en waarden: exact de verwachte family- en profielvelden, geldige waarden, maximaal vijf profielen en een geldig actief profiel. Sleutelvolgorde van JSON-objecten bepaalt de geldigheid niet meer. De vergelijking in [cloudSync.ts](../src/cloudSync.ts) is om dezelfde reden semantisch gemaakt. **Volgorde van arrays blijft wel betekenisvol**, onder meer voor profielen en verhaalkeuzes. Extra of afwijkende velden worden hierdoor niet stilzwijgend toegestaan.

Een al opgeslagen profiel en een achtergebleven lokale wijzigingskopie kunnen nu worden herkend als dezelfde inhoud. De browser neemt de bevestigde revisie over, zonder opnieuw een profiel of toestemming aan te maken. Hiervoor zijn geen gezinnen gewist, profiel-ID’s vervangen of bestaande aanvaardingen opnieuw geschreven. De oorspronkelijke lokale opslagruimte blijft behouden, ook waar de interne sleutel nog een historische naam bevat.

De regressies in [family-persistence.spec.ts](../tests/browser/family-persistence.spec.ts) testen het eerste profiel met daadwerkelijk anders geordende JSONB-antwoorden, heropenen zonder extra PUT of toestemming en herstel van een eerder opgeslagen profiel met een achtergebleven wijzigingskopie. De lokale SQL-controle simuleert ook het echte PostgreSQL-antwoordenpad.

## Eenmalige registratiekeuzes met serverbewijs

Bij **Inloggen → Ouderaccount maken** staan twee afzonderlijke, aanvankelijk uitgevinkte keuzes: de verklaring dat iemand 18 jaar of ouder is en als ouder met gezag of voogd handelt, en akkoord met de actuele voorwaarden. De privacyverklaring is informatie en krijgt geen verplichte toestemmingscheckbox. Deze keuzes blijven vereist voordat een registratiecode of Google-registratie wordt aangevraagd.

De nieuwe route bewaart de gekozen documentversies en verklaringen tijdelijk op de server. De browser krijgt uitsluitend een willekeurige, HttpOnly capabilitycookie; een onbeveiligde cookieclaim of zelf ingevulde gebruikersmetadata geldt niet als ouderverklaring. Het serverbewijs vervalt na **30 minuten**. OTP-bewijs is aan de genormaliseerde e-mailhash gebonden. Voltooien vereist een geverifieerde ouder en verse, passende authenticatie. Google-bewijs wordt uitsluitend direct na de succesvolle eigen PKCE-callback verbruikt; een algemene bestaande-sessieretry voltooit geen Google-bewijs.

Na succesvolle verificatie worden de eerdere keuzes bij het account vastgelegd en gaat de ouder naar de gezinsomgeving. Een actief account met actuele voorwaarden wordt bij een bezoek aan `/onboarding` direct doorgestuurd. Dezelfde verklaring wordt niet opnieuw gevraagd alleen omdat iemand opnieuw inlogt of die route opent. De afzonderlijke toestemming voor ieder online kinderprofiel blijft behouden en wordt niet door de registratieverklaring vervangen.

Als het afronden tijdelijk faalt, blijft de eerdere registratie beschikbaar voor een veilige retry. Het scherm toont **Registratie opnieuw afronden**, zonder opnieuw ouderverklaring en voorwaarden te laten aanvinken. Als herauthenticatie nodig is, verschijnt de passende e-mailcode-/Google-hervatroute. Alleen wanneer er geen bruikbaar registratiebewijs bestaat, kan een nog onvoltooid bestaand account de eenmalige expliciete fallback gebruiken. Een nieuwe voorwaardenversie mag wel nieuwe aanvaarding vereisen; ontbrekend bewijs wordt nooit achteraf verzonnen.

Bronnen: [registratie-BFF](../lib/server/registration.ts), [Auth-afhandeling](../lib/server/auth.ts), [onboardingscherm](../src/ParentAccountPage.tsx) en [registratiemigratie](../supabase/migrations/20261122210104_parent_registration_proof.sql). [registration-proof.spec.ts](../tests/browser/registration-proof.spec.ts) controleert drie synthetische flows: één keer kiezen → OTP → actief → eerste JSONB-profiel; bestaand actief account direct door; en een 503 bij bewijsvoltooiing gevolgd door retry zonder nieuwe checkboxen. De mocks bewijzen geen echte provideraflevering of OAuth-voltooiing.

## Additieve migratie en bestaande gegevens

SQL-SHA-256: **`60621f836cf16c80b070f4daae69cc3f5de779c40566b69fe3d5caf4b52c79ba`**. Staging is eerst gemigreerd en gecontroleerd, daarna production. De afwijkende beheertooltijdstempels zijn pas na vergelijking van de exacte SQL-hash, migratienaam en historie genormaliseerd naar bronversie `20261122210104`. Beide histories bevatten nu **11 migraties**.

| Controle | Staging vóór → na | Production vóór → na |
| --- | --- | --- |
| Auth-gebruikers | 1 → 1 | 0 → 0 |
| Gezinnen | 1 → 1 | 0 → 0 |
| Bestaande aanvaardingen | 1 → 1 | 0 → 0 |
| Achteraf ingevulde registratieverklaringen | 0 | 0 |
| Onderhoudscron | Actief behouden | Actief behouden |
| Automatische 90-dagenmassawissing | Uit behouden | Uit behouden |

De bewijstabel heeft RLS en geen directe lees-/schrijfrechten voor anon, authenticated of service_role. Alleen de begrensde beginfunctie kan vóór login worden aangeroepen; voltooien vereist authenticated en verse servercontrole. De al geladen onderhoudsfunctie is apart getest op het opruimen van verlopen bewijzen. De bestaande Auth-/SMTP-configuratie en gezinnen zijn behouden.

Livebewijs: [additieve migratie en gegevensbehoud](deploy-evidence/registration-supabase-live-2026-11-22.json), lokaal vastgelegd als `/tmp/fabelpad-registration-supabase-live-20261122.json`. De livecontrole meldt op staging een al bestaande waarschuwing voor uitgeschakelde bescherming tegen gelekte wachtwoorden en een INFO over een private RLS-tabel; production meldt die INFO. De waarschuwing is niet door deze wijziging veroorzaakt of stilzwijgend als opgelost gepresenteerd. Dit document claimt geen algemene nulmeldingenstatus.

## Echte gebruikersteksten en beschikbare functies

De website, leesapp, ouderomgeving, support en beheerfallback beschrijven de bestaande dienst. De gratis bibliotheek bevat **13 complete verhalen**, zonder actief betaald abonnement. Fictieve abonnementen, founderskeuzes, gesimuleerde ouderlogin, testtoegang en de proefbetaalmuur zijn uit de normale webflow gehaald. Een oude lokale voorkeur voor beperkte proeftoegang kan de echte gratis leesapp niet meer afsluiten.

`/demo`, ook met oude reviewparameters, verwijst naar `/lezen`. In Supabase-modus verwijst `/ouders` naar `/gezin?ouders=1`; een bewuste lokale installatie houdt werkend lokaal profielbeheer. De leesapp verwijst voor ouderlogin naar de echte `/inloggen`-route. Website en support maken het onderscheid tussen lokale browserprofielen, online gezinsprofielen en de afzonderlijke lokale Android-app duidelijk. Die Android-app is in deze wijziging niet aangepast. Functionele e-mailvoorbeelden, afgeschermde testmails en herkenbare stagingmarkering blijven bruikbaar; historische bewijsbestanden zijn niet herschreven.

De uitgebreide routeregressie controleert de echte links, de legacyredirect en vrije toegang ondanks een oude proefvoorkeur. Een aanvullende mobiele ontwikkelcontrole op zeven routes slaagde zonder horizontale overflow of zichtbare ontwikkel-/proefteksten. Dit lokale bewijs is inmiddels aangevuld met de hieronder beschreven publieke controle op staging.

## Publieke stagingcontrole en uitrolbewijs

De stagingkandidaat heeft ID `003670aad04ecdf761b21627d8624dea50403ae5-45072508682-1`; de productionkandidaat `003670aad04ecdf761b21627d8624dea50403ae5-45072710965-1`. Beide eigen kandidaataudits slagen. Staging is daarna geactiveerd met run `45072723017`, production met run `45072894209`; beide activeringen zijn **SUCCESS**. De gezamenlijke audit van **21:36:06 UTC** bevestigt beide services actief en voor starten bij boot ingeschakeld, met HTTP 200 en exacte nieuwe SHA op loopbackpoorten **4188** en **4189**. De vorige gezonde app/configuratie van bron `538c6b719e372f4dca99cfa2bc824cbf6310f5c1` blijft per doel behouden. De zes bestaande services en configuraties zijn ongewijzigd; de audit meldt **0 failures en 0 warnings**. Zie het [geactiveerde releasebewijs](deploy-evidence/registration-activated-2026-11-22.json). De publieke HTTP/TLS-controle van **21:34:26 UTC** bevestigt correcte certificaatvalidatie, health op exacte SHA, beveiligingsheaders, publieke juridische routes/documenthashes en anonieme weigering van afgeschermde API’s: **23/23 PASS**. Bewijs: [publieke stagingcontrole](deploy-evidence/registration-staging-public-2026-11-22.json).

Na het expliciete activatiesein is de mobiele Chromiumcontrole uitgevoerd op **21:35:16 UTC**, met viewport 390 × 844 en een nieuwe, anonieme wegwerpcontext. Resultaat: **67/67 PASS** op zeven routes: `/`, `/lezen`, `/ouders`, `/demo?surface=studio`, `/inloggen`, `/support` en `/privacyverklaring`. De browser toont geen ontwikkel-/proefteksten, fictieve abonnementsprijzen of horizontale overflow. De **zichtbare** ouderloginlinks in de leesapp en na de echte gezinsredirect wijzen naar `/inloggen`. De homepage heeft daarnaast een geldige desktoploginlink; die desktopnavigatie is op dit mobiele formaat verborgen.

Alle 13 gratis verhalen zijn bereikbaar. De Droompost gaat naar deel 2 met twee vervolgmogelijkheden, ook wanneer de oude beperkte proefvoorkeur als leeswaarde wordt aangeboden. Hiervoor wordt alleen `getItem` in de tijdelijke context onderschept; bestaande browseropslag wordt niet geopend en de historische sleutel wordt niet geschreven. `/ouders` leidt daadwerkelijk naar `/gezin?ouders=1`; de oude reviewroute leidt naar `/lezen` zonder ontwerpbalk. Google staat met geladen icoon onder de OTP-knop. Registratie toont uitsluitend de twee aanvankelijk uitgevinkte ouder-/voorwaardenkeuzes, blokkeert beide providers zolang die ontbreken en verwijst naar privacyversie `2026-11-22.1`.

Het script blokkeert alle niet-GET/HEAD- en externe browserrequests. Er zijn **0 mutatiepogingen, 0 externe/providerrequests en 0 browserfouten** vastgesteld. Geen OTP verstuurd, Google-aanmelding gestart, account gemaakt, servergezinsgegevens gewijzigd of mail verzonden. De gastleesactie raakt uitsluitend tijdelijke lokale gegevens in een wegwerpcontext. Er zijn geen paginacontent, persoonsgegevens, screenshots, traces of credentials in het rapport opgenomen. Het status-/booleansrapport heeft mode **0600**: [publieke browsersmoke](deploy-evidence/registration-staging-public-smoke-2026-11-22.json), bron `/tmp/fabelpad-registration-staging-public-smoke-20261122.json`.

De eerste poging stopte op een scriptlocator die een mobiele, verborgen desktoploginlink als zichtbare link probeerde te vinden. Alleen die locator is gecorrigeerd; er is geen appbron gewijzigd. De leesapp- en gezinsloginlinks zijn daarna afzonderlijk als zichtbare toegang gecontroleerd. De [oorspronkelijke foutmetadata](deploy-evidence/registration-staging-public-smoke-initial-2026-11-22.json) zijn behouden, oorspronkelijk in `/tmp/fabelpad-registration-staging-public-smoke-initial-20261122.json`; de begrensde herhaling slaagt volledig.

De [routingcontrole](deploy-evidence/registration-routing-2026-11-22.json) bevestigt dat zowel de basis-Caddyconfiguratie als de bestaande eigen stagingsnippet bytegelijk zijn gebleven. Er is geen publieke productionroute toegevoegd; de bestaande standaardhostantwoorden zijn ongewijzigd. De nieuwe productionapp draait uitsluitend intern op loopback. Deze release heeft geen productie-HTTPS of DNS-omschakeling uitgevoerd.

De [afsluitende databasecontrole](deploy-evidence/registration-database-final-2026-11-22.json) van **21:36:21 UTC**, na beide appactiveringen, bevestigt opnieuw 11 migraties per project. Staging behoudt één gebruiker, één geldig gezin en één aanvaarding; production heeft daarvan nog nul. Tijdelijke registratiebewijzen en achteraf ingevulde oude registratieverklaringen staan beide op nul. Rechten, actieve onderhoudscron en uitgeschakelde 90-dagenmassawissing blijven zoals gecontroleerd. Er zijn geen persoonsgegevens in dit bewijs opgenomen.

## Open vervolgstappen

1. Bevestig de nieuwe eenmalige registratieflow met een echte OTP-/Google-aanmelding en eventuele API-servicemail afzonderlijk met de eigenaar. Een anonieme paginaweergave of geslaagde synthetische flow bewijst geen nieuwe providerregistratie of aflevering in een echte mailbox.
2. Voer een publieke productioncontrole uitsluitend uit nadat die HTTPS-route afzonderlijk is vrijgegeven. De voorbereide opdracht is `node /tmp/fabelpad-registration-public-smoke-20261122.mjs --release-ready --target=production`; zij is in deze fase niet uitgevoerd.

De lokale build, 43 browsertests, beide CI-runs, kandidaten, appactiveringen, gezamenlijke hostaudit, database-eindcontrole en publieke stagingcontroles zijn afgerond. **Nog open:** de concrete interactieve acceptatieresultaten en een eventuele latere production-HTTPS-vrijgave met haar eigen publieke controle. Dit document claimt geen production-openstelling of voltooide nieuwe provider-/mailacceptatie.
