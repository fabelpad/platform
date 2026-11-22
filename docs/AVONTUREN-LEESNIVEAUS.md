# Avonturen en leesniveaus

Functioneel contract en lokale validatie, 23 november 2026. Dit document beschrijft de geïntegreerde broncode en bundel; het is geen bewijs van een uitgerolde omgeving, geslaagde GitHub-run of Google Play-publicatie.

## Verhalen lezen en kiezen

Alle dertien avonturen bevatten vijf hoofdstukken met precies twee routekeuzes per hoofdstuk. De bestaande verhaal-ID's, keuze-indexen `0` en `1`, gevolgen, eindroutes en aandenkens blijven behouden. Dat geeft 32 volledige routes per avontuur en 416 routes in totaal. Door eerdere keuzes bestaan er 403 hoofdstukvarianten.

De reader toont steeds één kolom: **hero → volledige verhaaltekst → keuzemoment**. De hero gebruikt de bijbehorende bestaande wereldillustratie. De speelprent staat onder de tekst. Na een keuze begint het volgende hoofdstuk bovenaan, vanaf de hero; de toegankelijkheidsfocus volgt de nieuwe hoofdstuktitel. De vijfde keuze opent de afsluiting met het bijbehorende aandenken.

Op web gebruiken de eerste twee hoofdstukken van het Station hun bestaande speelopdrachten: kaartje repareren of kastje openen en instappen, gevolgd door de spoorwissel en treinanimatie. De overige 63 hoofdstukken gebruiken een geïllustreerde scène met twee directe keuzes. De Android-reader gebruikt voor alle 65 hoofdstukken illustraties met twee directe keuzes. De bestaande native Stationsinteractie blijft als afzonderlijk, getest onderdeel beschikbaar; deze wordt niet als extra spelmotor aan de nieuwe native reader gekoppeld.

Bij **Wat kies jij?** wisselt de lezer tussen **Naar leesmodus** en **Naar speelmodus**. Gewone knoppen gebruiken dezelfde keuze-indexen en verhaaltakken als de speelprent. Een moduswissel maakt geen routekeuze, behoudt het hoofdstuk en houdt de scrollpositie vast. Webspelacties die bij sluiten of wisselen nog niet voltooid waren, mogen geen late keuze opslaan.

## Leesniveau per profiel

| Opgeslagen waarde | Zichtbare keuze | Gedrag |
| --- | --- | --- |
| `under6` | 5 jaar en jonger | Meegeleverde tekst met eenvoudiger woorden, kortere zinnen en meer korte alinea's; ook aangepaste hoofdstuktitels en keuzelabels waar meegeleverd. |
| `6to8` | 6 t/m 8 jaar | Standaard voor een profiel zonder geldige opgeslagen voorkeur. |
| `9plus` | 9+ jaar | Oorspronkelijke verhaaltekst. |

De keuze hoort bij het kindprofiel. Tijdens lezen kan het niveau worden gewijzigd zonder de actieve route, het hoofdstuk of de voortgang te wijzigen. Hetzelfde geldt bij teruglezen. De drie varianten behouden dezelfde verhaallijn, keuzevolgorde, gevolgen en aandenkens; het zijn geen drie losse avonturen.

De omvangseis geldt voor een volledige route: de vijf gelezen hoofdstukken plus de afsluiting, vergeleken met dezelfde route in `9plus`. De geautomatiseerde controle telt woorden op witruimte. Alle 416 routes blijven per jonger niveau binnen 95–105% van het origineel. De gemeten bereiken zijn **95,2–101,9% voor `under6`** en **95,7–101,8% voor `6to8`**. Dit zijn technische lengtecontroles; leesbaarheid blijft ook een redactionele beoordeling.

## Voltooide routes, teruglezen en opnieuw beginnen

Een voltooide route kan vanaf hoofdstuk 1 worden teruggelezen. Teruglezen volgt uitsluitend de eerder opgeslagen keuzes en schrijft geen nieuwe routekeuzes of actieve voortgang. Een eventueel ondertussen begonnen nieuw avontuur blijft behouden.

**Een ander pad ontdekken** begint een nieuwe actieve route bij hoofdstuk 1. De laatst voltooide route, bijbehorende verhaalversie en het aandenken blijven apart bewaard, ook tijdens een nieuwe gedeeltelijke route. Een volgende voltooiing vervangt die laatst voltooide route. Deze informatie vormt een mogelijke bron voor toekomstige vervolgverhalen; er is hiermee nog geen vervolgverhaal geactiveerd.

Web bewaart daarvoor onder meer `lastCompletedPicks` en `lastCompletedContentVersion` naast de actieve voortgang. Native bewaart `lastCompletedPicks` en `lastCompletedStoryVersions` per verhaal en profiel. Oudere geldige voltooide native routes krijgen die aanvullende geschiedenis bij het inlezen; een ontbrekende of ongeldige leesniveauvoorkeur wist geen route.

## Bestaande verhaalversies en downloads

Gestarte avonturen blijven gekoppeld aan hun oorspronkelijke contentversie. Bestaande basispayloads, hashes, opgeslagen keuzes en pins worden niet herschreven om leesniveaus toe te voegen. Een onveranderlijke oudere release mag de nieuwe leesniveauweergaven alleen als aanvulling gebruiken wanneer **alle oorspronkelijke scènes, keuzes en eindes exact overeenkomen** met de canonieke `9plus`-bron.

Een afwijkende historische of redactioneel bewerkte versie blijft haar eigen oorspronkelijke tekst tonen. Daar worden geen jongere teksten van een andere versie blind overheen gelegd. Ontbrekende historische releases worden evenmin stilzwijgend vervangen door nieuwe verhaaltekst.

Nieuwe webcontent en downloads bevatten de drie leesniveaus binnen de bestaande download- en toegangsroute. Reeds opgeslagen compatibele basisreleases kunnen de aanvullende leesniveauweergave gebruiken zonder hun bestaande versiepin te veranderen. De downloadcache neemt de benodigde hero's en speelprentbeelden mee. De native app bundelt de teksten, historische releases en afbeeldingen voor gebruik zonder internet.

Naast de bestaande runtimebeelden worden vier geoptimaliseerde WebP-speelprenten gebruikt:

- `/art/play/station-scene.webp`
- `/art/play/dream-scene.webp`
- `/art/play/toy-scene.webp`
- `/art/play/ocean-scene.webp`

De eerste twee Stationshoofdstukken gebruiken `/art/play/station-platform.webp`; overige hoofdstukken volgen `src/storyPlayArt.ts` en de meegeleverde beeld-/spelvormmapping. Waar geen aanvullende prent is opgegeven, wordt de bestaande wereldillustratie gebruikt. De vier originele PNG's uit het pakket zijn bewerkingsbronnen en horen niet bij de runtime-uitrol.

De native export heeft contentversie **`247d7d1c63cc4fa3`**, met twintig gecontroleerde runtimebeelden. De eerder gebundelde release **`4e48e9296a01fff5`** bleef byte voor byte gelijk. `scripts/export-native-content.mjs` bewaart verzonden releases in `mobile/src/releases/`, genereert de releasecatalogus en weigert een gewijzigde afbeelding onder de naam van een bestaande release. Teksten, leesniveaus en assetchecksums bepalen samen de nieuwe contentidentiteit.

## Uitgevoerde controles

De contentcontrole van `scripts/story-reading-levels-check.mjs` is door de contentintegratie uitgevoerd: alle 403 hoofdstukvarianten en 416 eindroutes, op alle drie niveaus. Deze controle verifieert ook keuzevolgorde, ongewijzigde route-arrays, gevolgen, aandenkens, teruglezen zonder invloed van toekomstige keuzes en de bovengenoemde volledige-routelengtes.

De volgende native controles zijn lokaal uitgevoerd met **Node 24.18.0**:

```sh
node scripts/export-native-content.mjs
node scripts/native-runtime-check.mjs
pnpm --dir mobile check
pnpm --dir mobile export:android --output-dir /tmp/fabelpad-native-complete-export-20261123
```

Alle vier zijn geslaagd. De runtimecontrole vergelijkt 1.209 scènes en 1.248 afsluitingen met de webbron, controleert de twintig assetchecksums en onveranderlijke releasehashes, en test onder meer dubbele tikken, Stationsopdrachten, timercleanup, profielhervatten, veilige oude verhaalversies, de vijfde keuze en behoud van de laatst voltooide route. Een tweede contentexport liet `content.json`, `assets.ts`, `releaseCatalog.ts` en de nieuwe release byte-identiek achter.

De Android Metro/Hermes-export bundelde 1.139 modules, twintig beelden en één Hermes-bundel van circa 4,3 MB. Dit is een Android-bundelexport, geen ondertekende AAB of bewijs van installatie op een toestel. **Er is geen toestel- of emulatortest uitgevoerd**; `adb` was niet beschikbaar. Een latere daadwerkelijke toesteltest moet apart worden vastgelegd.

Het aangeleverde pakket is geïntegreerd in de bestaande applicatie. Oude platformconfiguratie, afhankelijkheden, signinginstellingen en deployinrichting uit het pakket zijn niet overgenomen. Account-, toegangs-, download- en voortgangscontracten blijven onderdeel van de bestaande applicatiecontroles.

## Grens bij terugrollen

De database-uitbreiding voor leesvoorkeuren en voltooide routes is additief. Dat betekent niet dat een oude applicatierelease alle nieuwe gegevens al accepteert: de oude webservervalidator kan nieuwe leesvoorkeuren of voortgangsvelden afwijzen.

Rol daarom bij herstel niet uitsluitend de app terug met de aanname dat volledige cloudsynchronisatie daarmee vanzelf werkt. Controleer de validator van de gekozen herstelversie, behoud de opgeslagen gegevens en laat de database-uitbreiding staan. Kies een herstelrelease die het nieuwe contract begrijpt of bereid bewust een compatibele herstelwijziging voor. Dit document claimt geen uitgevoerde live rollback of cloudacceptatietest op een oude appversie.
