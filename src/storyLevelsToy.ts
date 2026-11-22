type Rewrite = (picks: number[], hero: string, band: 'under6' | '6to8', step?: number) => string;

const toy: Rewrite = (picks, hero, band, step) => {
  const friend = picks[0] === 0 ? 'Bram' : 'Nola';
  const friendKind = picks[0] === 0 ? 'Bram de beer' : 'Nola het konijn';
  const bridge = picks[1] === 0;
  const madeBed = picks[2] === 0;
  const sang = picks[3] === 0;
  const tell = (young: string, middle: string) => band === 'under6' ? young : middle;
  const paragraphs = (...parts: string[]) => parts.join('\n\n');

  switch (step) {
    case 0: return paragraphs(
      tell(`‘Psst, ${hero}!’ Aan het eind van je bed trekt een knuffelkonijn aan je deken. Je kijkt over de rand. Op het kleed ligt een boot van papier. Het zeil beweegt al een beetje.`, `‘Psst, ${hero}!’ Een knuffelkonijn trekt aan je deken. Je kijkt over de rand van je bed en ziet midden op het kleed een papieren boot. Het zeiltje ritselt al.`),
      tell('De kapitein zwaait. Hij staat in een klein doosje. Daar stuurt hij de boot. ‘Mijn lichtje is weg,’ zegt hij. ‘Nu kan ik de haven niet vinden.’', 'Vanaf zijn stuurhut, een leeg doosje van lucifers, zwaait de kapitein. ‘Mijn lichtje is weg. Zonder dat licht vind ik de speelgoedhaven niet terug.’'),
      tell('De haven ligt bij de boekenkast. Maar de kussens lijken vannacht op eilanden. De kapitein laat een rond gaatje zien. Zijn lampje past er precies in.', 'De haven ligt vlak bij de boekenkast, vertelt hij. Vannacht lijken alle kussens op eilanden. Hij wijst naar een klein rond gaatje waar het lampje precies in past.'),
      tell('Bram de beer heeft een rugzak. Daar zitten een zachte sjaal, een zakdoek en twee touwtjes in. Hij zet de tas in de boot. Zo kan iedereen de spullen pakken.', 'Bram de beer stopt een zachte sjaal, een zakdoek en twee stukjes touw in zijn rugzak. Hij zet de tas alvast in de boot, zodat alle spullen mee kunnen.'),
      tell('Nola het konijn heeft zelf een kijker gemaakt. Ze kijkt naar de blauwe strepen op het kleed. ‘Daar is vast water,’ zegt ze.', 'Nola het konijn tuurt door haar zelfgemaakte verrekijker. ‘Zie je de blauwe strepen in het kleed? Die wijzen ons vast de weg naar het water.’'),
      tell('Bram wil mee. Nola ook. Er is nog één plekje naast jou. De andere vriend wacht bij je bed tot je terugkomt. Wie neem jij mee?', 'De twee knuffels willen allebei helpen, maar naast jou is maar één plekje. De andere vriend blijft bij het bed en wacht jullie daar op. Wie vaart met je mee?'),
    );

    case 1: return paragraphs(
      tell(`${friendKind} klimt naast je in de boot. Samen trekken jullie het zeil omhoog. Kijk eens! De blauwe strepen op het kleed worden echte golven.`, `${friendKind} klimt naast je in de papieren boot. Zodra jullie het zeil omhoogtrekken, veranderen de blauwe strepen van het kleed in golven.`),
      tell('Het licht bij de boekenkast gaat uit. Daar lag de haven! Dan drijft een grote pantoffel langs. ‘Die kan ons naar de overkant brengen,’ zegt ' + friend + '.', `Het laatste licht bij de boekenkast verdwijnt. Juist daar ligt de haven. Dan drijft er een reusachtige pantoffel voorbij. ‘Daarmee kunnen we oversteken,’ zegt ${friend}.`),
      tell('De boot botst zacht tegen een trui. De trui ligt opgevouwen op het kleed. Het lijkt wel een eiland. Jullie stappen erop en kijken rond.', 'De boot botst zacht tegen een eiland van een opgevouwen trui. Jullie leggen aan en stappen op de trui om beter rond te kijken.'),
      tell('Aan de overkant staat een stoel. Daarachter moet de haven liggen. Een rood potlood rolt tegen je voet. Je legt het bij twee andere potloden. Samen maken ze een brug.', 'Achter de stoel aan de overkant moet de haven liggen. Een rood potlood rolt naar je toe. Je legt het naast twee andere. Zo ontstaat er een stevig bruggetje.'),
      tell('De pantoffel dobbert verder. Hij is zacht vanbinnen. Daar passen jullie ook in. ' + friend + ' houdt de boot vast met een touw. Dan kan die mee.', `De pantoffel dobbert dichtbij. Binnenin is het zacht en er is plek genoeg. ${friend} houdt de boot vast aan een touw, zodat hij mee kan.`),
      tell('De kapitein kijkt vanaf zijn doosje naar de brug en dan naar de pantoffel. ‘Hoe gaan we naar de overkant?’ vraagt hij.', 'De kapitein kijkt nieuwsgierig van de potloden naar de pantoffel. Nog één golf en de pantoffel is vlakbij. ‘Het water is hier niet breed,’ zegt hij. ‘Welke oversteek kiezen jullie?’'),
    );

    case 2: return paragraphs(
      bridge
        ? tell('De brug kraakt. Maar de potloden blijven netjes liggen. Het laatste potlood komt tot aan de rand van het kleed. Daar stap je rustig van de brug.', 'De brug kraakt een beetje, maar houdt stand. Het laatste potlood ligt precies aan de rand van het kleed. Daar stappen jullie één voor één van de brug.')
        : tell(`${friend} pakt een stukje karton. Daarmee duwt ${friend} water weg. De pantoffel gaat langs de kast. Bij een poot van de stoel stopt hij zacht.`, `De pantoffel dobbert langs de kast. ${friend} gebruikt een stuk karton als peddel en stuurt de pantoffel rustig naar een stoelpoot.`),
      tell('Onder de stoel hoor je iemand huilen. Het is een heel klein sokkenmonster. ‘Ze denken dat ik sokken opeet,’ zegt hij. ‘Maar ik zoek een bed!’', 'Onder de stoel horen jullie een piepklein sokkenmonster snikken. ‘Iedereen denkt dat ik sokken opeet. Maar ik zoek alleen een warme slaapzak!’'),
      tell('In zijn poot glimt iets. Het lijkt op het lampje van de haven. Hij houdt het dicht bij zich. Dan is hij minder bang.', 'Hij houdt iets vast dat glimt als het verloren havenlicht. Hij drukt het voorzichtig tegen zich aan. Met een beetje licht voelt hij zich minder bang.'),
      tell('Het monster laat een klein doosje zien. ‘Hier wilde ik slapen.’ Zijn staart steekt uit het doosje. Zijn tenen worden koud. Het zijn er heel veel.', 'Het monstertje laat een leeg doosje zien waarin hij wilde slapen. Zijn staart steekt eruit. ‘Dan krijg ik koude tenen,’ zegt hij. Je ziet een hele rij kleine tenen.'),
      tell(`${friend} gaat naast hem zitten. ‘Waar slaap jij het fijnst?’ In de tas zit een zachte zakdoek. Die is groot genoeg om hem warm te houden.`, `${friend} gaat naast hem zitten en vraagt hoe hij het liefst slaapt. In de rugzak zit een zachte zakdoek. Daar kun je een slaapzak van maken.`),
      tell('Naast je is nog plek. Het sokkenmonster kijkt van de zakdoek naar de boot. Maak je een slaapzak? Of mag hij mee?', 'Naast je in de boot is nog plek. Het sokkenmonster kijkt van de zakdoek naar die plek. Maak je iets warms voor hem of mag hij mee?'),
    );

    case 3: return paragraphs(
      madeBed
        ? tell('Het sokkenmonster kruipt in zijn nieuwe slaapzak. Nu zitten alle tenen warm! Hij geeft je het lampje. Je ziet zijn pootje nog zwaaien vanuit zijn bed.', 'Het sokkenmonster kruipt in zijn nieuwe slaapzak. Hij stopt al zijn tenen diep onder de zachte stof en geeft jou het lampje. Vanuit zijn bed zwaait hij jullie uit.')
        : tell('Het sokkenmonster klimt in de boot. Hij houdt het lampje hoog. Zijn staart ligt langs de rand. Zo heeft iedereen ruimte.', 'Het sokkenmonster klimt aan boord en houdt het lichtje hoog. Hij legt zijn staart langs de rand, zodat iedereen kan zitten.'),
      tell('Dan ligt er iets groots in de weg. Het is een teddybeer. Hij slaapt. Zzz! Telkens als hij snurkt, rolt een golf over het kleed.', 'Een enorme teddybeer slaapt tussen jullie en de haven. Bij elke snurk rolt een golf over het kleed. Het bootje schommelt heen en weer.'),
      tell(`${friend} legt het bootje achter een kussen. Daar zijn de golven klein. De beer ligt met zijn kop op een zachte deken.`, `${friend} laat het bootje achter een kussen wachten. Daarachter zijn de golven klein. De beer ligt met zijn kop op een opgevouwen deken.`),
      tell('Zijn grote poot ligt op het smalle pad naar de kast. Aan zijn trui zit een belletje. Ting. Je hoort het bij elke adem.', 'Zijn poot ligt dwars over het paadje naar de boekenkast. Een belletje aan zijn trui tingelt zacht bij elke ademhaling.'),
      tell('De beer ziet er lief uit. Hij is alleen erg moe. Misschien draait hij zich om als je zacht voor hem zingt. Dan is het pad vrij.', 'De reus ziet er vriendelijk uit. Misschien draait hij zich om als jullie zacht voor hem zingen. Dan komt het paadje vrij.'),
      tell(`Je kunt ook zacht vragen of je erlangs mag. ${friend} wacht op jouw plan. Zing je of vraag je de beer om hulp?`, `‘We kunnen hem ook zacht vragen of hij wat ruimte wil maken,’ zegt ${friend}. Hoe komen jullie het beste langs de reus?`),
    );

    case 4: return paragraphs(
      sang
        ? tell('De beer wordt rustig van het lied. Hij draait zich om. Nu is het pad vrij. Ting! Zijn belletje klinkt nog één keer. Hij slaapt lekker verder.', 'De reus wordt rustig van jullie lied en draait zich om. Er komt een paadje vrij. Zijn belletje tingelt nog één keer, alsof hij jullie in zijn slaap uitzwaait.')
        : tell('De beer doet één oog open. Hij lacht en tilt jullie over zijn poot. Dan legt hij een punt van zijn deken neer. Daar kan de boot stoppen.', 'De reus opent één oog en glimlacht. Hij tilt jullie voorzichtig over zijn poot. Van een hoek van zijn deken maakt hij een zachte plek om aan te leggen.'),
      tell('De knuffels in de haven juichen. Het lampje past precies in de kleine vuurtoren. De kapitein draait het vast.', 'De knuffels in de haven juichen. Het lampje past precies in de kleine vuurtoren en de kapitein draait het vast.'),
      tell('Warm licht schijnt over het kleed. Het gaat langs de stoelen tot aan je bed. De haven ligt achter de prentenboeken!', 'Het warme licht glijdt over het kleed en langs de stoelen naar je bed. De haven ligt achter de prentenboeken.'),
      tell(`Onder een plank staan kleine mandjes. Knuffels die moe zijn van het varen, kunnen daar even zitten. ${friend} wijst naar de lege plek naast de toren.`, `Onder de steiger staan mandjes waar reizigers even kunnen uitrusten. Naast de toren wijst ${friend} naar een lege plek.`),
      tell('Daar liggen lapjes stof, kleine kussens en blokjes. ‘Wat kunnen we maken, zodat niemand verdwaalt?’ vraagt je vriend.', 'Er liggen kussens, lapjes vilt en een doosje met bouwstukjes. ‘Wat zullen we hier maken zodat niemand verdwaalt?’ vraagt je vriend.'),
      tell('Je kunt een veilige weg naar je bed maken. Of je bouwt een zacht huis voor nieuwe knuffels. Wat kies jij?', 'Je kunt een vaste weg naar de slaapkamer maken of een gezellig huis bouwen waar nieuwe knuffelvrienden welkom zijn. Wat kies je?'),
    );
  }

  if (picks[4] === 0) return paragraphs(
    tell('Vanaf de haven maak je een weg naar je bed. Je zet kleine vlaggetjes van stof langs de stoelen. Zo ziet elke knuffel waar het pad loopt.', 'Jullie maken een veilige weg van de haven naar je bed. Vlaggetjes van vilt wijzen de weg langs de stoelen, ook voor de kleinste knuffels.'),
    bridge
      ? tell('De brug van potloden wordt het mooiste stuk. Elk potlood krijgt een vaste plek. Ook kleine voetjes kunnen er veilig over.', 'De potlodenbrug wordt het mooiste stuk van het pad. Je zet alle potloden vast, zodat ook heel kleine knuffels over de brug kunnen lopen.')
      : tell('De pantoffel blijft varen. Hij brengt iedereen naar de overkant. De kapitein maakt aan beide kanten een zachte plek. Met een touw legt hij de boot vast.', 'De pantoffel wordt een echte veerboot. De kapitein maakt aan beide oevers een zachte plek waar hij de pantoffel met een touwtje kan vastleggen.'),
    tell('Het licht van de toren schijnt over de weg. De havenmeester past op de bootjes. Hij geeft je een gouden kompas.', 'Het vuurtorenlicht glijdt over de hele route. Voor het vertrek legt de havenmeester een gouden kompas in je hand. Er zit een kleine wijzer op.'),
    tell('De pijl draait een rondje. Dan wijst hij naar je kussen. Nu hoeft geen knuffel meer bang te zijn. Iedereen kan de weg vinden.', 'De wijzer draait één rondje en wijst dan naar je kussen. Voortaan kan iedereen de weg vinden. Je reisgenoot vaart nog een stuk met je mee.'),
    tell(`Je vriend vaart een stukje met je mee. ‘Dank je wel, ${hero},’ hoor je als je bijna slaapt. Bij de kast brandt het lampje nog.`, `Net voordat je in slaap valt, hoor je heel zacht: ‘Dank je wel, ${hero}.’ Ergens bij de boekenkast blijft het havenlicht branden.`),
  );

  if (!madeBed) return paragraphs(
    tell('Naast de toren bouwen jullie een zacht huis. De deur is breed. Een monsterstaart kan er makkelijk door. Van helder pakpapier maken jullie een raam.', 'Jullie bouwen een zacht huis bij de vuurtoren. Er komt een deur die breed genoeg is voor een monsterstaart en een raam van doorzichtig pakpapier.'),
    tell('Het sokkenmonster probeert het bed. Hij trekt de deken op. Al zijn tenen passen eronder. Nu blijven ze warm.', 'Het sokkenmonster probeert het bed meteen uit en steekt al zijn koude tenen onder de deken. Eindelijk heeft hij een plekje waar hij helemaal in past.'),
    tell('De kapitein geeft hem een klein petje. Nu is het monster de baas van de haven. ‘Zo zeg je hallo tegen een boot,’ zegt de kapitein.', 'De kapitein maakt hem havenmeester. Hij geeft het monster een piepklein petje en doet voor hoe hij een nieuw bootje welkom kan heten.'),
    tell('Het monster oefent een grote zwaai. Daar komt de eerste boot! Hij weet even niet wat hij wilde zeggen. Maar alle knuffels zwaaien vrolijk terug.', 'Het monster oefent een zwaai die bijna zo groot is als hij zelf. Bij de eerste reiziger vergeet hij zijn woorden, maar de knuffels zwaaien vriendelijk terug.'),
    tell('Als jij terugvaart, mag je zijn petje houden. Hij vouwt een nieuw petje van papier. Je hebt een vriend erbij. Hij wijst naar het licht. Daar wacht hij op je.', 'Voor je terugvaart krijg je zijn havenmeesterspetje. Hij vouwt zelf een nieuw petje van zacht papier. Je nieuwe vriend wijst naar de vuurtoren. Daar vind je hem bij je volgende bezoek.'),
  );

  return paragraphs(
    tell('Jullie maken een huis van kussens. Bovenop komt een zakdoek als dak. De deur kan wijd open. Ook een knuffel met lange oren past erdoor.', 'Jullie bouwen een huis met kussens als muren en een zakdoek als dak. De deur kan wijd open, zodat ook knuffels met lange oren naar binnen kunnen.'),
    tell('Bij het raam hangt een plankje voor kopjes. Voor de deur ligt een zacht matje. Er komen meteen drie knuffels slapen. Ze kiezen hun kussens uit.', 'Naast het raam komt een plankje voor de kopjes. Voor de deur leggen jullie een matje. Meteen komen er drie knuffels logeren. Ze zoeken elk een zacht kussen.'),
    tell('De grote beer lust ook thee. Zijn kop past maar net door de deur. Hij gaat buiten naast het huis zitten. Daar kan hij fijn zijn kopje vasthouden.', 'Zelfs de grote teddybeer wil graag thee. Zijn kop past maar net door de deur, dus gaat hij met zijn kopje naast het huis zitten.'),
    tell('De kapitein laat de toren extra warm schijnen. Je krijgt een zachte sleutel van stof. Als je weer komt, kun je de deur zelf openmaken.', 'Het licht uit de vuurtoren schijnt extra warm over jullie huis. Je krijgt een sleutel van zacht vilt. Bij je volgende bezoek mag je de deur zelf openen.'),
    tell('Dan lig je weer in bed. Aan de andere kant van het kleed ben je altijd welkom. De laatste straal van het havenlicht gaat zacht over je deken.', 'Terug in bed weet je dat er aan de andere kant van het kleed een warm welkom wacht. De laatste straal van het havenlicht glijdt langs je deken.'),
  );
};

export const storyLevelsToy = { toy };
