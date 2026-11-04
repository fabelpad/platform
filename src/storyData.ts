import type { StoryChoice, StoryScene, StoryEnding } from './storyTypes';
import { newStories } from './newStories';
import { worlds } from './worlds';
export type { StoryChoice, StoryScene, StoryEnding } from './storyTypes';
export const storyTitles: Record<string, string> = Object.fromEntries(worlds.map(world => [world.id, world.title]));
const c = (label: string, hint: string, icon: StoryChoice['icon']): StoryChoice => ({ label, hint, icon });

export function getScene(world: string, step: number, picks: number[], name: string): StoryScene {
  const hero = name.trim() || 'Avonturier';
  if (Object.hasOwn(newStories, world)) return newStories[world].scenes(picks, hero)[Math.max(0, Math.min(step, 4))];
  if (world === 'dream') {
    const helper = picks[0] === 0 ? 'Melle de mol' : 'Fien de vliegende vis';
    const first = picks[1] === 0 ? 'de beer' : 'het maantje';
    return [
      { title: 'Een pakketje vol dromen', text: `Tik, tik! Voor het raam zweeft een uiltje met een veel te grote posttas. ‘${hero}, ik ben Pippa. Er zit een droom verkeerd in de post!’ Uit haar tas klinkt zacht gesnurk, gevolgd door een trompet. Iemand heeft vannacht misschien wel een heel gekke droom.

Pippa landt op de vensterbank en spreidt een kaartje uit. De straten zijn getekend met zilveren stipjes. Waar haar vleugel het papier aanraakt, zweeft een klein huisje omhoog. ‘Hier hoort een droom over honingbloemen,’ vertelt ze. ‘Maar in het pakje danst een onderbroek.’ De tas hikt en een piepklein muzieknootje ontsnapt. Je vangt het in Pippa’s lege envelop. Ze lacht opgelucht.

Op de kaart verschijnen twee wegen. Onder de boomwortels begint een knusse tunnel, verlicht door kleine lampjes. Daarboven ligt een brug van regenbooglicht die rustig tussen de wolken slingert. Bij beide wegen staat een vriendelijke wegwijzer. Pippa trekt haar tas recht. ‘Welke route zullen we proberen?’`, choices: [c('Door de mollentunnel', 'Misschien weet iemand onder de grond de weg.', 'leaf'), c('Over de regenboogbrug', 'Volg de kleuren tot boven de wolken.', 'sparkles')] },
      { title: 'Wie krijgt de eerste droom?', text: `${helper} komt met jullie mee. ‘Ik ken een geheime weg,’ fluistert ${picks[0] === 0 ? 'hij' : 'ze'}. Bij een splitsing trilt Pippa’s tas. De beer ligt wakker omdat zijn droom verdwenen is. Maar het maantje heeft een droom over dansende onderbroeken gekregen en kan niet stoppen met giechelen!

Pippa zet de tas op een zacht bankje en zoekt de adreskaartjes. Op het ene staat een honingpot, op het andere een halve maan. ‘De plaatjes kloppen nog,’ zegt ze. ‘Alleen de dromen zijn verwisseld.’ ${helper} houdt de kaartjes naast de pakjes. Wanneer het maankaartje in de buurt komt, klinkt er een giechel. Bij de honingpot hoor je een lange, slaperige zucht.

Je ziet de twee bestemmingen in de verte. Het raam van de beer brandt warmgeel. Het maantje schommelt boven een wolk en probeert heel hard serieus te kijken. Dat lukt telkens maar even. Pippa bewaart beide pakjes zorgvuldig. ‘Iedereen komt aan de beurt. Wie zullen we eerst helpen?’`, choices: [c('Eerst naar de beer', 'Breng zijn fijne droom terug.', 'heart'), c('Eerst naar het maantje', 'Zoek uit waar dat gegiechel vandaan komt.', 'moon')] },
      { title: 'Oeps! Dromen op de vlucht', text: `Bij ${first} gaat het strikje van een pakket los. Floep! Zes glinsterende droombellen zweven weg. In eentje rijdt een slak op rolschaatsen; in een andere groeit een ijsje tot aan de sterren. Pippa wappert haastig met haar vleugels. ${helper} ziet een grote bel steeds verder wegdrijven.

De slak in de kleinste bel zwaait rustig naar beneden. Hij lijkt helemaal niet te merken dat zijn droom op stap is. Je houdt een lege envelop omhoog, maar de bel is veel te rond om erin te passen. ‘Niet knijpen,’ zegt Pippa zacht. ‘Dromen houden van ruimte.’ Ze maakt de opening van haar tas extra wijd.

Op het plein staan twee sterrenstokjes naast een zacht bankje. Pippa heeft ook een lange sjaal bij zich. Daarmee zou je een vriendelijk vangnet kunnen maken. Tegelijk bewegen de kleine bellen op het ritme van haar neuriën. Misschien luisteren ze naar muziek. De grootste bel drijft naar de rand van het plein. Jullie kiezen samen één slim plan.`, choices: [c('Zing de dromen terug', 'Een zacht liedje lokt ze misschien dichterbij.', 'music'), c('Maak een droomvangnet', 'Gebruik Pippa’s sjaal en twee sterrenstokjes.', 'compass')] },
      { title: 'De droom die niet wilde slapen', text: `${picks[2] === 0 ? 'De kleine bellen wiegen op jullie liedje terug de tas in. De slak maakt nog één sierlijk rondje op zijn rolschaatsen voordat zijn bel tussen de andere dromen landt.' : 'Jullie zachte vangnet houdt alle kleine droombellen voorzichtig tegen. Pippa schuift haar tas eronder en laat ze één voor één naar binnen rollen.'} Alleen de grootste bel blijft hoog boven het plein zweven. ‘Ik ben nog niet klaar!’ piept de droom. In de bel zie je een verdrietige tuin zonder bloemen.

Pippa gaat onder de bel staan. ‘Wat ontbreekt er dan?’ vraagt ze. De tuin laat een kaal bankje en een leeg bloembed zien. Er hangt een schommel die heel zacht beweegt, hoewel niemand erop zit. De droom zoekt blijkbaar nog iets om te laten groeien.

${helper} steekt voorzichtig een pootje op. ‘Ik denk dat ik kan helpen.’ Langs de rand van de bel verschijnt een glinsterend deurtje, groot genoeg om doorheen te kijken. Jij kunt samen met je reisgenoot zoeken, of zelf even ontdekken wat de tuin nodig heeft. Pippa blijft bij de ingang wachten.`, choices: [c(`Vraag ${helper.split(' ')[0]} om hulp`, 'Samen kun je meer dan alleen.', 'heart'), c('Stap zelf de droom in', 'Ontdek wat de tuin nodig heeft.', 'sparkles')] },
      { title: 'Een wens voor de nacht', text: `${picks[3] === 0 ? `${helper} helpt je een klein droomzaadje te vinden. Samen kijken jullie onder het bankje, waar een warm stipje licht tussen twee planken schijnt.` : 'Tussen de kale takken ontdek je een klein droomzaadje. Het ligt op een blad dat als een kommetje naar de zon is gekeerd.'} Zodra je het aanraakt, komt er een warm lichtje uit. Pippa glimlacht: ‘Daarom wilde deze droom niet weg. Hij wilde eerst iets moois worden.’

Het zaadje past precies in je hand. Door het glanzende velletje zie je heel even een bloem, dan een boom en daarna een bankje met plaats voor vrienden. De droomtuin ritselt tevreden. ‘Het kan op verschillende plekken groeien,’ vertelt Pippa. ‘We hoeven alleen een fijne plek te kiezen.’

Buiten de bel staan de andere pakketjes veilig in haar tas. De adressen hangen weer aan de goede strikjes. Voor het zaadje kun je een nieuwe tuin maken waar alle slapers op bezoek mogen. Je kunt het ook aan ${first} geven, zodat die droom een heel eigen bijzonder plekje krijgt.`, choices: [c('Plant een tuin voor iedereen', 'Laat alle slapers samen komen dromen.', 'leaf'), c(`Geef het zaadje aan ${first}`, 'Maak één droom extra bijzonder.', 'heart')] },
    ][Math.min(step, 4)];
  }
  if (world === 'toy') {
    const friend = picks[0] === 0 ? 'Bram de beer' : 'Nola het konijn';
    return [
      { title: 'Er beweegt iets naast je bed', text: `‘Pssst, ${hero}!’ Een klein knuffelkonijn trekt aan je deken. Op het vloerkleed ligt een papieren boot. De kapitein is zijn lichtje kwijt, en zonder dat lichtje vindt hij de speelgoedhaven niet terug. Bram de beer staat al klaar met een rugzak. Nola het konijn heeft een zelfgemaakte verrekijker.

De kapitein zwaait vanaf een luciferdoosje dat nu een stuurhut is. ‘De haven hoort vlak bij de boekenkast te liggen,’ vertelt hij. ‘Maar alle kussens lijken vannacht eilanden.’ Hij laat een klein rond houdertje zien. Daarin past precies het verdwenen lichtje.

Bram heeft een zachte sjaal, een zakdoek en twee stukjes touw ingepakt. Hij zet de rugzak alvast in de boot, zodat alle spullen met iedere reisgenoot mee kunnen. Nola kijkt door haar verrekijker naar de blauwe strepen in het kleed. Ze denkt dat die de weg naar het water wijzen. Beide knuffels willen helpen. Er is naast jou nog één fijn zitplekje in de boot; de andere vriend blijft bij het vertrekpunt om jullie straks weer te begroeten. Wie wordt jouw reisgenoot?`, choices: [c('Bram de beer', 'Sterk, rustig en dol op knuffels.', 'heart'), c('Nola het konijn', 'Nieuwsgierig, snel en vol ideeën.', 'sparkles')] },
      { title: 'De zee van het vloerkleed', text: `${friend} klimt naast je in de boot. Zodra jullie het zeiltje hijsen, worden de blauwe strepen van het vloerkleed echte golven. Bij de boekenkast verdwijnt het licht van de haven. Voor jullie ligt een brug van kleurpotloden, maar er drijft ook een enorme pantoffel voorbij. ‘Die kan ons ook naar de overkant brengen,’ zegt ${friend.split(' ')[0]}.

De papieren boot dobbert tegen een klein eiland van een opgevouwen trui. Jullie stappen er even op om rustig rond te kijken. Aan de andere kant van een smalle waterstrook staat een stoel. Daarachter zou de haven moeten liggen. Een rood potlood rolt tot aan je voeten. Je reisgenoot legt het naast twee andere potloden; samen zijn ze lang genoeg voor een stevig bruggetje.

De pantoffel komt ondertussen langzaam langs. In het zachte voetbed is genoeg plaats om veilig te zitten. ${friend.split(' ')[0]} houdt de boot aan een touw vast, zodat die straks met jullie mee kan. De kapitein kijkt nieuwsgierig toe. Welke oversteek kiezen jullie?`, choices: [c('Bouw een potlodenbrug', 'Maak een pad waar je later weer over kunt.', 'compass'), c('Vaar met de pantoffel', 'Een zacht schip voor een bijzondere tocht.', 'leaf')] },
      { title: 'Een verdrietig monstertje', text: `${picks[1] === 0 ? 'Jullie brug kraakt een beetje, maar houdt stevig stand. Het laatste potlood ligt precies op de rand van het kleed, waar je samen rustig van de brug stapt.' : 'De pantoffel dobbert rustig langs de kast. Je reisgenoot gebruikt een kartonnen kaartje als peddel en legt zacht aan bij een stoelpoot.'} Onder een stoel snikt een piepklein sokkenmonster. ‘Iedereen denkt dat ik sokken opeet. Maar ik zoek alleen een slaapzak!’ Naast hem glinstert iets dat op het verloren havenlicht lijkt. Hij houdt het voorzichtig vast om minder bang te zijn.

Het monstertje laat een leeg luciferdoosje zien. Daarin wilde hij slapen, maar zijn staart steekt eruit. ‘Dan krijg ik koude tenen,’ zegt hij. Hij heeft er heel veel, allemaal even klein. ${friend.split(' ')[0]} gaat naast hem zitten en vraagt hoe zijn fijnste slaapplek eruit zou zien.

De zakdoek uit de rugzak is zacht en ruim genoeg om een slaapzak te worden. In de boot is ook nog een klein plekje naast jullie. Het monstertje kijkt van de zakdoek naar de boot. Wat stellen jullie voor?`, choices: [c('Maak een slaapzak voor hem', 'Een zakdoek is precies groot genoeg.', 'heart'), c('Neem hem mee op reis', 'Misschien is samen zijn nog fijner.', 'sparkles')] },
      { title: 'De slapende reus', text: `${picks[2] === 0 ? 'Het sokkenmonster kruipt blij in zijn nieuwe slaapzak en geeft je het lichtje. Hij probeert alle tenen tegelijk warm te houden en zwaait jullie vanuit zijn zachte huisje uit.' : 'Het sokkenmonster kruipt bij jullie in de boot en houdt het lichtje hoog. Zijn staart ligt netjes langs het randje, zodat iedereen genoeg zitruimte heeft.'} Maar tussen jullie en de haven ligt een enorme slapende teddybeer. Bij elke snurk rolt er een golf over het kleed.

${friend.split(' ')[0]} laat het bootje rustig achter een kussen wachten. De beer heeft zijn kop op een opgevouwen deken gelegd. Zijn poot ligt precies over het smalle paadje naar de boekenkast. Aan zijn trui bungelt een belletje dat bij elke ademhaling heel zacht tingelt.

Je reisgenoot denkt diep na. De reus ziet er vriendelijk uit, alleen heel slaperig. Misschien kan een rustig lied hem helpen om zich wat prettiger neer te leggen. Je kunt ook zachtjes vragen of hij een beetje ruimte wil maken. Er moet een vriendelijke manier zijn om verder te komen.`, choices: [c('Zing een zacht slaaplied', 'Laat de reus rustig verder dromen.', 'music'), c('Vraag beleefd of je erlangs mag', 'Misschien helpt de reus jullie wel.', 'heart')] },
      { title: 'Het licht van de haven', text: `${picks[3] === 0 ? 'De reus ontspant en draait zich zachtjes om. Er ontstaat een rustig paadje. Zijn belletje tingelt nog één keer, alsof hij jullie in zijn slaap een goede reis wenst.' : 'De reus opent één oog, glimlacht en tilt jullie voorzichtig over zijn poot. Daarna legt hij een hoekje van zijn deken als een zachte aanlegsteiger neer.'} In de speelgoedhaven juichen de knuffels. Het lichtje past precies in de kleine vuurtoren.

De kapitein draait het lampje vast. Een warme lichtbundel glijdt over het kleed, langs de stoelen en tot aan je bed. De haven blijkt verstopt achter een rij prentenboeken. Onder de steiger staan kleine mandjes voor reizigers die even willen uitrusten.

${friend.split(' ')[0]} wijst naar een lege plek naast de toren. Er liggen viltlapjes, kussentjes en een doosje met bouwstukjes klaar. ‘Wat zullen we achterlaten, zodat niemand hier ooit nog verdwaalt?’ vraagt je vriend. Jullie kunnen een blijvende route naar de slaapkamer maken. Er is ook ruimte voor een gezellig huis waar nieuwe knuffelvrienden welkom zijn.`, choices: [c('Een veilige weg naar huis', 'Verbind de haven met jullie slaapkamer.', 'compass'), c('Een huis voor nieuwe vrienden', 'Iedere knuffel is hier welkom.', 'heart')] },
    ][Math.min(step, 4)];
  }
  const friend = picks[0] === 0 ? 'Dibbel het draakje' : 'Vos de conducteur';
  return [
    { title: 'Een station voor je slaapkamer', text: `Wanneer ${hero} het gordijn opzij schuift, staat er een station tussen de bloemen. ‘Instappen!’ roept een vos met een scheve conducteursmuts. ‘We zijn onze bestemming kwijt.’ Naast de trein zit een klein draakje met een gescheurd kaartje. Onder het bankje schittert ondertussen een gouden sleutel. De trein kan nog heel even wachten.

Je stapt het perron op. De planken voelen warm in de ochtendzon en ergens ruikt het naar appelbroodjes. Op een bord draaien de letters langzaam rond, maar er verschijnt geen plaatsnaam. De vos stelt zich voor als Vos, de conducteur. Hij houdt zijn fluitje nog even stil.

Het draakje heet Dibbel. Hij laat zien dat de scheur precies door zijn getekende stoeltje loopt. ‘Zonder heel kaartje weet ik niet waar ik mag zitten,’ zegt hij zacht. Aan de rand van het kaartje zit nog een klein, leeg hoekje voor een sticker. Dan glinstert de sleutel opnieuw onder de bank. Misschien hoort hij bij het kastje naast de stationsklok. Jij mag kiezen waar jullie beginnen.`, choices: [c('Help het kleine draakje', 'Misschien wil hij met je meereizen.', 'heart'), c('Onderzoek de gouden sleutel', 'Waar zou die op passen?', 'compass')] },
    { title: 'Twee sporen, één avontuur', text: `${picks[0] === 0 ? 'Je plakt het kaartje van Dibbel met een sterrensticker. Hij straalt en springt naast je aan boord. De sticker houdt de twee helften stevig bij elkaar. Dibbel bewaart het kaartje in het borstzakje van zijn kleine reisjas.' : 'De sleutel past op een verstopt kastje. Binnenin vind je een kaart met bewegende spoorlijnen. Zodra Vos haar voorzichtig uitvouwt, schuiven de lijntjes tot aan de rand en begint een kleine trein over het papier te rijden.'}

De deuren gaan dicht met een vriendelijk klikje. Vos blaast op zijn fluit en de trein zet zich rustig in beweging. Door het raam zie je bloemen langs de wielen glijden. De stationsklok zwaait met zijn wijzers alsof hij jullie uitwuift. Dan tuft de trein naar een splitsing.

Links klinkt muziek uit een wolkenbos. Tussen de bomen zweven vrolijke noten, groot genoeg om met je ogen te volgen. Rechts lichten kleine lantaarns op tussen de heuvels. Ze knipperen één voor één een paadje aan. Vos remt bij een grote wisselhendel. ‘Jij mag de wissel omzetten,’ zegt hij. Welk spoor roept jou?`, choices: [c('Volg de muziek', 'Ontdek wie er tussen de wolken zingt.', 'music'), c('Volg de lantaarns', 'Kijk waar het gouden licht naartoe gaat.', 'sparkles')] },
    { title: 'De wolk met de hik', text: `${picks[1] === 0 ? 'De muziek komt van zingende bloesembomen. Ze wiegen op de maat van de trein. Wanneer een bloem opengaat, klinkt er een nieuwe noot tussen de takken.' : 'De lantaarns wijzen naar een klein station boven op een heuvel. Hun warme licht valt in ronde vlekken op het perron. Bij de laatste lamp staat een bankje voor kleine reizigers.'} Maar plotseling: HIK! Een grote wolk niest het volgende stuk spoor omhoog. ${friend} kijkt verbaasd naar de zwevende rails.

De wolk bloost. ‘Sorry, ik heb een kriebel in mijn neus.’ Bij elke hik stuitert een klein plukje mist op en neer. Vos zet de rem stevig vast. Het spoor zweeft vlak voor jullie als een slinger boven een feesttafel.

Op het bankje staat een theepot met een getekend zonnetje. Ernaast ligt een liedboek waarvan de bladzijden zacht ritselen. De wolk probeert stil te zijn, maar zijn volgende hik klinkt al als een piepklein trompetje. ‘Wat fijn dat jullie even wachten,’ zegt hij. Misschien helpt een vrolijk lied, of juist een warme kop wolkenthee. Hoe helpen jullie hem?`, choices: [c('Kriebels wegzingen', 'Een vrolijk liedje helpt misschien.', 'music'), c('Breng hem een wolkenthee', 'Warm water met een druppel zonneschijn.', 'heart')] },
    { title: 'Een bericht tussen de sterren', text: `${picks[2] === 0 ? 'De wolk zingt mee, vergeet zijn hik en laat het spoor zachtjes zakken. Zijn laatste noot blijft nog even als een zilveren kringetje boven de trein hangen.' : 'De warme thee helpt meteen. De wolk blaast voorzichtig de rails weer op hun plek. Hij houdt het lege kopje tegen zijn wang en glimlacht opgelucht.'} Vos bedankt hem met een vriendelijk fluitje. De trein kan weer verder.

In het volgende station hangt een briefje: ‘Wie het verdwaalde station zoekt, moet luisteren naar wat het mist.’ ${friend} denkt even na. Het perron is netjes geveegd, maar er staat niemand te wachten. Alleen een lege bloempot beweegt zacht op de wind.

Je hoort een ver geluid. Het komt en gaat, alsof iemand ergens met een heel klein lepeltje tegen glas tikt. Tegelijk vormen de sterren boven jullie een pijl. Op de grond liggen twee glanzende steentjes, één onder het briefje en één onder de sterrenpijl. Vos kijkt van jou naar het raam. Misschien kan het geluid jullie iets vertellen; misschien wijst de hemel een nieuwe weg.`, choices: [c('Luister naar het verre geluid', 'Misschien roept iemand het station.', 'music'), c('Volg de sterrenkaart', 'Een hemel vol kleine aanwijzingen.', 'compass')] },
    { title: 'De allerlaatste wissel', text: `${picks[3] === 0 ? 'Het geluid blijkt het tikken van jullie eigen stationsklok. Hij mist zijn reizigers! Op het perron verschijnen kleine voetstappen die naar de verlaten bankjes teruglopen.' : 'De sterren wijzen de weg naar een vergeten perron, precies achter de maan. De sterrenpijl wordt steeds breder, tot jullie een bankje tussen glanzende bloemen zien.'} Vos remt. ‘Nu begrijp ik het. Ons station zoekt een plek waar iedereen welkom is.’

Hij zet de deur open en laat de frisse lucht binnen. Op het perron staat een lege stationsnaam boven een warme lamp. De trein heeft zijn bestemming niet zomaar verloren: er wacht nog een nieuwe plek op een naam en op reizigers.

${picks[0] === 0 ? 'Dibbel denkt aan de draakjes die nog nooit met een trein zijn geweest. Hij tekent met zijn vinger een extra breed bankje op het beslagen raam.' : 'Op je gouden kaart verschijnt een nieuw spoor naar de sterren. Langs dat spoor lichten kleine rustplekjes op, alsof de kaart alvast mogelijkheden laat zien.'} Vos houdt de laatste wissel voor je vrij. Jullie kunnen een nieuwe bestemming maken, of het station terugbrengen naar huis. Jij mag kiezen waar de reis eindigt.`, choices: [c('Nog één nieuwe bestemming', 'Maak een plek voor nieuwe avonturen.', 'sparkles'), c('Breng het station naar huis', 'Een magisch station voor de hele buurt.', 'heart')] },
  ][Math.min(step, 4)];
}

export function getEnding(world: string, picks: number[], name: string): StoryEnding {
  const hero = name.trim() || 'Avonturier';
  if (Object.hasOwn(newStories, world)) return newStories[world].ending(picks, hero);
  if (world === 'dream') {
    if (picks[4] === 0) return { title: 'De tuin van duizend dromen', text: `Uit jouw zaadje groeit een tuin waar iedereen welkom is. Eerst komt er één blaadje, dan een slinger van bloemen en tenslotte een boom met ruimte voor een heel zacht bankje. De beer rust onder de bloeiende takken en het maantje vertelt zachtjes een grap.

Pippa hangt een piepklein bordje aan de poort: ‘Geplant door ${hero}.’ ${helperName(picks)} helpt de eerste bezoekers om een fijn plekje te vinden. De kleine slak uit de droombel rolt langzaam langs het pad en parkeert zijn rolschaatsen bij de ingang. Niemand hoeft zich te haasten.

Pippa geeft je een glinsterend droomzaadje om deze nacht te onthouden. Het licht op wanneer de tuin nog één keer zacht ritselt. Elke nacht is hier een nieuwe droom te vinden, en voor jou blijft er altijd een plekje tussen de bloemen vrij.`, keepsake: 'Een glinsterend droomzaadje' };
    if (picks[1] === 0) return { title: 'De beer die weer kon dromen', text: `De beer plant het zaadje naast zijn bed. Hij maakt met zijn grote poot een heel klein kuiltje en legt er voorzichtig een dekentje van aarde overheen. Er groeit meteen een zachte honingbloem, precies op de hoogte van zijn kussen.

Als de beer zijn ogen sluit, droomt hij van een wereld vol honingbloemen. Zijn gesnurk klinkt nu als een tevreden melodietje. Pippa hangt het goede adreskaartje aan het lege droompakje en legt het op zijn nachtkastje. Zo kan ze deze bijzondere bezorging altijd terugvinden.

Voor jullie vertrekken, plukt de beer een bloem die helemaal van droomlicht is gemaakt. Pippa stopt het kleine bedankje in je hand. De beer zwaait slaperig met één poot. De volgende keer dat hij droomt, mag jij weer op bezoek.`, keepsake: 'Een zachte honingbloem' };
    return { title: 'Het geheime maantuintje', text: `Op de maan groeit een heel klein tuintje. De bloemen geven geen geur, maar vrolijke droompjes. Uit de eerste bloem komt een zeepbel met een dansend kussentje. De tweede bloem laat een klein wolkenbootje zien. Het maantje zet voorzichtig een bankje tussen de bloembedden.

Het bedankt je met een zilveren knipoog. ‘Dit is voortaan ook jouw plekje, ${hero}.’ Pippa neemt een laatste kijkje naar de adreskaartjes. Alle pakjes hebben hun goede bestemming weer gevonden en de tas klinkt eindelijk rustig.

Het maantje geeft je een zilveren maanbloem als herinnering. Wanneer Pippa je terug naar je bed brengt, schijnt er nog een zacht streepje licht op je gordijn. In de verte wiegt het bankje in de tuin. Alles staat klaar voor een fijne droom, precies op tijd voor de nacht.`, keepsake: 'Een zilveren maanbloem' };
  }
  if (world === 'toy') {
    if (picks[4] === 0) return { title: 'Het pad dat bleef bestaan', text: `Je maakt een veilige route van de haven naar je bed. Kleine viltvlaggetjes wijzen de weg langs de stoelen. ${picks[1] === 0 ? 'De potlodenbrug wordt het mooiste stukje van de hele weg. Elk potlood krijgt een vast plekje, zodat ook kleine knuffelvoetjes er goed overheen kunnen.' : 'De pantoffel wordt de vaste veerboot. De kapitein maakt aan beide kanten een zachte aanlegplaats met een touwtje om de boot stil te houden.'}

Het vuurtorenlicht glijdt rustig over de hele route. Voor het vertrek legt de havenmeester een gouden havenkompas in je hand. De wijzer draait één rondje en blijft naar je kussen wijzen.

Voortaan hoeft geen knuffel meer bang te zijn om te verdwalen. Je reisgenoot vaart nog een stukje met je mee. Voor je in slaap valt, hoor je heel zacht: ‘Dank je wel, ${hero}.’ Ergens bij de boekenkast brandt het havenlicht tevreden verder.`, keepsake: 'Een gouden havenkompas' };
    if (picks[2] === 1) return { title: 'Een thuis voor het sokkenmonster', text: `Naast de vuurtoren bouwen jullie een zacht huis. Het krijgt een deur die breed genoeg is voor een monsterstaart en een raam van doorzichtig pakpapier. Het sokkenmonster probeert het bed en steekt tevreden al zijn kleine tenen onder de deken.

Daarna wordt hij de havenmeester. De kapitein geeft hem een piepklein petje en laat zien hoe je aankomende bootjes begroet. Het monster oefent een zwaai die bijna net zo groot is als hijzelf. Bij de eerste reiziger vergeet hij even wat hij wilde zeggen, maar iedereen zwaait vriendelijk terug.

Wanneer je terugvaart, geeft hij jou zijn bijzondere havenmeesterspetje als aandenken; zelf vouwt hij een nieuwe van zacht papier. Je hebt een nieuw vriendje gemaakt. Hij wijst nog één keer naar de vuurtoren, zodat je ziet waar hij bij een volgend avontuur op je wacht.`, keepsake: 'Het petje van de havenmeester' };
    return { title: 'De knuffelhaven', text: `Jullie huis krijgt kussens als muren en een zakdoek als dak. De deur kan ver open, zodat ook knuffels met grote oren gemakkelijk naar binnen kunnen. Naast het raam komt een klein plankje voor kopjes, en voor de ingang leggen jullie een zacht matje.

Er komen meteen drie knuffels logeren. Zelfs de grote teddybeer wil graag een kopje thee. Hij neemt plaats naast het huis, want binnen past zijn hoofd maar net door de deur. De kapitein laat de vuurtoren extra warm schijnen terwijl de bezoekers hun kussens uitkiezen.

Je krijgt een sleutel van zacht vilt. Daarmee kun je bij ieder nieuw bezoek de deur van dit huis weer openen. Wanneer je terug in bed ligt, weet je dat er ergens aan de andere kant van het vloerkleed een warm welkom wacht. De laatste lichtbundel glijdt langs je deken.`, keepsake: 'Een sleutel van zacht vilt' };
  }
  if (picks[4] === 1) return { title: 'Het station om de hoek', text: `De trein stopt tussen de bloemen bij jouw huis. Buren, knuffels en kleine bosdieren komen kijken. Vos hangt de stationsklok op en veegt met zijn mouw een stofje van het glas. ‘Welkom in station ${hero}!’ roept hij. De wijzers maken een vrolijk rondje.

Op het lege bord verschijnen de eerste bestemmingen als kleine tekeningen: een bos, een wolk en een perron vol sterren. Voor het loket komt een bankje waar grote en kleine reizigers naast elkaar kunnen zitten. De bloemen langs het spoor buigen mee wanneer de trein nog één keer zacht fluit.

Vos geeft je een gouden stationssleutel. Hij past op het kastje met de dienstregeling. Elke keer als je het klokje hoort, weet je dat er ergens een nieuw avontuur op je wacht. Voor vandaag staat de trein rustig thuis, precies om de hoek.`, keepsake: 'Een gouden stationssleutel' };
  if (picks[0] === 0) return { title: 'Het eerste drakenperron', text: `Dibbel zwaait naar zijn vrienden. Nog nooit zagen de draakjes een trein! Ze blazen kleine feestwolkjes en lopen nieuwsgierig om de wielen heen. Vos laat zien waar iedereen rustig mag instappen. Dibbel haalt zijn gerepareerde kaartje uit zijn borstzak en toont trots de sterrensticker.

Samen bouwen de draakjes een perron met extra brede bankjes. Eén draakje schildert een bord met een trein erop; een ander legt zachte kussens klaar voor staarten. Bij het eerste proefritje houdt iedereen zijn kaartje heel netjes omhoog. De stationsklok tikt alsof hij de maat van hun vrolijke stemmen volgt.

Vos geeft jou een bijzonder drakenkaartje met een gouden rand. Er staat een klein sterrenstickertje op, net als bij Dibbel. Voortaan ben jij altijd welkom op het allereerste drakenstation. Als de trein vertrekt, blijft het perron nog lang vol zwaaiende vleugels.`, keepsake: 'Een drakenkaartje met gouden rand' };
  return { title: 'Het station achter de maan', text: `Je gouden kaart licht op. Achter de maan verschijnt een perron vol sterrenbloemen. Elke bloem laat een klein lichtje over het pad glijden. Hier kunnen verloren reizigers even uitrusten en hun weg terugvinden. Vos zet de deur open en maakt plaats voor de eerste bezoeker, een slaperige wolkenmuis met een veel te grote koffer.

Je laat op de bewegende kaart zien hoe de sporen naar verschillende fijne bestemmingen lopen. De wolkenmuis kiest een rustig bankje om eerst een boterham te eten. Boven het perron verschijnt een warme lamp die nooit in iemands ogen schijnt.

Vos benoemt je tot ereconducteur en geeft je een fonkelende conducteursster. Je speldt hem voorzichtig op. De kaart vouwt zich tevreden dicht. Voor vandaag hebben de reizigers hun plek gevonden. Je eerste taak voor morgen? Weer een nieuwe bestemming ontdekken.`, keepsake: 'Een fonkelende conducteursster' };
}

function helperName(picks: number[]): string { return picks[0] === 0 ? 'Melle' : 'Fien'; }
