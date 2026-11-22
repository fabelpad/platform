# Fabelpad — leeftijdsaanduidingen

Datum: **22 november 2026**. Geteste appbron op `main`: **`d2d8d3e3667d636ad6352bf8c6dca0108e7d2fd9`**, repository `fabelpad/platform`.

**Status:** de schone lokale build, beide verplichte CI-controles, beide VPS-kandidaten en beide appactiveringen zijn geslaagd. Staging en production draaien de exacte nieuwe bron, met gezonde loopbackhealth en starten bij boot ingeschakeld. Staging is publiek gecontroleerd: **23/23 HTTP/TLS-controles** en **39/39 browsercontroles** slagen. Production blijft uitsluitend intern bereikbaar; publieke productionrouting is niet geactiveerd. Zie het [gezamenlijke releasebewijs](deploy-evidence/faqage-release-2026-11-22.json).

## Wijziging

De websitehero en de dertien verhaalkaarten tonen geen leeftijdsaanduiding meer. Alleen de website-FAQ geeft als richtlijn **ongeveer 3 tot 10 jaar**, met uitleg over samen ontdekken en zelfstandig lezen. De aanduiding **5 delen** op verhaalkaarten blijft behouden: dit is het aantal verhaaldelen.

De bronwijziging betreft vijf bestanden: twee TSX-bestanden, `README.md`, `docs/GOOGLE-PLAY-INVULBLAD-PRODUCTIE.md` en `docs/GOOGLE-PLAY-RELEASE-RUNBOOK.md`. Vrije Store- en promotieteksten bevatten geen leeftijdsaanduiding; de externe screenshotbriefing volgt dit ook. De verplichte interne Play Console-doelgroepkeuzes blijven afzonderlijk onderbouwd met **5 jaar en jonger**, **6-8 jaar** en **9-12 jaar**. De [officiële doelgroepinstructies](https://support.google.com/googleplay/android-developer/answer/9867159?hl=nl) zijn op 22 november 2026 gecontroleerd; geschiktheid voor de geselecteerde groepen en IARC blijven afzonderlijke acceptatiecontroles.

## Uitgevoerde controles

| Controle | Resultaat / begrenzing |
| --- | --- |
| Schone lokale installatie en normale build | [**PASS**, 41,4 seconden](deploy-evidence/faqage-local-validation-2026-11-22.json); afzonderlijke `git archive`, frozen lockfile, Node **24.18.0**, pnpm **11.25.0**, Next **16.3.4** |
| Tijdelijke lokale browsercontrole | [**39/39 PASS**](deploy-evidence/faqage-local-browser-2026-11-22.json); desktop en mobiel op `/` en `/lezen`; FAQ-richtlijn uitsluitend daar, leeftijdsvrije hero en dertien kaarten, **5 delen** behouden, geen horizontale overflow |
| Browserneveneffecten | Geen browserfouten, externe requests, accountacties of mutaties; tijdelijke server na afloop gestopt |
| Web-CI | [45075010480](https://github.com/fabelpad/platform/actions/runs/45075010480): **SUCCESS** op de exacte bron |
| Native-CI | [45075010469](https://github.com/fabelpad/platform/actions/runs/45075010469): **SUCCESS** op de exacte bron; geen Play-upload |
| Stagingkandidaat / appactivering | [45076337234](https://github.com/fabelpad/platform/actions/runs/45076337234) / [45076570283](https://github.com/fabelpad/platform/actions/runs/45076570283): beide **SUCCESS**; configuratie `faqage-20261122-stg`; [kandidaataudit PASS](deploy-evidence/faqage-staging-candidate-2026-11-22.json) |
| Productionkandidaat / appactivering | [45076551688](https://github.com/fabelpad/platform/actions/runs/45076551688) / [45076812862](https://github.com/fabelpad/platform/actions/runs/45076812862): beide **SUCCESS**; configuratie `faqage-20261122-prd`; [kandidaataudit PASS](deploy-evidence/faqage-production-candidate-2026-11-22.json) |
| Gezamenlijke hostcontrole | [Geactiveerde audit PASS](deploy-evidence/faqage-activated-2026-11-22.json), **0 failures en 0 warnings**; beide apps gezond op poorten **4188/4189**, zes bestaande services en configuraties ongewijzigd |
| Publieke stagingcontrole | [**23/23 HTTP/TLS PASS**](deploy-evidence/faqage-staging-public-2026-11-22.json) en [**39/39 browser PASS**](deploy-evidence/faqage-staging-browser-2026-11-22.json); exacte nieuwe bron, desktop en mobiel, uitsluitend alleen-lezen controles |
| Routing | [**PASS**](deploy-evidence/faqage-routing-2026-11-22.json); bestaande stagingproxy en standaardhostantwoorden ongewijzigd, publieke productionroute blijft afwezig |

Er zijn geen nieuwe blijvende tests toegevoegd. De native app, migraties, bestaande gebruikersgegevens, onveranderlijke juridische documentversies en opgeslagen Play Console-formulieren zijn niet gewijzigd. Historische bewijsbestanden blijven behouden. De Storeteksten zijn opnieuw geteld: naam **8/30**, korte beschrijving **73/80**, volledige beschrijving **1332/4000** en releaseopmerkingen **261/500** Unicode-tekens.

De [releasegegevens](deploy-evidence/faqage-release-2026-11-22.json) binden de kandidaten aan de exacte SHA, configuratie en geslaagde workflowruns. De vorige gezonde app `003670aad04ecdf761b21627d8624dea50403ae5` en haar bijbehorende `regprof`-runtimeconfiguratie blijven per omgeving beschikbaar voor herstel; een live rollback is niet uitgevoerd. Deze tekstwijziging heeft geen database- of provideractie nodig. Production-HTTPS blijft een afzonderlijke vrijgavestap; de publieke stagingcontroles bewijzen geen nieuwe OTP-/Google-aanmelding of mailaflevering.
