type Level = 'under6' | '6to8';
type Rewrite = (picks: number[], hero: string, band: Level, step?: number) => string;

const station: Rewrite = (picks, hero, band, step) => {
  const young = band === 'under6';
  const [friendChoice, route, remedy, clue, destination] = picks;
  const helped = friendChoice === 0;
  const friend = helped ? 'Dibbel' : 'Vos';
  const tell = (...paragraphs: string[]) => paragraphs.join('\n\n');

  switch (step) {
    case 0:
      return tell(
        young
          ? `${hero} doet het gordijn open. Kijk eens! Er staat een station tussen de bloemen. Een vos zwaait naast de trein. Zijn pet staat scheef. Hij houdt zijn fluitje in zijn hand.`
          : `${hero} schuift het gordijn open. Tussen de bloemen staat ineens een station. Naast de trein zwaait een vos met een scheve muts. ‘Instappen!’ roept hij.`,
        young
          ? '‘Ik ben Vos. Ik bestuur de trein. Maar ik weet niet meer waar hij heen moet!’ Op een bord draaien de letters rond. Er komt geen naam.'
          : 'Dan kijkt Vos naar het bord. De letters draaien rond, maar er verschijnt geen plaatsnaam. ‘O nee, ik weet niet meer naar welk station we moeten,’ zegt hij.',
        young
          ? 'Je stapt op het perron. Dat is het pad naast de trein. De planken voelen warm door de zon. Het ruikt naar appelbroodjes.'
          : 'Je stapt op het perron naast de trein. De houten planken zijn warm van de ochtendzon. Ergens ruikt het naar appelbroodjes. Vos houdt zijn fluitje nog even stil.',
        young
          ? 'Bij de trein zit een draakje. Hij heet Dibbel. Hij laat zijn kaartje zien. Het is precies door zijn getekende stoel gescheurd. Hij kijkt naar de stoel op zijn kaartje. ‘Waar moet ik nu zitten?’'
          : 'Een klein draakje zit naast de trein. ‘Ik ben Dibbel,’ zegt hij. ‘Mijn kaartje is precies door mijn stoel gescheurd. Nu weet ik niet waar ik mag zitten.’',
        young
          ? 'Er is nog een leeg hoekje voor een sticker. Onder het bankje glimt ook iets. Het is een gouden sleutel. Bij de klok hangt een kastje.'
          : 'Je ziet een leeg hoekje op het kaartje. Daar past misschien een sticker. Dan valt er licht onder het bankje. Daar glimt een gouden sleutel. Bij de klok zie je een kastje met een slot.',
        young
          ? 'Vos laat de trein nog even wachten. Help je Dibbel met zijn kaartje? Of kijk je waar de sleutel op past?'
          : 'De trein hoeft nog niet weg. Ga je Dibbel helpen met zijn treinkaartje, of zoek je uit waar de gouden sleutel op past?'
      );
    case 1:
      return tell(
        helped ? (young
          ? 'Je plakt een stersticker over de scheur. Het kaartje is weer heel. Dibbel lacht. Hij stopt het kaartje in zijn reisjas en klimt naast je in de trein.'
          : 'Je plakt een gouden ster over de scheur in Dibbels kaartje. De sticker houdt de helften bij elkaar. Dibbel stopt het kaartje in zijn reisjas en klimt naast je aan boord.')
          : (young
            ? 'De gouden sleutel opent het kastje. Er ligt een kaart in. Vos vouwt de kaart open. De sporen schuiven over het papier. Er rijdt een klein treintje overheen!'
            : 'De gouden sleutel past op het kastje. Vos vouwt de kaart open die erin ligt. De spoorlijnen schuiven tot aan de rand. Kijk, over het papier rijdt een piepklein treintje!'),
        young
          ? 'Klik! De deuren gaan dicht. Vos blaast op zijn fluit. Tjoek, tjoek, daar gaat de trein. Je drukt je neus tegen het raam. Buiten glijden bloemen langs de wielen.'
          : 'Met een klik gaan de deuren dicht. Vos blaast op zijn fluit en de trein komt langzaam op gang. Bloemen glijden langs het raam.',
        young
          ? 'Je ziet de klok van het station nog even. De wijzers zwaaien. Het lijkt alsof de klok jullie uitzwaait. Dan gaat de trein langzamer.'
          : 'De wijzers van de stationsklok bewegen alsof ze jullie uitzwaaien. Dan remt de trein. Voor je zie je dat het spoor in tweeën gaat.',
        young
          ? 'Links hoor je muziek. Die komt uit een bos in de wolken. Er zweven noten tussen de bomen. Je kunt ze zien!'
          : 'Links klinkt muziek uit een bos tussen de wolken. Tussen de bomen zweven muzieknoten. Ze zijn zo groot dat je ze met je ogen kunt volgen.',
        young
          ? 'Rechts branden lampjes tussen de heuvels. Ze gaan één voor één aan. Vos wijst naar een grote hendel. Daarmee kies je een spoor.'
          : 'Rechts knipperen kleine gouden lantaarns tussen de heuvels. Samen wijzen ze een pad aan. ‘Met deze hendel kies je welk spoor we nemen,’ legt Vos uit.',
        young ? 'Rijden jullie naar de muziek of naar de lampjes?' : 'Welk spoor wil jij volgen, de muziek of de gouden lampjes?'
      );
    case 2:
      return tell(
        route === 0 ? (young
          ? 'Je rijdt langs bomen die zingen. Ze wiegen mee met de trein. Aan hun takken zitten bloemen. Elke keer dat een bloem opengaat, hoor je een noot.'
          : 'De muziek komt uit bomen met witte bloemen. Ze wiegen op de maat van de trein. Elke bloem die opengaat, laat een nieuwe noot tussen de takken horen.')
          : (young
            ? 'De lampjes brengen je naar een station op een heuvel. Ze maken ronde gele vlekken op de grond. Bij het laatste lampje staat een bankje voor kleine reizigers.'
            : 'De lantaarns wijzen naar een station op een heuvel. Hun warme licht valt in ronde vlekken op het perron. Bij de laatste lamp zie je een bankje voor kleine reizigers.'),
        young
          ? `Dan klinkt er een harde hik. HIK! Een wolk tilt het spoor op. ${friend} kijkt omhoog. Vos trekt aan de rem. De trein kan niet verder.`
          : `Dan klinkt er een harde hik. Een grote wolk niest het volgende stuk spoor omhoog. Vos remt meteen. ${friend} staart naar de rails die nu boven de trein zweven.`,
        young
          ? '‘Sorry,’ zegt de wolk. Zijn wangen worden rood. ‘Mijn neus kriebelt.’ Hij probeert stil te blijven. Bij elke hik springt er een plukje mist omhoog. Het schiet langs het raam en maakt de ruit even wit.'
          : 'De wolk bloost. ‘Sorry, het kriebelt in mijn neus.’ Hij probeert de hik tegen te houden. Toch stuitert bij elke hik weer een klein plukje mist de lucht in.',
        young
          ? 'Het spoor hangt als een slinger in de lucht. Op het bankje staat een pot warme thee. Er staat een zon op. Ernaast ligt een boek met liedjes.'
          : 'Het spoor hangt voor de trein als een feestslinger. Op het bankje staat een pot wolkenthee met een getekend zonnetje. Ernaast ligt een liedboek. De bladzijden ritselen zacht.',
        young
          ? '‘Fijn dat jullie wachten,’ zegt de wolk. Zijn hik klinkt nu als een trompetje. Zing je voor hem? Of geef je hem warme thee met een druppel zon?'
          : '‘Wat fijn dat jullie even wachten,’ zegt de wolk. Zijn volgende hik klinkt al als een trompetje. Misschien helpt een lied. Of geef je hem warme thee met een druppeltje zon?'
      );
    case 3:
      return tell(
        remedy === 0 ? (young
          ? 'De wolk zingt met jullie mee. Dan vergeet hij te hikken. Het spoor zakt langzaam naar beneden. Boven de trein blijft nog even een zilveren kringetje hangen.'
          : 'De wolk zingt mee en vergeet te hikken. Het spoor zakt langzaam terug. Zijn laatste noot blijft nog even als een zilveren kringetje boven de trein hangen.')
          : (young
            ? 'De wolk drinkt de warme thee. Zijn hik gaat weg. Hij blaast het spoor terug op zijn plek. Dan houdt hij het lege kopje tegen zijn wang en lacht.'
            : 'De warme thee helpt meteen. De wolk blaast de rails terug op hun plek. Hij houdt het lege kopje tegen zijn wang en glimlacht nu hij niet meer hoeft te hikken.'),
        young
          ? 'Vos bedankt de wolk met een fluitje. De trein rijdt weer. Bij het volgende station stopt hij. Het perron is schoon. Toch staat er niemand te wachten.'
          : 'Vos bedankt de wolk met een vriendelijk fluitje. De trein kan verder. Op het volgende perron is de grond netjes geveegd, maar er staat niemand te wachten.',
        young
          ? `Er hangt een briefje. Daar staat: ‘Zoek uit wat het verdwaalde station mist.’ ${friend} denkt na. Een lege bloempot wiebelt in de wind.`
          : `Aan de muur hangt een briefje. ‘Wie het verdwaalde station zoekt, moet luisteren naar wat het mist.’ ${friend} leest mee. Op het stille perron wiebelt alleen een lege bloempot.`,
        young
          ? 'Hoor je dat getik? Het komt van ver weg. Het klinkt als een lepeltje tegen een glas. Soms valt het even stil. Dan tikt het weer.'
          : 'In de verte klinkt zacht getik, alsof iemand af en toe met een lepeltje tegen een glas tikt.',
        young
          ? 'Boven jullie maken de sterren een pijl. Op de grond liggen twee glanzende steentjes. Eén ligt onder het briefje. Het andere ligt onder de pijl.'
          : 'Boven het perron staan de sterren in de vorm van een pijl. Je ziet twee glanzende steentjes op de grond, één onder het briefje en één onder de sterrenpijl.',
        young
          ? 'Vos kijkt naar jou. Luister je goed naar het getik? Of volg je de pijl van sterren?'
          : 'Vos kijkt van jou naar het raam. Vertelt het geluid jullie iets? Of wijst de sterrenpijl een nieuwe weg?'
      );
    case 4:
      return tell(
        clue === 0 ? (young
          ? 'Tik, tik. Dat geluid ken je! Het is de klok van jouw station. De klok mist zijn reizigers. Op het perron zie je voetstappen bij de lege bankjes.'
          : 'Je luistert goed en herkent het getik. Het komt van jullie eigen stationsklok. Die mist zijn reizigers! Op het perron verschijnen voetstappen die naar de lege bankjes lopen.')
          : (young
            ? 'De sterren wijzen naar een vergeten perron. Dat ligt achter de maan. De pijl wordt steeds breder. Dan zie je een bankje tussen glanzende bloemen.'
            : 'De sterrenpijl brengt jullie tot achter de maan. De pijl wordt steeds breder en wijst naar een vergeten perron. Er staat een bankje tussen de glanzende bloemen.'),
        young
          ? 'Vos remt en doet de deur open. Je voelt de frisse lucht op je wangen. ‘Nu snap ik het. Het station zoekt een plek voor iedereen!’'
          : 'Vos remt, opent de deur en laat de frisse lucht binnen. ‘Nu begrijp ik het. Ons station zoekt een plek waar iedereen welkom is,’ zegt hij.',
        young
          ? 'Boven een warme lamp hangt een leeg bord. Daar kan de naam komen. Deze trein heeft een nieuwe plek nodig. Daar kunnen straks reizigers wachten. Er staan al bankjes voor hen klaar.'
          : 'Boven een warme lamp hangt een stationsbord zonder naam. De trein heeft zijn bestemming niet zomaar verloren. Er wacht een plek op een naam en op nieuwe reizigers.',
        helped ? (young
          ? 'Dibbel denkt aan zijn vrienden. Ze hebben nog nooit in een trein gezeten. Hij tekent met zijn vinger een extra breed bankje op het natte raam.'
          : 'Dibbel denkt aan de draakjes die nog nooit met de trein zijn geweest. Met zijn vinger tekent hij een extra breed bankje op het beslagen raam.')
          : (young
            ? 'Op je gouden kaart komt een nieuw spoor. Het loopt naar de sterren. Langs het spoor gaan lichtjes aan. Daar kunnen reizigers straks even zitten.'
            : 'Op de gouden kaart verschijnt een spoor naar de sterren. Er lichten kleine rustplekken op, alsof de kaart je alvast laat zien wat er mogelijk is.'),
        young
          ? 'Vos wijst naar de laatste hendel. Maak je een nieuwe halte? Of breng je het station terug naar je huis? Daar mag de hele buurt komen.'
          : 'Vos houdt de laatste hendel voor je vrij. Maak je een nieuwe plek voor avonturen, of breng je het station terug naar huis voor de hele buurt?'
      );
    default:
      if (destination === 1) return tell(
        young
          ? 'De trein stopt tussen de bloemen bij jouw huis. De buren komen kijken. Er komen ook knuffels en kleine dieren uit het bos. Ze maken ruimte voor Vos. Hij draagt de oude klok.'
          : 'De trein stopt tussen de bloemen bij jouw huis. Buren, knuffels en kleine bosdieren komen kijken. Ze maken ruimte als Vos met de klok uit de trein stapt.',
        young
          ? `Vos hangt de klok op. Hij veegt het glas schoon. ‘Welkom in station ${hero}!’ roept hij. De wijzers van de klok draaien vrolijk rond.`
          : `Vos hangt de oude stationsklok op en veegt met zijn mouw een stofje van het glas. ‘Welkom op station ${hero}!’ De wijzers maken een vrolijk rondje.`,
        young
          ? 'Op het lege bord komen plaatjes. Je ziet een bos, een wolk en een perron met sterren. Zo weet je waar je allemaal heen kunt.'
          : 'Op het lege bord verschijnen tekeningen van de nieuwe bestemmingen. Je herkent een bos, een wolk en een perron vol sterren. Zo kunnen alle reizigers zien waar ze heen kunnen.',
        young
          ? 'Voor het loket staat een bankje. Grote en kleine reizigers zitten er naast elkaar. Bij het spoor bewegen de bloemen. De trein fluit nog één keer.'
          : 'Grote en kleine reizigers schuiven bij elkaar op het bankje voor het loket. De bloemen langs het spoor buigen mee wanneer de trein nog één keer zacht fluit.',
        young
          ? 'Vos geeft je een gouden sleutel. Die opent het kastje met de tijden van de trein. Luister, de klok tikt. Vandaag is de trein thuis.'
          : 'Vos geeft je een gouden stationssleutel. Daarmee open je het kastje met de vertrektijden. De klok tikt zacht. De trein staat voor vandaag rustig thuis, precies om de hoek.'
      );
      if (helped) return tell(
        young
          ? 'Dibbel haalt zijn vrienden. Ze hebben nog nooit een trein gezien. Ze lopen nieuwsgierig om de wielen heen. Uit hun neus komen kleine feestwolkjes.'
          : 'Dibbel zwaait naar zijn vrienden. Ze hebben nog nooit een trein gezien. De draakjes lopen nieuwsgierig om de wielen en blazen kleine feestwolkjes.',
        young
          ? 'Vos laat zien waar de draakjes rustig kunnen instappen. Dibbel haalt zijn kaartje uit zijn jas. Hij wijst trots naar de gouden ster op de scheur. Dat was jouw ster!'
          : 'Vos laat zien waar iedereen rustig kan instappen. Dibbel haalt zijn kaartje uit zijn borstzak. Trots laat hij de gouden ster zien die zijn kaartje bij elkaar houdt.',
        young
          ? 'Samen maken jullie een halte voor draakjes. De bankjes zijn breed genoeg voor hun staarten. Eén draakje schildert een trein op een bord. Een ander legt kussens neer.'
          : 'Jullie bouwen een eigen drakenhalte met extra brede bankjes. Op een bord schildert een draakje een trein. Een ander legt zachte kussens klaar voor alle staarten.',
        young
          ? 'De draakjes maken hun eerste ritje. Ze houden hun kaartjes omhoog. De klok tikt op de maat van hun vrolijke stemmen. Je hoort de draakjes al van ver.'
          : 'Vos fluit voor het eerste ritje. Alle draakjes houden netjes hun kaartje omhoog. De stationsklok lijkt mee te tikken op de maat van hun vrolijke stemmen.',
        young
          ? 'Vos geeft je een kaartje met een gouden rand. Er zit een ster op. De draakjes zwaaien. Op dit station ben jij altijd welkom.'
          : 'Vos geeft jou een kaartje met een gouden rand en een ster, net als bij Dibbel. Wanneer de trein vertrekt, zwaaien alle draakjes. Op hun perron ben jij altijd welkom.'
      );
      return tell(
        young
          ? 'Je gouden kaart geeft licht. Achter de maan verschijnt een perron. Er staan sterrenbloemen. Elk bloempje laat een lichtje over het pad glijden.'
          : 'Je gouden kaart licht op. Achter de maan verschijnt een perron vol sterrenbloemen. Elke bloem laat een klein licht over het pad schuiven.',
        young
          ? 'Reizigers kunnen hier uitrusten. Ze kunnen ook vragen waar ze heen moeten. Vos doet de deur open. Een moe muisje komt aan. Het draagt een heel grote koffer.'
          : 'Reizigers kunnen op deze halte uitrusten en de weg terugvinden. Vos opent de deur voor een slaperige wolkenmuis. De koffer van de muis is bijna groter dan hijzelf.',
        young
          ? 'Op je kaart laat je de sporen zien. De muis zoekt eerst een bankje uit. Daar eet hij zijn boterham. Boven het bankje gaat een zachte lamp aan. Het licht schijnt op de grond.'
          : 'Je wijst op de kaart waar alle sporen naartoe lopen. De muis kiest eerst een rustig bankje om zijn boterham te eten. Boven het perron komt een warm licht dat nooit in iemands ogen schijnt.',
        young
          ? '‘Jij bent de ereconducteur. Jij mag helpen op het station,’ zegt Vos. Hij geeft je een mooie ster. Je speldt hem op je jas. Dan vouw je de kaart weer dicht.'
          : '‘Jij bent onze ereconducteur,’ zegt Vos. Hij geeft je een fonkelende ster om op je jas te spelden. Als de muis zijn boterham op heeft, vouw je de kaart tevreden dicht.',
        young
          ? 'Alle reizigers hebben hun plek gevonden. Morgen mag je weer kijken waar een spoor heen gaat. Nu is het tijd om te rusten.'
          : 'Voor vandaag hebben alle reizigers hun plek gevonden. Morgen mag je weer op zoek naar een nieuwe bestemming.'
      );
  }
};

const dream: Rewrite = (picks, hero, band, step) => {
  const young = band === 'under6';
  const [route, recipient, rescue, helperChoice, garden] = picks;
  const helper = route === 0 ? 'Melle de mol' : 'Fien de vliegende vis';
  const name = route === 0 ? 'Melle' : 'Fien';
  const bear = recipient === 0;
  const first = bear ? 'de beer' : 'het maantje';
  const tell = (...paragraphs: string[]) => paragraphs.join('\n\n');

  switch (step) {
    case 0:
      return tell(
        young
          ? `Tik, tik! Bij het raam zweeft Pippa de uil. Haar posttas is veel te groot. ‘${hero}, help je mee? Een droom zit in het verkeerde pakje.’`
          : `Tik, tik. Voor het raam zweeft Pippa de uil met een reusachtige posttas. ‘${hero}, een droom zit in het verkeerde pakje. Wil je me helpen?’`,
        young
          ? 'Uit haar tas klinkt gesnurk. Dan hoor je een trompet. ‘Iemand heeft vannacht een gekke droom,’ zegt Pippa. Pippa gaat op de vensterbank zitten. Ze legt een kaart met zilveren stipjes naast zich neer.'
          : 'In haar posttas klinkt gesnurk. Dan toetert er een trompet. Iemand krijgt vannacht misschien wel een heel gekke droom. Pippa landt op de vensterbank en vouwt haar kaart uit. De straten zijn getekend met zilveren stipjes.',
        young
          ? 'Pippa wijst met haar vleugel. Een huisje komt uit de kaart omhoog. ‘Daar woont de beer. Hij wil dromen over honingbloemen. Maar kijk eens in zijn pakje!’'
          : 'Als Pippa met haar vleugel wijst, komt er een huisje omhoog. ‘De beer die daar woont, krijgt een droom over honingbloemen. Maar in zijn pakje danst een onderbroek!’',
        young
          ? 'Een onderbroek danst heen en weer. De tas hikt. Er vliegt ook een piepklein muzieknootje uit. Jij vangt het in een lege envelop. Pippa lacht.'
          : 'De posttas hikt en er ontsnapt een muzieknootje. Jij vangt het in een lege envelop. Pippa lacht opgelucht en zet haar tas weer recht.',
        young
          ? 'Op de kaart staan twee pijlen. Onder de boom is een tunnel met lampjes. Boven de boom loopt een brug van regenbooglicht tot tussen de wolken.'
          : 'Op de kaart verschijnen twee wegwijzers. Onder de wortels gaat een tunnel met lampjes de grond in. Een regenboogbrug slingert rustig boven de wolken.',
        young ? 'Pippa pakt haar tas. Welke weg nemen jullie?' : 'Pippa trekt haar tas recht. ‘Welke weg zullen we proberen?’'
      );
    case 1:
      return tell(
        young
          ? `${helper} komt mee. ‘Ik weet een geheime weg,’ zegt ${name}. Bij een plek waar de weg in tweeën gaat, begint de tas van Pippa te trillen.`
          : `${helper} komt met jullie mee. ‘Ik ken een geheime weg,’ fluistert ${name}. Op de plek waar de weg in tweeën gaat, begint Pippa’s tas te trillen.`,
        young
          ? '‘De beer kan niet slapen. Zijn droom is kwijt,’ zegt Pippa. ‘En het maantje blijft maar lachen. Het kreeg een droom over dansende onderbroeken!’'
          : 'De beer ligt wakker omdat zijn droom is verdwenen. Het maantje heeft de droom over de dansende onderbroeken gekregen. Daar krijgt het de slappe lach van.',
        young
          ? 'Pippa zet haar tas op een zacht bankje. Ze haalt er twee pakjes uit. Op het ene kaartje staat een honingpot. Op het andere staat een halve maan.'
          : 'Pippa zet de tas op een zacht bankje en bekijkt de kaartjes aan de strikjes. Op het ene staat een honingpot en op het andere een halve maan.',
        young
          ? `‘De kaartjes kloppen. Alleen de dromen zitten verkeerd.’ ${name} houdt de kaartjes bij de pakjes. Bij de maan hoor je een giechel. Bij de pot hoor je een slaperige zucht.`
          : `‘De adressen kloppen nog,’ zegt Pippa. ‘De dromen zitten alleen in de verkeerde pakjes.’ ${name} houdt de kaartjes naast de pakjes. Bij de maan klinkt een giechel en bij de honingpot een slaperige zucht.`,
        young
          ? 'Bij de beer brandt een geel licht. Het maantje wiebelt op een wolk. Het houdt zijn mond dicht. Even gaat het goed. Dan moet het weer lachen.'
          : 'In de verte brandt warm licht bij het raam van de beer. Het maantje schommelt op een wolk en probeert ernstig te kijken. Dat lukt telkens maar even.',
        young
          ? 'Pippa houdt de pakjes goed vast. ‘We helpen ze allebei. Wie helpen we eerst?’'
          : 'Pippa bewaart de twee pakjes zorgvuldig. ‘Iedereen komt aan de beurt. Wie helpen we als eerste?’'
      );
    case 2:
      return tell(
        young
          ? `Jullie komen bij ${first}. Een strikje schiet los. Floep! Er vliegen zes droombellen uit het pakje. Pippa wappert snel met haar vleugels.`
          : `Bij ${first} schiet de strik van een pakje los. Floep, daar gaan zes glanzende droombellen! Pippa probeert ze met haar vleugels tegen te houden.`,
        young
          ? 'In één bel rijdt een slak op rolschaatsen. In een andere groeit een ijsje tot aan de sterren. De slak zwaait naar beneden. Hij rijdt gewoon verder. Hij merkt niet dat zijn droom aan het wegvliegen is.'
          : 'In één bel rijdt een slak op rolschaatsen. In een andere groeit een ijsje tot aan de sterren. De slak zwaait rustig naar beneden. Hij merkt niet dat zijn droom op stap is.',
        young
          ? `${name} wijst naar de grootste bel. Die zweeft steeds verder weg. Hij is al bijna aan de rand van het plein. Jij houdt een lege envelop omhoog. Maar zo’n ronde bel past daar niet in.`
          : `${name} wijst de grootste bel aan. Die waait bijna het plein af. Jij probeert een kleinere bel in een lege envelop te vangen, maar hij is te rond en past er niet in.`,
        young
          ? '‘Niet knijpen,’ zegt Pippa. ‘Dromen hebben ruimte nodig.’ Ze houdt haar tas wijd open. Als ze neuriet, dansen de kleine bellen naar haar toe.'
          : '‘Niet knijpen,’ zegt Pippa zacht. ‘Dromen hebben ruimte nodig.’ Ze houdt haar tas extra ver open. Als Pippa neuriet, wiegen de kleine bellen op haar lied mee.',
        young
          ? 'Bij een zacht bankje staan twee stokjes met een ster erop. Pippa heeft ook een lange sjaal. Met de stokjes en de sjaal kun je een zacht net maken.'
          : 'Op het plein staan twee sterrenstokjes naast een zacht bankje. Pippa heeft een lange sjaal bij zich. Met de sjaal en de stokjes kun je een zacht net maken.',
        young
          ? 'De grote bel drijft verder. Zing je de dromen terug? Of vang je ze met het zachte net?'
          : 'De grote bel drijft naar de rand van het plein. Lok je de droombellen terug met een liedje of probeer je een vangnet te maken?'
      );
    case 3:
      return tell(
        rescue === 0 ? (young
          ? 'Je zingt. De kleine bellen dansen op je liedje. In zijn bel rolt de slak nog één rondje op zijn wieltjes. Dan gaat ook zijn bel veilig in de tas.'
          : 'De kleine bellen dansen op jullie liedje terug naar Pippa. De slak in zijn bel maakt op zijn rolschaatsen nog één mooi rondje. Dan belandt ook zijn bel veilig in haar tas.')
          : (young
            ? 'De sjaal en stokjes worden een zacht net. Je vangt alle kleine bellen. Pippa houdt haar tas eronder. De bellen rollen één voor één veilig naar binnen.'
            : 'Het zachte net houdt alle kleine droombellen tegen. Pippa schuift haar tas onder het net. Voorzichtig laat je de bellen één voor één weer naar binnen rollen.'),
        young
          ? 'Eén grote bel blijft hoog boven het plein. ‘Ik ben nog niet klaar,’ piept de droom. Pippa staat onder de bel en kijkt omhoog. Ze ziet een tuin.'
          : 'Alleen de grootste bel hangt nog hoog boven het plein. ‘Ik ben nog niet klaar!’ piept de droom. Pippa gaat eronder staan. In de bel ziet ze een verdrietige tuin.',
        young
          ? '‘Wat heb je nog nodig?’ vraagt Pippa. In de tuin staat een kaal bankje. Er zijn geen bloemen. Een schommel gaat zacht heen en weer. Er zit niemand op. Kijk, zelfs bij de schommel groeit geen enkel bloempje.'
          : '‘Wat ontbreekt er dan?’ vraagt Pippa. In de tuin staat een kaal bankje naast een leeg bloembed. Een schommel beweegt heel zacht, terwijl er niemand op zit.',
        young
          ? `De droom wil nog iets laten groeien. Bij de rand van de bel gaat een klein deurtje open. De rand van de deur glinstert. Je kunt de tuin goed zien. ‘Ik kan helpen zoeken,’ zegt ${name}.`
          : `De droom zoekt nog iets om te laten groeien. ${helper} steekt voorzichtig een pootje op. ‘Volgens mij kan ik helpen.’ Langs de rand van de bel verschijnt een deurtje waar je doorheen kunt kijken.`,
        young
          ? `Pippa wacht bij de deur. Kijk je met ${name} wat de tuin nodig heeft? Of stap je zelf de droom in?`
          : `Pippa blijft bij de ingang wachten. Ga je samen met ${name} op onderzoek, of stap je zelf de droom in om te ontdekken wat de tuin nodig heeft?`
      );
    case 4:
      return tell(
        helperChoice === 0 ? (young
          ? `${name} kijkt met je onder het bankje. Tussen twee plankjes blinkt een warm lichtje. Jullie halen er een klein zaadje uit. Het geeft licht in je hand.`
          : `Samen met ${helper} kijk je onder het bankje. Tussen twee plankjes blinkt een warm lichtje. Jullie halen er een klein droomzaadje uit. Zodra je het aanraakt, geeft het licht.`)
          : (young
            ? 'Je kijkt tussen de kale takken. Daar ligt een zaadje op een blad. Het blad is krom als een kommetje. Als je het zaadje pakt, geeft het warm licht.'
            : 'Tussen de kale takken ontdek je een droomzaadje op een blad dat als een kommetje naar de zon staat. Zodra je het optilt, zie je een warm lichtje.'),
        young
          ? 'Het zaadje past precies in je hand. Je ziet er even een bloem in. Dan zie je een boom. Dan een bankje waar ook je vrienden op passen.'
          : 'Het zaadje past precies in je hand. Door het glanzende velletje zie je eerst een bloem, dan een boom en dan een bank met genoeg plaats voor vrienden.',
        young
          ? 'De blaadjes in de droomtuin ritselen. Pippa lacht. ‘De droom wilde niet weg. Hij wilde eerst iets moois worden. Het zaadje kan op meer dan één plek groeien. Zoek maar een fijn plekje uit.’'
          : 'De droomtuin ritselt tevreden. ‘Nu snap ik waarom de droom niet weg wilde,’ zegt Pippa. ‘Hij wilde eerst zelf een mooie tuin worden. Het zaadje kan op verschillende plekken groeien. We hoeven alleen een fijne plek te kiezen.’',
        young
          ? 'Buiten de bel zijn de andere dromen veilig in Pippa’s tas. Ze heeft de kaartjes weer aan de juiste strikjes gedaan. Het zaadje heeft nog geen plek.'
          : 'Buiten de bel zitten de andere droompakjes veilig in Pippa’s tas. De adressen hangen weer aan de goede strikjes. Voor dit zaadje kiezen jullie zelf een plek.',
        young
          ? `Je kunt een droomtuin planten waar iedereen mag komen. Je kunt het zaadje ook aan ${first} geven. Dan groeit er een eigen plekje. Wat doe je?`
          : `Plant je het zaadje waar alle slapers samen kunnen dromen? Of geef je het aan ${first} om die ene droom een eigen bijzonder plekje te geven?`
      );
    default:
      if (garden === 0) return tell(
        young
          ? 'Uit je zaadje groeit een tuin. Eerst zie je één blaadje. Dan komen de bloemen. Er groeit ook een boom met plek voor een zacht bankje.'
          : 'Uit jouw zaadje komt één blaadje. Dan groeit er een slinger van bloemen en een boom met genoeg ruimte voor een zacht bankje.',
        young
          ? 'De beer rust onder de boom. Het maantje vertelt een grap. Pippa hangt een bordje aan de poort. Daar staat op wie de tuin begon.'
          : 'De beer rust onder de bloeiende takken. Het maantje vertelt zachtjes een grap en moet er zelf om lachen. Pippa hangt een bordje aan de poort.',
        young
          ? `‘Geplant door ${hero}’, staat op het bordje. ${name} wijst de eerste gasten waar ze kunnen zitten. De slak komt op zijn rolschaatsen langs het pad.`
          : `Op het bordje staat: ‘Geplant door ${hero}.’ ${name} helpt de eerste gasten een fijn plekje te vinden. De kleine slak uit de droombel komt aangerold op zijn rolschaatsen.`,
        young
          ? 'De slak zet zijn rolschaatsen bij de poort. Nu kan hij rustig rondkijken. Jij hoeft ook geen haast te maken. Pippa legt iets kleins in je hand.'
          : 'De slak parkeert zijn rolschaatsen bij de ingang. Zo kan ook hij rustig rondkijken. Niemand hoeft zich hier te haasten. Pippa legt iets in je hand.',
        young
          ? 'Je krijgt een nieuw droomzaadje. Het licht op als de blaadjes zacht ritselen. Iedereen is welkom in deze tuin. Ook voor jou blijft er een plekje vrij.'
          : 'Het is een droomzaadje. Het begint te glinsteren als de tuin nog één keer zacht ritselt. Elke nacht staan hier nieuwe dromen klaar. Tussen de bloemen is altijd een plekje voor jou.'
      );
      if (bear) return tell(
        young
          ? 'De beer maakt naast zijn bed een heel klein kuiltje. Dat doet hij met zijn grote poot. Hij stopt het zaadje erin en doet er aarde over.'
          : 'De beer maakt naast zijn bed een klein kuiltje met zijn grote poot. Hij stopt het zaadje erin en doet er voorzichtig een dekentje van aarde overheen.',
        young
          ? 'Er groeit meteen een honingbloem. De bloem komt precies tot aan zijn kussen. De beer doet zijn ogen dicht. Hij droomt van een veld vol bloemen.'
          : 'Meteen groeit er een honingbloem naast zijn kussen. Zodra de beer zijn ogen sluit, droomt hij van een veld vol honingbloemen. Hij voelt zich weer rustig.',
        young
          ? 'Hij snurkt een zacht wijsje. Pippa doet het goede kaartje aan het lege pakje. Ze zet het op zijn nachtkastje. Zo kan ze later zien waar ze de droom heeft gebracht.'
          : 'Het gesnurk van de beer klinkt nu als een tevreden melodietje. Pippa hangt het goede adres aan het lege pakje. Op zijn nachtkastje kan ze deze bijzondere bezorging altijd terugvinden.',
        young
          ? 'Voor je weggaat, plukt de beer een bloem van droomlicht. Pippa stopt de bloem in je hand. De beer zwaait slaperig met één poot.'
          : 'Voor je gaat, plukt de beer een bloempje van droomlicht. Pippa legt het kleine bedankje in je hand. De beer zwaait slaperig met één poot.',
        young
          ? 'Nu kan de beer fijn slapen. Als hij weer droomt, mag jij langskomen.'
          : 'Je laat hem lekker verder slapen. De volgende keer dat hij droomt, mag jij weer bij hem op bezoek.'
      );
      return tell(
        young
          ? 'Op de maan groeit een tuintje. Het is een heel klein tuintje. De bloemen ruiken nergens naar. Ze geven vrolijke droompjes! Uit één bloem komt een bel met een dansend kussen.'
          : 'Op de maan groeit een klein tuintje. De bloemen ruiken nergens naar, maar ze geven vrolijke droompjes. Uit de eerste bloem komt een droombel met een dansend kussen.',
        young
          ? `In de tweede bloem zie je een bootje van wolken. Het maantje zet een bankje tussen de bloemen. ‘Je mag hier altijd komen, ${hero}!’ zegt het maantje. Het geeft je een knipoog.`
          : `In de tweede bloem zie je een bootje van wolken. Het maantje zet een bankje tussen de bloemen. Met een zilveren knipoog zegt het: ‘Dit is ook jouw plekje, ${hero}.’`,
        young
          ? 'Pippa kijkt nog één keer naar de kaartjes. Alle pakjes zijn op de goede plek. Haar posttas is eindelijk stil. Het maantje geeft je een zilveren bloem.'
          : 'Pippa bekijkt de adreskaartjes nog één keer. De pakjes hebben hun goede bestemming gevonden. Haar tas klinkt eindelijk rustig. Het maantje geeft jou een zilveren maanbloem mee.',
        young
          ? 'Pippa vliegt met je terug naar je bed. Er schijnt een streepje licht op je gordijn. Op de maan wiegt het nieuwe bankje in de wind.'
          : 'Samen vliegen jullie terug naar je raam. Er schijnt nog een streepje licht op je gordijn. In de verte wiegt het bankje in de tuin zacht heen en weer.',
        young
          ? 'Je legt de bloem bij je kussen. Nu kun jij ook fijn gaan dromen.'
          : 'Je legt de maanbloem bij je kussen. Alles is klaar voor een fijne droom, precies op tijd voor de nacht.'
      );
  }
};

export const storyLevelsOriginal: Record<string, Rewrite> = { station, dream };
