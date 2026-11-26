# Blogs en SocialHero in Fabelpad

De blog hoort bij Fabelpads bestaande Studio. De eerste uitrol van deze functie is lokaal en op staging. De omgevingsbewijzen bij de release bepalen welke commit daadwerkelijk actief is; deze handleiding is op zichzelf geen deploymentbewijs.

## Gebruik

- Blogbeheer: `/studio/blog` en `/studio/blog/{postId}`.
- SocialHero: `/studio/integraties/socialhero`, bereikbaar via de Studio-navigatie.
- Publiek: `/blog` en `/blog/{slug}`.
- Privévoorbeeld: `/studio/blog/{postId}/preview`; een optionele `revision` kiest een opgeslagen revisie. De server controleert beheerrechten voordat hij conceptinhoud leest.

Maak een eerste blog met **Nieuw artikel maken**. Kies type, auteur en eventueel categorie, voer titel en samenvatting in en schrijf in de editor. De titel stelt het eerste webadres voor; een gepubliceerd artikel houdt zijn bestaande adres bij titelwijzigingen. Voeg gecontroleerde afbeeldingen toe uit de mediabibliotheek, vul alt-tekst in en verplaats het focuspunt in de omslagpreview. Vul eventueel SEO en de afzonderlijke brede deelafbeelding in. Sla het concept op, open het afgeschermde voorbeeld en publiceer de opgeslagen revisie.

Bewerkingen aan een gepubliceerd artikel maken een afzonderlijke conceptrevisie. Bij een conflict blijven eigen teksten in de editor staan. Haal eerst bewust de opgeslagen status op. Als een eerste opslag geen bevestiging oplevert, gebruik **Opgeslagen artikel zoeken** voordat je opnieuw opslaat. Historische inhoud kan als een nieuwe revisie worden hersteld. Een bewuste wijziging van een live webadres maakt bij publicatie een permanente, directe redirect vanaf alle eerdere adressen.

## Eén koppelcode

Open SocialHero op de bijbehorende omgeving en maak een code voor Fabelpads geregistreerde websitebestemming. Open in Fabelpad **Integraties → SocialHero**. De website en omgeving staan in beeld. Bij een nieuwe bestemming staan conceptlevering en automatisch publiceren beide aangevinkt. De publicatietoestemming vermeldt:

> SocialHero mag artikelen zelfstandig live zetten volgens de campagneplanning en de ingestelde goedkeuringsmodus.

Pas de keuzes zo nodig aan, plak de code en klik **Koppelen**. Daarmee bevestig je de zichtbare rechten. De server handelt de technische credentials af. Een eerdere uitschakeling blijft bij opnieuw koppelen behouden; een bewuste wijziging via **Rechten opslaan** kan die later aanpassen. Uitschakelen werkt direct, inclusief bij nog wachtende publicaties. Toegestane conceptlevering blijft beschikbaar.

Bij een onderbroken koppeling gebruik je **Verbinding controleren**. De server hervat dezelfde nog geldige poging. Een verlopen code vraagt een nieuwe code. De controle van een reeds actieve verbinding beoordeelt de lokale credential en actuele rechten; het gedeelde contract heeft geen afzonderlijke remote-healthroute. **Ontkoppelen** trekt de specifieke credential in en bewaart artikelen en historie.

Laat SocialHero voor de eerste proef een afbeelding uploaden en een artikel met een vaste externe ID als concept sturen. Het verschijnt in hetzelfde blogoverzicht. SocialHero kan de expliciete publicatieroute met de actuele revisie zelf aanroepen; er volgt geen extra akkoordactie in Fabelpad. Planning en goedkeuring worden in SocialHero beheerd.

## Publicatie en herstel

Een publicatie blijft in verwerking totdat de echte openbare pagina de bedoelde revisie en het bijbehorende bewijs toont. Een HTTP 200 alleen bevestigt niets. Het overzicht en de editor tonen status, revisie en het laatste publicatieresultaat. Bij tijdelijke vertraging probeert de eigen worker opnieuw, met maximaal acht pogingen en oplopende wachttijd. Controleer bij een blijvende fout de opgeslagen foutcode en pas de oorzaak aan voordat je opnieuw publiceert. Een ingetrokken toestemming of verouderde revisie wordt niet vanzelf alsnog gepubliceerd.

`REVISION_CONFLICT` vraagt het ophalen van de huidige revisie; `PERMISSION_DENIED` vraagt controle van de actuele rechten; `SLUG_CONFLICT` vraagt een ander webadres. Een verlopen recente aanmelding vraagt opnieuw inloggen. Support kan een fout volgen via het request-ID; geef geen koppelcodes of tokens door.

## Vaste omgevingen

| Instelling | Staging | Productie |
| --- | --- | --- |
| Website-origin | `https://staging.fabelpad.nl` | `https://fabelpad.nl` |
| Supabaseproject | `tlwfpivafcokcjyjwgmq` | `aptprpkosqctwrzeetgs` |
| SocialHero-origin | `https://socialhero-staging.dgwebservices.nl` | `https://socialhero.dgwebservices.nl` |
| SEO-canonicalorigin | `https://fabelpad.nl` | `https://fabelpad.nl` |
| Site-ID / blogpad | `fabelpad` / `/blog` | `fabelpad` / `/blog` |

Staging heeft eigen data, assets en credentials en blijft noindex. `publicUrl` gebruikt altijd de werkelijke omgevingsorigin. De productiesitemap bevat alleen actuele live artikelen. De routes lezen bij ieder verzoek de actuele live revisie zonder persistente datacache; publiceren vereist daardoor geen herbuild of handmatige revalidatiehook.

Next gebruikt uitsluitend de bestaande publieke Supabaseconfiguratie en eigen site-origin. Edge gebruikt `FABELPAD_ENVIRONMENT`, `FABELPAD_APP_ORIGIN` en de bestaande servercredentials van Supabase. De private bucket heet `fabelpad-blog`; zijn eigen cronworker gebruikt een automatisch gegenereerde Vault-HMAC. Er komen geen servicecredentials in de browser of in GitHub-webvariabelen.

## Installatie en verificatie

Volg het [connectorcontract](BLOG-SOCIALHERO-CONNECTOR.md) en [installatievoorbeeld](../examples/socialhero-blog/README.md). Pas de additieve blogmigratie eerst op het bedoelde project toe, deploy het gecontroleerde Edgepakket, voer de expliciete stagingbootstrap uit en volg daarna het bestaande candidate-/activateproces. Bewaar de actieve app/config-combinatie vóór en na de uitrol. Laat bestaande content-, gezins-, betaal-, mail- en audiogegevens intact.

`pnpm check:blog` draait echte domein-, renderer-, transport-, SQL- en controllerintegratietests. `tests/browser/blog-admin.spec.ts` gebruikt de echte editor en UI met een expliciet onderschepte test-API. PGlite en een lokale SocialHero-testserver bewijzen de lokale protocol- en transactielogica. Deze proeven gelden niet als een echte gekoppelde SocialHero-campagne. Hosted Edge, openbare HTML, media, redirects, rechten en de werkelijke stagingversie krijgen afzonderlijk releasebewijs.
