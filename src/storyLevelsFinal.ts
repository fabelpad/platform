type ReadingBand = 'under6' | '6to8';
type AgeVersion = (picks: number[], hero: string, band: ReadingBand, step?: number) => string;

const balloonText: AgeVersion = (picks, hero, band, step) => {
  if (band === 'under6') {
    if (step === undefined) return picks[4] === 0
      ? `De ballon in de vorm van een peer landt bij de bieb. De slak doet zijn koffer open. Mmm, warme broodjes!

Een muis zet bordjes klaar. De slak haalt een rond broodje uit de koffer. Dan pakt hij een lang broodje. Het laatste broodje heeft twee oren. Is het een kat of een konijn?

De geitjes gaan daarna ook op reis. ‘Bedankt, ${hero}!’ zegt Fiep. Ze geeft jou een vlaggetje. Het wappert in de wind. De haven kan weer open.`
      : `De sterrenballon landt in de tuin. De geitjes delen zaadjes uit. Eén zaadje plakt op Fieps bril. Fiep moet lachen.

De geitjes zoeken een plekje voor alle zaadjes. Op ieder bordje staat een bloem. Zo weten ze waar de zaadjes heen moeten. Je legt er een paar in een kuiltje.

De slak brengt daarna zijn broodjes naar de bieb. Jij krijgt een bloem die draait in de wind. ‘Die is voor jou, ${hero},’ zegt Fiep. De haven kan weer open.`;
    return [
      `Hoog in de lucht ligt een haven. Er liggen ballonnen aan touwen. Een ballon lijkt op een peer.

Fiep de vos draagt een groene bril. ‘Hoi ${hero}! De ballonnen willen weg. Maar waar is de wind?’

Fiep zoekt een zacht briesje. Ze heeft een hoorn om mee te luisteren. Ze heeft ook linten. Een lint danst al bij een klein beetje wind.`,
      `${picks[0] === 0 ? 'Door de hoorn hoor je een zucht. Hij komt van onder de steiger.' : 'Eén geel lint beweegt. Het hangt onder de steiger.'}

Daar vinden jullie een platte zak. ‘Hier slaapt de wind,’ zegt Fiep. ‘Zullen we hem zacht wakker maken?’

Er staat een keteltje dat kan fluiten. Het is leeg en koel. Er staat ook een molentje. Op het molentje zitten zachte veren.`,
      `${picks[1] === 0 ? 'Het keteltje fluit. Een rond wezentje rolt uit de zak.' : 'Het molentje draait. Een rond wezentje rolt uit de zak. Er ligt een veer op zijn hoofd.'}

‘Ik ben Poef,’ zegt hij. ‘Ik ben bang dat ik te hard blaas.’

Fiep zet een leeg mandje klaar. Zo kan Poef oefenen. Je ziet een zachte sjaal. Misschien heeft Poef zelf ook een idee.`,
      `${picks[2] === 0 ? 'Je maakt een nest van de sjaal. Poef blaast één keer. Het mandje schuift zacht naar Fiep.' : 'Poef wil met een veer oefenen. Hij blaast zacht. De veer landt precies in het mandje.'}

‘Het lukt!’ roept Poef. Fiep pakt een kleine ballon om mee te oefenen. Ze houdt het touw vast.

Je kunt naar de appelbomen. Of je volgt de harpjes die zingen in de wind.`,
      `${picks[3] === 0 ? 'De kleine ballon zweeft rustig over de appelbomen. Poef blaast zacht genoeg.' : 'De harpjes zingen zacht. Poef laat de kleine ballon rustig langs de steiger zweven.'}

‘Nu mogen de reizigers mee,’ zegt Fiep. De slak brengt broodjes naar de bieb. De geitjes brengen zaadjes naar de tuin.

Poef staat klaar om zacht te blazen. Beide ballonnen gaan op reis. Fiep draagt de kaart en wacht op je antwoord. Welke ballon mag eerst?`,
    ][step];
  }

  if (step === undefined) return picks[4] === 0
    ? `De ballon in de vorm van een peer landt naast de leesbank. De slak tilt zijn koffer uit het mandje. Zodra het deksel opengaat, ruikt de hele bibliotheek naar broodjes.

‘Deze heeft oren!’ roept een lezer. De slak kijkt naar het broodje. ‘Het was een konijn. Een kat mag ook.’ Poef lacht en blaast daarbij één servetje om.

Daarna vliegen ook de zaadjes naar de tuin. De haven heeft haar zachte wind terug. Fiep vouwt een vlaggetje voor jou. ‘Onze eerste vaart ging naar de bieb, ${hero}.’ In de haven hangt het lege mandje alweer aan de steiger. Poef gaapt tevreden.`
    : `De sterrenballon zakt langzaam naar de tuin. De mand blijft stil boven het pad hangen. Poef laat haar zo zacht zakken dat er nauwelijks een korreltje aarde opwaait.

Jij houdt een zakje open. Poef blaast zo zacht als hij kan. Eén zaadje landt op Fieps bril. Ze kijkt er scheel naar, tot een geitje het eraf haalt en in de aarde legt.

De slak brengt daarna zijn broodjes naar de bibliotheek. In de haven krijg jij een kleine bloem, net als die op de steiger. ‘Voor deze vaart, ${hero},’ zegt Fiep. Poef laat jouw bloem één rondje draaien.`;
  return [
    `Boven de heuvel klimt ${hero} een wolkentrap op. Daar hangt een steiger in de lucht. Er liggen ballonnen aan vast: een peer, een vis en een ster. In de mandjes kan nog niemand weg.

‘De zachte wind is zoek,’ zegt Fiep de vos. Ze schuift haar groene pilotenbril omhoog. Fiep wijst naar de mandjes. Als het te hard waait, gaan ze schommelen. De reizigers wachten dus nog even. ‘Het kleinste briesje is genoeg.’

Fiep heeft twee ideeën. Door haar luisterhoorn hoor je zelfs een klein zuchtje. Haar lichte linten bewegen al als er bijna geen wind staat. ‘Waar wil jij beginnen?’ vraagt ze.`,
    `${picks[0] === 0 ? 'Je houdt de luisterhoorn bij je oor. Onder de steiger hoor je een zuchtje. Het klinkt alsof iemand heel zacht door een rietje blaast.' : 'De linten hangen stil, op één geel lintje na. Het beweegt bij een opening in de wolk. Je bukt en kijkt onder de steiger.'}

Daar ligt een platte windzak. Op het label staat: ‘Zachte wind. Graag rustig wakker maken.’ Fiep hurkt erbij. Jij gaat naast haar zitten. Je houdt je hand naast de zak en luistert. Zou er iemand in zitten?

Naast de zak staat een leeg keteltje dat fluit als je erdoor blaast. Iets verderop staat een molentje met veren. Met allebei kun je de wind voorzichtig wakker maken.`,
    `${picks[1] === 0 ? 'Je blaast een zacht wijsje door het keteltje. Uit de windzak rolt een rond wezentje met twee pluizige wenkbrauwen.' : 'Je laat de veren van het molentje langzaam draaien. Een rond wezentje tuimelt uit de windzak. Er blijft een veertje op zijn wenkbrauw liggen.'}

‘Ik heet Poef. Wat als ik de slak achteruit laat vliegen?’ vraagt hij. Fiep pakt een leeg oefenmandje. Er hoeft nog niemand in. ‘Je mag eerst één klein zuchtje proberen.’

Een warme sjaal ligt klaar op de bank. Poef voelt met zijn poot hoe zacht hij is. Je kunt met een sjaal een rustig nest voor hem maken. Je kunt hem ook vragen wat hij zelf wil proberen.`,
    `${picks[2] === 0 ? 'Je vouwt de sjaal tot een zacht nest. Poef gaat erin zitten en blaast één klein pufje. Het lege mandje glijdt precies tot aan Fieps poot.' : 'Poef wil een veer in het mandje blazen. Jij houdt het mandje stil. De veer draait één keer in de lucht en landt zacht.'}

Poef weet hoe zacht hij kan blazen. Nu wil hij het langer volhouden. Fiep maakt een oefenballon los. Ze controleert de knoop en houdt het touw vast.

‘Als het liedje van de harpjes even zacht blijft, weet je dat ik goed blaas,’ zegt Poef. Fiep geeft jou de kaart en pakt het touw weer met twee poten vast. Jij wijst het eerste rondje aan.`,
    `${picks[3] === 0 ? 'De oefenballon maakt een rustig rondje boven de appelbomen. Zelfs de bloesem blijft aan de takken hangen. Fiep steekt haar duim op.' : 'De proefballon zweeft langs de windharpjes. Ze geven één voor één een zachte toon. Poef houdt zijn zuchtje mooi gelijk.'}

De appelbomen en windharpjes krijgen straks weer een lege lucht boven zich. De twee echte ballonnen gaan hun eigen kant op. Fiep tekent een pad naar de bibliotheek en een pad naar de tuin. De slak schuift zijn koffer naar het perenmandje.

‘Blijf je onderweg bij me?’ vraagt Poef aan Fiep. Zij knikt en geeft jou de havenkaart. Beide vaarten gaan door. Je mag aanwijzen welke bestemming als eerste aan de beurt is.`,
  ][step];
};

const forestText: AgeVersion = (picks, hero, band, step) => {
  if (band === 'under6') {
    if (step === undefined) return picks[4] === 0
      ? `Roef tekent een oor, een neus en ogen op het bord. Jullie maken een pad langs de aardbeien, de plas en de zilveren bloem.

Een konijn ruikt aan de aardbeien. Een vogel luistert naar de blaadjes. Iedereen ontdekt iets.

Roef geeft ${hero} een lintje van zijn sjaal. Je bindt het aan je stok. Als je ermee zwaait, vliegt het lint een stukje mee. Je loopt naar huis. Het bos heeft zijn kleuren terug.`
      : `In het boek teken je ${picks[0] === 0 ? 'het rode vogeltje' : 'de rode aardbei'} en ${picks[1] === 0 ? 'de blauwe lucht in de plas' : 'de gele bloem in de zon'}. De zilveren bloem krijgt ook een bladzij.

Roef legt het boek in een holle boom. Een egel komt al kijken.

‘Voor jou, ${hero},’ zegt Roef. Hij geeft je een kleine waaier met kleuren. Het bos heeft zijn kleuren terug.`;
    return [
      `Roef de eekhoorn wacht voor het raam van ${hero}. Zijn staart is rood. Achter hem is het hele bos grijs.

‘De kleuren slapen,’ zegt Roef. Hij vouwt een waaier open. Daar kunnen de kleuren in.

Je hoort een vogel fluiten. Naast het pad ruik je zoete aardbeien. Roef houdt zijn waaier klaar. Waar gaan jullie eerst kijken?`,
      `${picks[0] === 0 ? 'Jullie fluiten met de vogel mee. Zijn borst wordt rood.' : 'Jullie ruiken aan een aardbei. De aardbei wordt rood.'}

Dan springt het rode stipje op de waaier. ‘De kleur is wakker!’ roept Roef. Hij legt zijn staart ernaast. Sommige haartjes zijn lichtrood. Andere zijn donkerrood. De rest van het bos is nog grijs.

Je ziet de lucht in een plas. Verderop staat een bloem in de zon. Roef wil nog een kleur vinden.`,
      `${picks[1] === 0 ? 'Je kijkt in de plas. Een blauw stipje groeit uit tot een stukje blauwe lucht.' : 'De bloem gaat open in de zon. Haar blaadjes worden geel.'}

Roef heeft nu twee kleuren op zijn waaier. Maar de blaadjes zijn nog grijs.

‘Groen wil spelen,’ piept de vogel. Je kunt dansen als de blaadjes. Je kunt ook klappen en wachten tot de bomen terugklappen.`,
      `${picks[2] === 0 ? 'Je zwaait met je armen als een blad. Roef zwaait met zijn staart. De blaadjes worden groen.' : 'Je klapt twee keer. Tussen de bomen klinkt het terug. Roef klapt mee. De blaadjes worden groen.'}

Onder een paddenstoel groeit een zilveren bloem. Die mag zilver blijven.

Roef wil de bloem ook laten meedoen. Jullie kunnen een kring van stenen leggen. Of jullie kunnen een lied voor de bloem zingen.`,
      `${picks[3] === 0 ? 'Je legt stenen rond de zilveren bloem. De grond ertussen wordt bruin.' : 'Je zingt een zacht lied. De bloem wiegt mee. De grond eromheen wordt bruin.'}

Alle kleuren zijn terug! Roef wil laten zien hoe jullie ze vonden.

Bij de ingang staat een leeg bord. Daar kun je een pad op tekenen voor bezoekers. Er ligt ook een boek. Daar kun je de kleuren in tekenen.`,
    ][step];
  }

  if (step === undefined) return picks[4] === 0
    ? `Bij de ingang tekent Roef een oor, een neus en twee ogen op het bord. Jullie maken een pad langs de aardbeien, de plas en de zilveren bloem. Bij iedere plek kunnen bezoekers even stilstaan.

Een konijn volgt het neusje op het bord. Het ruikt de aardbeien al voordat het de struik ziet. Een merel kiest het oortje. Hij luistert zo lang naar de bladeren dat hij hun ritsel bijna kan nadoen.

Roef bindt een stukje van zijn gevlekte sjaal aan jouw stok. ‘Voor je volgende wandeling, ${hero}.’ Je zwaait bij de ingang. Het bos is weer vol kleur en het pad is klaar voor nieuwe bezoekers.`
    : `Op de eerste bladzijde teken je ${picks[0] === 0 ? 'het roodborstje dat jullie een wijsje leerde' : 'de aardbei die zo heerlijk rook'}. Op de volgende bladzijde komt ${picks[1] === 0 ? 'de lucht in de plas' : 'de gele bloem in de zon'}. De zilveren bloem krijgt een glimmend hoekje.

Jullie leggen het boek in een droge boomholte. Een egel komt als eerste kijken. Hij duwt voorzichtig een bladzij open en vraagt om een potlood.

Voor thuis geeft Roef je een kleine kleurenwaaier. Het laatste vakje is leeg. ‘Dat is voor iets dat jij later ontdekt, ${hero}.’ Samen kijken jullie nog één keer naar het groene bos.`;
  return [
    `${hero} schuift het gordijn open. Buiten stelt een eekhoorn met een gevlekte sjaal zich voor. Hij heet Roef. Zijn rode staart valt meteen op tussen alle grijze bomen.

‘De kleuren doen een dutje,’ zegt Roef. Het dunne blad is nog heel, al lijkt het getekend met potlood. Roef laat zijn kleurenwaaier zien. Alle vakjes zijn leeg. ‘Misschien worden de kleuren wakker als wij ze zoeken.’

Boven je hoofd zingt een vogel. Naast het pad ruiken de aardbeien alsof ze rijp zijn. ‘Onze oren en neuzen kennen het bos nog,’ zegt Roef. Hij wacht af welke kant jij kiest.`,
    `${picks[0] === 0 ? 'Je hoort het vogelwijsje en neuriet mee. Hoog in een boom schudt een roodborstje zijn veren uit. Zijn borst wordt langzaam rood.' : 'Je ruikt een rijpe aardbei. Roef zegt dat de geur hem aan zomer doet denken. Meteen wordt de aardbei rood.'}

Het rode stipje springt in een vakje van de waaier. Roef houdt het vakje bij zijn staart. De punten van de haren zijn lichter dan de rest. ‘Er is meer dan één soort rood,’ zegt Roef verbaasd.

Verderop ligt een plas waarin je de lucht kunt zien. In de zon staat een paardenbloem. Roef wil weten of je daar ook een kleur kunt wakker maken. De plas kan blauw worden of de bloem geel.`,
    `${picks[1] === 0 ? 'Je kijkt naar de plas zonder het water aan te raken. Er verschijnt een blauw stipje. Het groeit tot er een blauwe lucht tussen de takken ligt.' : 'Je volgt de zon naar de paardenbloem. De bloem gaat open. Eerst wordt één blaadje geel en daarna de rest.'}

Op de waaier staat nu een tweede kleur. Maar het groen laat zich nog niet zien. ‘Groen speelt graag samen,’ zingt het roodborstje.

Misschien komt het groen als jullie samen spelen. Als je met de bladeren danst, kan Roef met zijn staart meedoen. Als je samen klapt, kun je horen of het bos jullie ritme teruggeeft. Het roodborstje is klaar om mee te doen.`,
    `${picks[2] === 0 ? 'Je zwaait zoals de varens met hun bladeren zwaaien. Roef doet mee met zijn staart. Een blaadje wordt groen en ineens wiegt het hele groene bos mee.' : 'Klap, klap, wacht. Tussen de bomen klinkt het ritme terug. Roef tikt met zijn poot. Bij ieder antwoord wordt er een boom groener.'}

Roef zoekt op de waaier. De bloem lijkt een beetje op het oude grijs van het bos, maar er staat geen vakje bij dat precies past. ‘Misschien heeft deze bloem haar eigen kleur al,’ zeg je.

Zilver is óók een kleur. Jullie kunnen rond de bloem een kring van kleine stenen leggen. Een lied past ook, met een klein tingeltje erin. Je kiest hoe je deze bloem haar eigen plekje geeft.`,
    `${picks[3] === 0 ? 'Je legt losse steentjes in een kring om de zilveren bloem. Binnen de kring glanst ze als een maantje. De grond krijgt een warme bruine kleur.' : 'Jullie zingen een lied met een klein tingeltje. De zilveren bloem wiegt op het ritme. De grond onder haar wordt warmbruin.'}

De waaier zit nu vol. Bij elke kleur weet je nog wat je hoorde, rook of deed toen die wakker werd. Roef houdt de waaier tegen zijn borst en kijkt tevreden rond. Er hangt alweer een rood blaadje boven het pad.

Bij de ingang staat een leeg bord. Daarop kunnen jullie een pad voor bezoekers tekenen. In een groot boek kunnen jullie ook voor elke kleur tekenen hoe die terugkwam. Waar begin je mee?`,
  ][step];
};

type StoryDetail = readonly [afterOpening: string, afterMiddle: string, beforeChoice: string, youngest: string];

function expandAgeVersion(text: AgeVersion, detail: (picks: number[]) => StoryDetail[]): AgeVersion {
  return (picks, hero, band, step) => {
    const paragraphs = text(picks, hero, band, step).split('\n\n');
    const [afterOpening, afterMiddle, beforeChoice, youngest] = detail(picks)[step ?? (picks[4] === 0 ? 5 : 6)];
    return [
      paragraphs[0],
      afterOpening,
      paragraphs[1],
      afterMiddle,
      beforeChoice,
      band === 'under6' ? youngest : '',
      paragraphs[2],
    ].filter(Boolean).join('\n\n');
  };
}

const balloon = expandAgeVersion(balloonText, () => [
  [
    `Je zet je voet op de steiger. De planken wiebelen onder je schoenen. Fiep trekt aan een touw. De knoop blijft zitten. De perenballon knikt naar jullie. ‘Kijk, die is blij met bezoek,’ zegt Fiep. Jij steekt je hand op naar de ballon.`,
    `Onder een afdak zit een slak op zijn koffer. Hij doet het deksel open. Zijn broodjes liggen nog netjes op een rij. Een geitje steekt er een bloem bij. De slak schuift de bloem opzij, zodat die niet tussen het brood komt.`,
    `Beneden zie je bomen. Van zo hoog lijken ze net stukjes broccoli. Fiep rolt haar kaart uit. Er staan dikke lijnen op. Het zijn wegen voor de ballonnen. Fiep legt een poot op de rand, zodat de kaart niet van de steiger rolt.`,
    `De geitjes hebben ook een plaats in een mandje. Als het te hard waait, gaat hun mandje heen en weer. Dan moeten ze hun bloemen goed vasthouden. Fiep laat de mandjes nog even aan de steiger vastzitten.`,
  ],
  [
    `Jullie buigen over de rand. Onder de planken zit een gat in de wolk. Fiep houdt zich aan een paal vast en wijst omlaag. Er is een lage plank onder de steiger. Met één stap kunnen jullie er allebei bij.`,
    `De punt van de zak gaat even omhoog. Fiep legt haar poot naast de zak. Ze duwt er niet op. Uit een gaatje komt een zuchtje. Een stofje rolt over de planken en blijft tegen de koffer van de slak liggen. De slak blaast het weg.`,
    `Fiep schuift het lege mandje naar de rand. Straks kan de wind daarmee oefenen. Jij houdt alvast een lint boven de planken. Als je er met je hand naar wappert, krult de punt omhoog. Fiep telt hoeveel keer je kunt wapperen voor het lint weer stil hangt.`,
    `Aan de zak hangt een kaartje. Fiep leest het hardop voor. ‘Zachte wind. Maak me rustig wakker.’ Je legt het kaartje zo dat jullie het allebei kunnen zien. Dan buig je je voorover om nog een zuchtje te horen.`,
  ],
  [
    `Twee pluizige wenkbrauwen steken boven zijn ronde neus uit. Poef kijkt omhoog naar het vertrekbord. Fiep gaat op de planken zitten. Zo kan hij haar goed zien. Ze doet de kaart dicht. Die hebben jullie nu nog niet nodig. Eerst is het oefenmandje aan de beurt.`,
    `De slak komt dichterbij. ‘Weet je hoe ik begin als ik op reis ga?’ Hij laat eerst één voelspriet zien. Dan pas komt de andere naar buiten. ‘Zo doe ik het, één voor één.’ Poef probeert zelf ook één wenkbrauw op te tillen. Dat lukt maar half.`,
    `In het lege mandje ligt een licht veertje. Het weegt bijna niets. Je hoeft er maar zacht tegen te blazen. Fiep doet het voor. Het veertje schuift een klein stukje. Poef kijkt goed. Hij wil straks zelf voelen hoe hard hij moet blazen om de veer te laten vliegen.`,
    `‘Niemand hoeft al te vertrekken,’ zegt Fiep. De slak schuift zijn koffer van het pad af. Poef hoeft dus nog geen mandje met iemand erin vooruit te blazen. Hij ademt in en uit. Zijn wenkbrauwen gaan een stukje omlaag.`,
  ],
  [
    `De slak klapt in zijn pootjes. Hij doet het zo langzaam dat Poef tussen de klapjes door kan uitademen. Poef blijft op zijn proefplek zitten. Hij kijkt naar de ballon en onthoudt hoe klein zijn eerste pufje was. Zo klein mag het straks weer zijn.`,
    `Aan het touw hangt een vlaggetje. De punt wijst mee met de wind. Fiep maakt er een knoopje onder. ‘Zo zien we hoeveel touw ik nog vastheb.’ Ze trekt langs de knoop om te voelen of die stevig zit. Jij staat naast haar bij de rand.`,
    `Fiep rolt de kaart uit op de planken. Met haar poot tekent ze twee rondjes. Het ene rondje loopt over de bomen. Ze staan ver uit elkaar. Het andere rondje loopt langs de harpjes. Daar hoor je meteen of Poef zachter of harder blaast.`,
    `De slak wil het lege mandje na afloop opvangen. Hij zet zijn koffer achter de bank. Nu staat er niets meer in de weg. Jij wijst met je vinger de rondjes op de kaart na. Dan kijk je waar de ballon nu hangt.`,
  ],
  [
    `Fiep haalt de proefballon dichterbij. Poef laat de lucht langzaam uit zijn wangen lopen. Het mandje komt zonder schok terug bij de steiger. De slak vangt het op. Hij zet het naast zijn koffer neer. Dat was een oefenvaart. Nu mag er iemand mee.`,
    `De slak telt zijn broodjes. Eén broodje lijkt op een schelp. ‘Er is een lezer die zo'n broodje nog nooit heeft gezien,’ zegt hij. De geitjes laten hun zakjes zien. Op ieder zakje staat een bloem. Zo weten ze straks welke zaadjes in welk bed horen.`,
    `Fiep loopt langs allebei de mandjes. Ze trekt aan een touw en sluit een deurtje dat nog openstaat. Poef weet nu hoe hij zacht kan vertrekken en rustig kan stoppen. Voordat de mandjes vertrekken laat Fiep hem één voor één de twee routes op de kaart zien.`,
    `Fiep maakt plaats op de steiger. De slak zet de koffer bij zijn ballon. De geitjes leggen de zaadjes bij de andere. Jij krijgt een kaartje. Daar staan de bieb en de tuin op. Je mag de eerste bestemming aanwijzen.`,
  ],
  [
    `De lezers schuiven hun boeken aan de kant. Er komt een lange rij bordjes op tafel. De slak heeft ronde broodjes gepakt en lange broodjes. Eén broodje heeft twee oren. De slak weet niet meer welk dier hij had willen maken.`,
    `Fiep neemt de havenkaart mee naar de bank. Ze zet een stip waar de ballon is geland. Jij tekent er een broodje bij. Als je straks weer met haar vliegt, weet je meteen welke stip bij deze vaart hoort.`,
    `De slak zwaait uit het raam. Poef brengt jullie met een zacht zuchtje terug naar de haven.`,
    `De kaart ligt klaar voor de volgende tocht. Poef mag even rusten.`,
  ],
  [
    `Tussen de bedden lopen smalle paadjes. De geitjes leggen de zakjes naast de bordjes. Je helpt zoeken welk plaatje bij welk zakje hoort. Bij de gele bloem liggen kleine, ronde zaadjes. Een geitje laat er een paar in jouw hand rollen.`,
    `Als het mandje weer omhooggaat, kun je alle bedden tegelijk zien. De rijtjes lijken op een tekening. Poef ademt langzaam uit, net zoals bij het landen. Hij laat de ballon een rondje maken, zodat je de tuinders nog even kunt zien zwaaien.`,
    `Daarna keert de sterrenballon terug naar de steiger. Aan een paal hangt Fiep een bloem. Als de wind draait, draait de bloem mee.`,
    `De geitjes leggen een kaartje voor de tuinders klaar. Daarop staat wat er straks in elk bed groeit.`,
  ],
]);

const forest = expandAgeVersion(forestText, picks => [
  [
    `Op de vensterbank ligt een grijs blaadje. Roef is met zijn poot door het stof gelopen. Op de grond zie je nog één paadje van kleine afdrukken. Op zijn staart ligt ook een grijs blaadje. Je tilt het eraf. De dunne lijntjes op het blad zijn nog goed te zien.`,
    `Roef neemt je een paar stappen mee tussen de bomen. Onder een struik scharrelt een kever. Hij loopt zonder moeite om een steentje heen. Het bos doet alles nog zoals eerst. Alleen zijn de bomen, de bloemen en bijna alle dieren hun kleuren kwijt.`,
    `Bij de eerste boom hangt een kaartje met een vraagteken. Daar schrijft Roef op wat mensen in het bos vinden. Je houdt de lege waaier bij een grijs blad. Er licht nog geen vakje op. Roef vouwt het eerst weer een beetje dicht.`,
    `Roef wijst met zijn poot naar de grijze bessen aan de struik. ‘Ze kunnen wel nog zoet smaken,’ zegt hij. Hij steekt zijn neus naar voren. Dan draait hij zijn oor naar de takken. Daar klinkt opnieuw het wijsje.`,
  ],
  [
    `Roef houdt zijn poot stil in de lucht. Er hangt een lichtje boven. Het is goed te zien tussen de grijze bladeren. Je probeert het stipje met je ogen te volgen. Het beweegt al als Roef zijn waaier een klein beetje naar het licht draait.`,
    `Het vogeltje springt een tak lager. Roef maakt een nieuw vakje in zijn waaier open en legt zijn poot tegen de boom. ‘Ik wil dit onthouden,’ zegt hij. ‘Het eerste rood hebben we gezien zonder dat we iets hoefden te plukken.’ Hij wenkt je verder het bos in.`,
    `Bij de plas duwt een rimpel de takken in het water heen en weer. Als het water weer stil ligt, zie je de takken scherp. De paardenbloem staat juist helemaal stil. Er ligt een smal streepje schaduw achter haar dunne steeltje.`,
    `Roef legt zijn poot op de boomstam. ‘Je mag iets moois ook alleen maar onthouden,’ zegt hij. Hij kijkt naar de plas en naar de bloem. Allebei staan vlak bij het pad. Er is tijd om rustig te kijken.`,
  ],
  [
    `Roef houdt de waaier naast een blad. Eén hoekje van het blad trilt. De rest van de tak beweegt mee. Het blad dwarrelt naar de grond. Roef draait zijn staart precies zoals het blad draait. Je wacht even, maar de varen heeft nog steeds geen kleur.`,
    `Onder de varen klinkt een giechel. Je bukt om te kijken. Het roodborstje springt naar een lage tak en wil helpen. Jij hoort een klein tikje tegen een boom. Even later klinkt het verderop nog eens, alsof er iemand tussen de stammen antwoord geeft.`,
    `Roef legt zijn waaier op een omgevallen tak. Dan heeft hij zijn pootjes vrij. Achter de bladeren steekt een egel zijn neus naar voren. Hij kijkt stil toe. De grijze varens zijn naar jullie toe gebogen, alsof ze klaarstaan om mee te doen.`,
    `Het roodborstje klapt één keer met zijn vleugels en wacht. Net dan valt er nog een blad. Het landt naast Roefs poot. Jij schudt zacht met je handen. Er zit genoeg ruimte tussen de bomen om samen te spelen.`,
  ],
  [
    `Tussen de nieuwe groene blaadjes kun je de blauwe lucht weer zien. De zon legt gele streepjes op het pad. Onder de paddenstoel valt één zo'n streepje precies op de bloem. Dan zie je pas hoe dun de zilveren rand om de blaadjes is.`,
    `Roef gaat plat op zijn buik liggen. Jij gaat erbij zitten. Een mier loopt om de stengel heen. Ze sjouwt een grasspriet die langer is dan zijzelf. Onder jouw hand valt er schaduw op de bloem. De rand wordt donkerder. In de zon glimt hij weer.`,
    `Roef schuift een leeg vakje van de waaier opzij. Het zilver mag naast de andere kleuren. Hij kijkt naar de losse stenen op het pad. Ze liggen ver genoeg uit elkaar om er één op te pakken. Tussen de takken blijft zacht een tingeltje klinken.`,
    `‘Kijk eens hoe mooi de bloem al is,’ zegt Roef. Hij houdt zijn poot in het licht en dan in de schaduw. Jij doet hetzelfde. Jullie willen iets bij de bloem maken dat past bij het zachte zilver.`,
  ],
  [
    `Roef draait de waaier om. Op de achterkant staat een oor. Hij heeft ook een neus, een veer en twee voeten getekend. Met zijn poot gaat hij de plaatjes langs. Bij de dansende voeten denkt hij aan het moment dat de blaadjes groen werden.`,
    `Naast de omgevallen stam liggen kleurpotloden. Roef legt papier op de stam. Jij schuift een zacht blaadje onder je knie. Een paar bosdieren wachten aan de rand van het pad. Ze zijn benieuwd welk plekje de bezoekers als eerste kunnen ontdekken.`,
    `Je ziet het zilveren bloemetje nog in het licht staan. De grond om het steeltje heen is warmbruin. Van hier zie je ook de plas en de toppen van de bomen. Het is een fijne plek voor het kaartje met het nieuwe pad of voor een tekening in het boek.`,
    `De bladen van het boek zijn breed. Er is ruimte voor een tekening en een woord. Bij het lege bord staat een pot om de kleurpotloden in te zetten. Roef legt zijn poot op het eerste vel papier.`,
  ],
  [
    `Bij de zilveren bloem zet jij een dun takje neer. De bezoekers kunnen het bloemetje daardoor al van ver vinden.`,
    `Bij de plas buigt een bezoeker zich voorover. In het water ligt een wolk die op een want lijkt. Verderop telt iemand de lichtvlekjes op de zilveren bloem. Je ziet dat elke bezoeker iets anders vindt. Roef laat zijn waaier aan een kind zien.`,
    `Bij de eerste boom zingt het roodborstje zijn wijsje. Het konijn blijft even staan. Roef kijkt vanuit de ingang mee. Morgen kan hij daar meehelpen als iemand het pad zoekt.`,
    `Het konijn keek eerst alleen naar de grond. Bij de aardbeien steekt het zijn neus omhoog. Daarna loopt het uit zichzelf verder.`,
  ],
  [
    `Roef vouwt de volgende bladzijde om. Daar teken je ${picks[2] === 0 ? 'twee handen die zwaaien zoals de blaadjes' : 'twee handen die in de bomen klappen'}. Roef kleurt er een groene varen bij. Jullie zijn een poosje stil. Dan hoor je buiten dezelfde blaadjes ritselen.`,
    `De egel ziet dat er onder jullie tekening nog ruimte is. Met een potlood tekent hij de zilveren bloem opzij. Daardoor kun je het steeltje goed zien. Roef schuift het boek een beetje opzij, zodat het niet tegen de natte boomrand komt.`,
    `Roef beweegt zijn waaier zacht heen en weer. Het blad van de varen blijft groen terwijl het mee beweegt. De boomholte krijgt een kapje van schors. Zo kan de regen niet op het boek druppelen. Morgen mag ieder dier er weer in kijken.`,
    `Aan het eind van het boek tekent Roef een leeg vak. De egel hoeft er vandaag nog niets in te zetten. Later kan iemand iets anders in het bos vinden. Dat mag in het lege vak.`,
  ],
]);

export const storyLevelsFinal: Record<string, AgeVersion> = { balloon, forest };
