type LevelText = (picks: number[], hero: string, band: 'under6' | '6to8', step?: number) => string;

const paragraphs = (...blocks: string[]) => blocks.join('\n\n');

const weather: LevelText = ([labels, ride, cloud, light, party], hero, band, step) => {
  const say = (young: string, middle: string) => band === 'under6' ? young : middle;
  switch (step) {
    case 0:
      return paragraphs(
        say(
          `Ting! ${hero} duwt een winkeldeur open. De winkel staat boven op een groene heuvel. In flessen zit regen. In doosjes zit wind. Onder een zachte muts zit een potje zon.`,
          `Boven op de groene heuvel rinkelt een winkelbel. ${hero} doet de deur open en kijkt rond. Op de planken staan flessen vol regen en doosjes met wind. Een theemuts houdt een potje zonneschijn warm.`
        ),
        say(
          'Mopperwolk staat achter de toonbank. Zijn bril is wit van de damp. ‘Fijn dat je er bent! Het dorp wil mooi weer voor het feest. Maar de briefjes zijn van mijn potjes af.’',
          'Achter de toonbank veegt Mopperwolk zijn beslagen bril schoon. ‘Het dorp heeft mooi picknickweer besteld,’ zegt hij. ‘Maar alle etiketten zijn losgewaaid. Zonder die briefjes weet ik niet waar welk weer in zit.’'
        ),
        'Op de vloer liggen tekeningen. Een potje rommelt. Uit een ander potje steekt een klein stukje regenboog. Buiten staat de lege kar. Mopperwolk laat de doppen zitten. Wie weet wat er anders uit springt! De potjes klinken alsof ze zachtjes tegen elkaar praten.',
        say(
          'Hij haalt een doek, een vergrootglas en kaartjes uit een la. ‘Vanmorgen was alles nog netjes. Toen kwam de wind een sjaal kopen. Hij was zo blij dat hij heel hard blies!’',
          'Uit een laatje haalt hij een zachte doek, een vergrootglas en lege kaartjes. ‘Vanmorgen stond alles nog netjes op zijn plek. Toen kwam de tocht een sjaal kopen. Hij blies van blijdschap alle etiketten door elkaar.’'
        ),
        'Het potje op de rand schudt. Het lijkt wel of het lacht. Je schuift het een stukje terug. Dan zie je een foto van het plein. Tussen de bomen hangen slingers en er staan lange tafels.',
        say(
          'Een muisje heeft een broodje op de achterkant getekend. Straks komen de mensen eten. Nu is er nog tijd om goed te kijken. Mopperwolk zet zijn bril recht. ‘Ik help jou. En jij helpt mij.’',
          'Op de achterkant heeft een muisje een broodje getekend. Het feest begint straks, maar jullie kunnen rustig zoeken. Mopperwolk legt de doek klaar en zet zijn bril recht. ‘Ik help jou, en jij helpt mij.’'
        ),
        'Zoek je de briefjes bij de potjes? Of luister je naar de potjes?'
      );
    case 1:
      return paragraphs(
        labels === 0
          ? say('Je houdt de tekening van de zon bij het warme potje. Dat klopt! Ook de andere briefjes vinden hun plek. Mopperwolk poetst blij zijn bril.', 'Het kaartje met de zon hoort bij het warme potje. Even later zitten de andere etiketten ook weer op hun plek. Mopperwolk poetst opgelucht zijn bril.')
          : say('Tik, tik! In dat potje zit regen. Het potje dat ruist is vol wind. De zon zingt heel hoog. Zo weten jullie wat waarin zit.', 'Je houdt je oor bij de potjes. De regen tikt, de wind ruist en de zon zingt heel hoog. Mopperwolk poetst zijn bril. Nu weten jullie wat waarin zit.'),
        'Jullie zetten de potjes en flessen in de bezorgkar. Het warme potje zon blijft rechtop tussen twee zachte kussens. Zodra de laatste fles in de kar staat, hoor je plop! De wolkenwielen zakken plat.',
        say(
          'Je gaat bij een wiel op je hurken zitten. Het lijkt op een kussen zonder lucht. Mopperwolk tilt het op. Het wordt heel even bol. Dan laat hij het los. Plat als een pannenkoek!',
          'Je hurkt naast een wiel dat eruitziet als een kussen waar de lucht uit is. Mopperwolk pakt een hoekje vast. Het wiel veert even omhoog. Zodra hij loslaat, zakt het weer plat als een pannenkoek.'
        ),
        '‘Vanmorgen waren de wielen nog rond,’ moppert hij. Zijn bril zakt naar het puntje van zijn neus. Jullie moeten lachen. De kar lijkt wel in slaap te vallen. Bij de dorpstoren staan intussen de eerste broodmanden klaar.',
        say(
          'De slak naast de deur steekt zijn ogen uit. Op zijn bordje staat een pijl. Hij schuift alvast wat spullen van zijn sterke plank. Met die plank kan hij de kar naar het plein dragen.',
          'De bezorgslak steekt zijn ogen boven zijn huisje uit. Hij laat zijn bordje met de pijl zien en maakt plaats op zijn sterke bezorgplank. Daarmee zou hij de hele kar kunnen dragen.'
        ),
        'Aan de schoorsteen hangt een lang lint vol kleine briesjes. Het maakt krullen in de lucht. Met dat lint kan de kar boven het pad zweven. Mopperwolk draait alle doppen goed dicht en legt de bezorgdoek over de bestelling.',
        'Even kijkt hij onder de doek. Het warme potje staat nog stevig tussen zijn kussens. Mopperwolk knikt tevreden.',
        'Hoe gaan jullie naar het plein? Met de slak of met het lint?'
      );
    case 2:
      return paragraphs(
        ride === 0
          ? say('De slak schuift zijn sterke plank onder de kar. Hij bromt tevreden en draagt alles naar het plein.', 'De slak schuift zijn sterke plank onder de kar. Tevreden brommend brengt hij de bestelling naar het dorpsplein.')
          : say('Mopperwolk bindt het lint vast. De kar gaat omhoog. Jij trekt hem rustig vooruit, net boven de madeliefjes.', 'Mopperwolk knoopt het lint vast en de kar komt omhoog. Je trekt hem rustig boven de madeliefjes naar het dorpsplein.'),
        'De picknicktafels zijn nog leeg. Bij de limonadekraam hoor je plik, plok. Een klein regenwolkje bleef daar gisteren onder het afdak hangen. ‘Ik kan nergens heen,’ zegt het. Mopperwolk vangt de druppels op met zijn hoed.',
        say(
          'Het wolkje kijkt verdrietig. Bij elke drup trekt het zijn mond omlaag. De vrouw van de kraam zet een kan onder het lek. ‘Mijn bloemen lusten graag regen,’ zegt ze. ‘Maar regenlimonade verkoop ik vandaag niet.’',
          'Bij iedere druppel trekt het wolkje een verdrietig mondje. De kraamhouder zet snel een kan onder het lek. ‘Mijn bloemen mogen best een buitje krijgen,’ zegt ze. ‘Maar regenlimonade staat vandaag niet op de kaart.’'
        ),
        'Het wolkje moet daar een beetje om lachen. Een drup springt op de rand van de kan. Mopperwolk schudt het water van zijn hoed en houdt hem weer onder het wolkje. Naast de kraam hangen de bloemen slap. Die hebben dorst. Daar zou de regen goed terechtkomen.',
        say(
          '‘Niet duwen,’ zegt Mopperwolk. ‘Daar schrikt een wolkje van. Geef het iets fijns om te volgen.’ Bij de deur ruik je rozen. Op de toonbank ligt een lepeltje. Tik er zacht mee en je hoort een mooi geluid.',
          'Mopperwolk legt uit waarom je het wolkje beter kunt lokken. Als je duwt, kruipt het dichter in elkaar. Bij de deur staat een rozenstruik die heerlijk ruikt. Op de toonbank ligt een lepel waar je zacht mee kunt tikken.'
        ),
        'Naast de rozen loopt een paadje om de kraam heen. Het leidt naar de bloemenbakken. Het is smal, maar jullie passen er goed langs. De kraamhouder schuift de glazen opzij, zodat jullie ruimte hebben. Het wolkje stopt even met druppen. Het kijkt wat jullie bedenken.',
        'Maak je een spoor dat naar rozen ruikt? Of tik je een deuntje met de lepel?'
      );
    case 3:
      return paragraphs(
        cloud === 0
          ? say('Het wolkje ruikt de rozen. De geur kriebelt. Het zweeft achter je aan. Bij de bloemen laat het genoeg regen vallen.', 'De rozengeur kriebelt aan het wolkje. Het volgt jouw geurspoor en geeft de bloemen in de bakken precies genoeg water.')
          : say('Tik, tikkerdetik! Het wolkje wiegt met het lepeltje mee. Het volgt je naar de bloembakken. Daar mogen de druppels vallen.', 'Je tikt een rustig ritme op je lepeltje. Het wolkje wiegt op de maat en volgt je naar de bloembakken, waar de regen goed terechtkomt.'),
        'De kraamhouder zwaait opgelucht. Mopperwolk pakt het picknickweer uit. Maar het potje zonneschijn blijft bleek. ‘Er is een zonnespetter uit gesprongen!’ zegt hij. Op de parasols zie je lichte vlekjes. In de druppels aan de bloemen zitten gouden puntjes.',
        say(
          'Mopperwolk houdt zijn pot alvast open. Het lichtje piept als een klein kuiken. Jij komt dichterbij. Meteen springt het geluid naar de volgende vlek. Het lijkt wel of het licht verstoppertje speelt.',
          'Mopperwolk houdt het potje alvast open. De verloren spetter piept als een kuikentje. Je loopt naar het geluid toe, maar dan springt het naar een andere vlek. Het lichtje speelt verstoppertje.'
        ),
        'Er ligt een opgevouwen, glimmende paraplu klaar. Er zit geen gaatje in waar regen door kan vallen. Aan de binnenkant zie je de wolken terug, net als in een zilveren vijver. Er is ook een helder bekertje. Langs de zijkant staan korte streepjes.',
        say(
          'Bij het laagste streepje staat een tekening van een lichtje. Mopperwolk wijst ernaar. ‘Eén zonnespetter is genoeg.’ Op je schoen zit even een gouden vlekje. Als jij een stap zet, gaat het vlekje mee.',
          'Mopperwolk wijst naar de tekening bij het laagste streepje. ‘We hebben maar één zonnespetter nodig.’ Je ziet een vlekje op je schoen dat meebeweegt als jij loopt. Het blijft net lang genoeg zitten om warm te worden.'
        ),
        'Op een parasol verschijnt een ronde neus van licht. Twee oogjes verdwijnen tussen de plooien. Het licht is nooit helemaal weg. Kijk maar hoe het verderop weer opduikt. De kraamhouder schuift de tafels op hun plek. Ze laat de druppels aan de bloemen hangen. Daar kan het lichtje nog even glimmen.',
        'Vang je licht in de druppels met het bekertje? Of klap je de glimmende paraplu open?'
      );
    case 4:
      return paragraphs(
        light === 0
          ? say('Je vangt het licht van de druppels in je bekertje. De vlekjes worden één gouden spetter. Die springt zo terug in het potje.', 'De glinstering van de druppels verzamelt zich in je bekertje. Eén warme zonnespetter springt met een piep terug in het potje.')
          : say('Het licht komt bij elkaar op de paraplu. Alle vlekjes worden één spetter. Die glijdt van de paraplu zo het potje in.', 'De lichtvlekjes glijden over de glansparaplu naar elkaar toe. Samen vormen ze één gouden zonnespetter die in het potje glijdt.'),
        'Meteen kleurt het plein goud. Mopperwolk zet een koel stukje schaduw naast de limonade. Hij laat de slingers zacht waaien. De eerste kinderen komen aan met mandjes brood. Eén jongen zet zijn mandje op de grond.',
        say(
          'De jongen doet een stap naar links. Zijn schaduw gaat mee. Hij stapt naar rechts. Daar is de schaduw weer! Hij lacht hard. Mopperwolk buigt, alsof hij op een podium staat.',
          'De jongen merkt dat de koele schaduw naast hem meeschuift. Hij test het met een stap naar links en nog een naar rechts. Dan schiet hij in de lach. Mopperwolk buigt alsof hij een kunstje heeft laten zien.'
        ),
        `‘Goed weer luistert naar de mensen,’ zegt Mopperwolk. ‘We hebben nog een beetje feestweer, ${hero}.’ In een schaal ligt een regenboog die zo zacht is als een lint. Ernaast ligt een deken van kleine wolken.`,
        'Op het plein worden bekers uitgedeeld. De vrouw van de kraam geeft jullie de eerste twee glazen limonade. Ze houdt een glas tegen de zon. Zeven kleuren dansen door de limonade. Ondertussen vult het plein zich met de warme geur van broodjes.',
        say(
          'Mopperwolk legt het lint en de deken naast elkaar. De doppen mogen op de potjes blijven. Met het lint maak je een pad door de kleine straten. Zo vinden de mensen het plein. Met de deken maak je een picknickplek die met iedereen mee kan bewegen. Jullie mogen het zelf bedenken.',
          'Mopperwolk legt het lint naast de wolkendeken en laat de potjes dicht. Een lint kan de straatjes met het plein verbinden. Wolken kunnen juist een fijne lunchplek maken die meebeweegt met iedereen. Voor allebei heeft hij genoeg weer bewaard. Dit laatste stukje van de bestelling mogen jullie zelf vormgeven.'
        ),
        'Welk feestweer kies jij?'
      );
    default:
      if (party === 0) {
        return paragraphs(
          say(
            'Jullie rollen het regenbooglint door de straatjes. Bij elk bankje ligt een koel stukje schaduw. Boven elke bloembak valt een klein buitje. De mensen volgen de kleuren met hun broodmanden tot aan het plein.',
            'Jullie rollen het lint uit langs de dorpsstraatjes. Het geeft ieder bankje wat schaduw en iedere bloembak een klein buitje. De dorpsbewoners pakken hun broodmanden en volgen de kleuren naar het plein.'
          ),
          'Mopperwolk rijdt nog één rondje om alles te bekijken. ‘Bestelling helemaal goed bezorgd!’ roept hij. Bij de laatste bocht stopt een oud konijn. Hij kijkt naar de kleuren en kiest een bankje met precies genoeg schaduw.',
          say(
            'Een paar kinderen willen alle kleuren tellen. Eén, twee, drie. Dan komt de vrouw van de kraam met limonade. Ze raken de tel kwijt. Dat geeft niets. De kleuren liggen nog op hun plek.',
            'Een paar kinderen tellen de kleuren van het lint. Halverwege worden de glazen uitgedeeld en vergeten ze bij welke kleur ze waren. Morgen kunnen ze weer verder tellen. Het lint blijft rustig liggen.'
          ),
          `Mopperwolk vouwt zijn bezorgdoek op. De potjes zijn bijna leeg. Nu kan hij ze weer dragen. Voor ${hero} heeft hij een heel klein lintje opgerold. ‘Als je dit later openrolt, denk je weer aan onze tocht. En aan al die potjes waarvan we moesten uitzoeken wat erin zat.’`,
          say(
            'Je houdt het lintje in je hand. Bij het blauw is het koel. Bij het geel voelt het warm. Je kijkt nog één keer om. Daar helpen de zeven kleuren de mensen om de weg te vinden.',
            'Je laat het lintje door je vingers glijden. De blauwe kant voelt koel en de gele kant warm. Voor je naar huis gaat, kijk je nog even naar de zeven kleuren die jullie dorp de weg wijzen.'
          )
        );
      }
      if (labels === 0) {
        return paragraphs(
          say(
            'Je vouwt de wolkendeken open boven de tafels. Hij schuift mee met de zon. De broodjes blijven warm. Niemand heeft last van de zon in zijn ogen. Jullie hangen het regenbooglint om de rand.',
            'Je spreidt de wolkendeken boven de tafels. Hij schuift met de zon mee, zodat de broodjes warm blijven en niemand zijn ogen hoeft dicht te knijpen. De regenboog past precies als vrolijke rand om de deken.'
          ),
          `Mopperwolk hangt er een nieuw briefje aan. Daar staat: ‘Picknickweer, met aandacht gemaakt.’ Iedereen zoekt een plekje. ${hero} krijgt het kleinste wolkenlapje. Het voelt zo zacht als een kussen. Het doet je denken aan de winkel vol weer.`,
          say(
            'Een klein meisje kijkt onder de rand. ‘Lust een wolk ook kruimels?’ vraagt ze. Mopperwolk kijkt heel ernstig. ‘Alleen van een regenkoek,’ zegt hij. Iedereen lacht. De deken schudt een beetje, alsof hij moet giechelen.',
            'Een meisje vraagt of de wolk ook kruimels lust. Mopperwolk doet alsof hij heel diep moet nadenken. ‘Alleen kruimels van een regenkoek,’ zegt hij. Daar moeten jullie zo om lachen dat de deken mee lijkt te giechelen.'
          ),
          'Na het eten schuiven de lege mandjes onder de tafels. Niemand hoeft meteen naar huis. Er is tijd voor nog een verhaal en een slokje limonade. Een paar mensen kijken zomaar even naar de slingers. Jullie blijven zelf ook nog een poosje op jullie bank zitten.',
          say(
            'Je vouwt je lapje wolk dubbel. Nu past het in je zak. Het voelt zo zacht als de grote deken boven het plein. Mopperwolk zwaait. De wolkendeken schuift langzaam met de middagzon mee.',
            'Je vouwt jouw stukje wolk voorzichtig dubbel en stopt het in je zak. Het blijft voelen als die zachte schaduw boven het plein. Mopperwolk zwaait terwijl de hele deken rustig meeschuift met de middagzon.'
          )
        );
      }
      return paragraphs(
        say(
          'Mopperwolk hangt stukjes schaduw, zon en regenboog aan een lange tak. Alles kan bewegen. Wie met brood naar het plein komt, krijgt vanzelf een fijn plekje onder een wolkje. Jullie zetten de tafels in een kring.',
          'Mopperwolk knoopt zon, schaduw en een stukje regenboog aan een lange tak. Zo maakt hij een mobiel dat in de wind beweegt. Boven iedere wandelaar met een broodmand blijft een wolkje zweven. Jullie schuiven de tafels in een kring.'
        ),
        `Jullie proeven de limonade. ‘Deze bestelling ga ik onthouden,’ zegt Mopperwolk. Hij geeft ${hero} een knoopje van de tak. Het glimt als de zon. Ook als je het in je jaszak stopt, blijft het zachtjes schijnen.`,
        say(
          'Een broodmand staat alleen midden op het plein. Daar komt een wolkje, precies erboven! Zo blijven de broodjes koel. De vrouw van de kraam zet een kan limonade neer. Ook boven de kan komt schaduw.',
          'Midden op het plein staat een broodmand. Meteen zweeft er een wolkje boven. Zelfs broodjes krijgen zo een koel plekje. De kraamhouder probeert het met haar kan limonade. Ook de kan krijgt een eigen wolkje.'
        ),
        'Mopperwolk kijkt met grote ogen naar wat jullie hebben gemaakt. Dit soort weer heeft hij nooit eerder bezorgd. Later waaien de slingers niet meer zo hard. Op het plein praten de mensen zachtjes met elkaar.',
        say(
          'Je draait het gouden zonneknoopje in je hand. Het maakt een lichtvlekje op je vingers. Het wordt niet heet. Bij de winkelbel staat de lege kar al klaar voor morgen. Mopperwolk zet zijn bril af en komt erbij zitten.',
          'Je draait het zonneknoopje tussen je vingers. Het maakt een gouden vlekje op je hand zonder warm te worden. Bij de winkelbel wacht de lege kar op morgen. Vandaag mag Mopperwolk zijn bril afzetten en bij jullie van het feest genieten.'
        )
      );
  }
};

const moonbakery: LevelText = ([clue, route, moth, dough, breakfast], hero, band, step) => {
  const say = (young: string, middle: string) => band === 'under6' ? young : middle;
  switch (step) {
    case 0:
      return paragraphs(
        say(
          `${hero} zwaait naar de maan. Een rond raampje gaat open. Een konijn steekt haar kop naar buiten. Op haar neus zit meel. ‘Ik ben Mies. Kom je helpen?’`,
          `Wanneer ${hero} naar de maan zwaait, gaat er een rond raam open. Een konijn met een neus vol meel kijkt naar buiten. ‘Ik ben Mies,’ roept ze. ‘Kun je me helpen in de bakkerij?’`
        ),
        'Je klimt op een trapje van maanlicht. Hier liggen sterrenbroodjes op kussens. De oven staat op gouden voetjes. Het grote brood in de kom is zo plat als een pannenkoek. Met dat brood moet straks de ontbijtbel gaan klinken. Pas als het brood gebakken is, kan het ontbijt beginnen.',
        say(
          'Mies heeft het deeg al gekneed. Ze heeft gewacht. Ze heeft achter haar oren gekrabd. Niets helpt. Ze legt een schone handdoek op een kruk. ‘Ga maar bij de tafel zitten,’ zegt ze.',
          'Mies heeft het deeg gekneed en lang gewacht. Ze heeft zelfs achter haar oren gekrabd, maar het brood blijft plat. Ze legt een schone handdoek op een kruk, zodat je fijn bij de tafel kunt zitten.'
        ),
        'Over de vloer loopt een dun streepje maanlicht. Het kringelt om de kom. Het deeg wordt er niet wakker van. ‘Gisteren was het brood zó hoog!’ Mies houdt haar oren recht omhoog. Dan laat ze ze slap langs haar wangen hangen.',
        say(
          'Je kijkt rond. Er hangt een zeef met gaatjes in de vorm van sterren. Rozijntjes slapen in een glazen pot onder een laagje suiker. De oven knippert met zijn twee warme raampjes. Mies zorgt voor het vuur. Je mag haar helpen zoeken naar wat het deeg nodig heeft.',
          'Aan de muur hangt een zeef met stervormige gaatjes. In een glazen pot liggen rozijntjes te slapen onder een suikerdekentje. De oven knippert met zijn warme raampjes. Mies zorgt voor het vuur terwijl jij op onderzoek uitgaat.'
        ),
        'Buiten schuift iemand een bank onder het raam. Je hoort lepeltjes tikken op lege borden. De maanbewoners wachten op hun ontbijt. Achter op de plank zie je een blik met recepten. Uit de kom komt een zacht gebrom.',
        'Kijk je in het blik? Of luister je eerst naar het deeg?'
      );
    case 1:
      return paragraphs(
        clue === 0
          ? say('In het blik zit een kaartje. Er staat een licht bolletje op. ‘Dat is wensgist,’ leest Mies. ‘Dan wordt het deeg dik en luchtig!’ Ze klapt in haar poten.', 'In het receptenblik vind je een kaartje met een lichtgevend korreltje. Mies klapt in haar meelpoten. ‘Wensgist! Dat zorgt ervoor dat het deeg groeit.’')
          : say('Je houdt je oor bij de kom. ‘Wensgist,’ bromt het deeg slaperig. ‘Eén korreltje is genoeg.’ Mies klapt in haar poten. Met wensgist kan het deeg weer groeien.', 'Je buigt je oor naar de kom. ‘Wensgist,’ bromt het deeg slaperig. ‘Met één korreltje kan ik al groeien.’ Mies klapt in haar meelpoten.'),
        'De wensgist groeit bij de maanbloem. Die staat bij een grote kuil in de maan aan de overkant van het plein. Mies noemt die kuil een krater. Ze stopt een leeg kommetje in haar schortzak.',
        say(
          'Mies hangt een briefje op de deur. Ze tekent er een kom op. Zo weet iedereen waarom de winkel even dicht is. De oven leest het briefje door het raam. Hij zucht zacht en knikt.',
          'Mies hangt een briefje aan de bakkersdeur. Bij haar tekening van een kom schrijft ze dat ze even iets voor het deeg gaat halen. De oven leest het briefje door het raam en knikt heel langzaam.'
        ),
        'Onder een schone doek blijft het deeg bij de warme oven. ‘Ik pas goed op,’ zegt de oven voor jullie gaan. Buiten rolt een broodkar langs. In de mand liggen drie snurkende broden. De bezorger zwaait met zijn vrije oor. In de verte zie je de maanbloem. Die gloeit als een witte lamp.',
        say(
          'Over het plein loopt een pad van platte sterstenen. Zo kun je veilig langs alle broodkarren. Aan de rand stroomt maanlicht als een smalle rivier. Het is zo wit als melk.',
          'Tussen de broodkarren door loopt een rustig wandelpad van platte sterstenen. Langs de rand van het plein glijdt een smalle rivier van maanlicht. Het licht is daar zo wit als melk.'
        ),
        'Mies legt haar grote houten lepel naast haar poot. ‘Die kan drijven als een bootje.’ Dan kijkt ze nog eens in het lege kommetje. Ze glimlacht. Jullie hoeven maar één korreltje heel voorzichtig mee terug te nemen. Er is geen haast. Met één korreltje dat heel blijft, ben je meer geholpen dan met een zak vol gist die onderweg wegwaait.',
        'Loop je over de sterstenen? Of vaar je in de houten lepel?'
      );
    case 2:
      return paragraphs(
        route === 0
          ? say('Ting, ting! De platte sterstenen klinken onder je voeten. Zo wandel je met Mies tot bij de maanbloem aan de rand van de krater.', 'Bij elke stap geeft een stersteen een zachte ting. Samen met Mies volg je het klinkende pad tot aan de krater.')
          : say('De houten lepel wiebelt zacht op het licht. Mies stuurt met een tweede lepel. Bij de krater legt ze aan. Daar staat de maanbloem.', 'De houten lepel dobbert als een wiegje op het licht. Mies stuurt met een tweede lepel, tot jullie bij de krater aanleggen.'),
        'Onder de bloem zit een ronde mot. Op zijn snorharen glimmen korrels wensgist. ‘Ik wilde alleen maar even ruiken,’ zegt hij. ‘Nu kriebelt het zo dat ik niet durf te bewegen.’ Hij houdt zijn vleugels stil. Mies ziet dat jullie de korrels nog kunnen gebruiken, als je ze zachtjes losmaakt.',
        say(
          'Mies zegt gedag. ‘Mogen we dichterbij komen?’ De mot knikt heel zacht. Zijn snor trilt. Een gouden korrel springt op en neer. Op de andere snor glimt lichtblauw stof. Het ruikt naar warme vanille.',
          'Mies groet hem en vraagt of jullie dichterbij mogen komen. De mot knikt voorzichtig. Een korreltje maakt een sprongetje op zijn trillende snor. Aan de andere kant glimt wat blauw stof. De gist ruikt naar warme vanille.'
        ),
        'Jij houdt de kom onder zijn snor. Je raakt hem nog niet aan. ‘Het is net of ik een nies in mijn snor heb,’ fluistert de mot. ‘Maar ik weet niet waar hij naartoe moet.’',
        say(
          'De maanbloem buigt een beetje. Jullie staan nu in de schaduw van het blad. Op het blad liggen witte druppels die naar melk ruiken. Mies legt uit dat wensgist makkelijk wegwaait. Blaas je te hard? Dan komen de korrels in een verre kuil terecht. Jullie moeten dus rustig bewegen.',
          'De maanbloem buigt en geeft jullie schaduw. Op het blad liggen witte druppels die naar melk ruiken. Mies legt uit dat een harde wind de lichte korrels naar een andere krater zou blazen. Jullie blijven dus dichtbij en bewegen rustig.'
        ),
        'Op een platte steen zet je de kom stevig neer. Mies haalt een zacht kwastje uit haar schortzak. Het brede blad van de bloem werkt ook als een waaier. De mot kijkt naar het blad en het kwastje. Dan vouwt hij zijn vleugels over elkaar en wacht.',
        'Veeg je de korrels los met de kwast? Of waai je heel zacht met het blad?'
      );
    case 3:
      return paragraphs(
        moth === 0
          ? say('Met kleine veegjes borstel je de gist in de kom. De snor kriebelt niet meer. De mot ontspant zijn vleugels en buigt om je te bedanken.', 'Met de kwast veeg je de wensgist zacht van de snor af. De korreltjes vallen in het kommetje. De mot ontspant zijn vleugels en maakt een dankbare buiging.')
          : say('Je waait zacht met het blad. De korrels dansen de kom in. De mot durft weer te bewegen. Hij haalt opgelucht adem.', 'Je waaiert zacht met het bloemenblad. De wensgist dwarrelt in het kommetje. De mot ademt opgelucht in nu zijn snor niet meer kietelt.'),
        'Terug in de bakkerij strooit Mies één korrel over het deeg. Kijk, de kom beweegt! Het deeg wordt bol. Dan gaapt de oven hard en zakt alles weer in. ‘Het wil rustig wakker worden,’ fluistert Mies.',
        say(
          'De ovendeur gaat een klein stukje open. De oven probeert te gapen zonder geluid. Zijn gezicht is zo grappig dat Mies in haar schort lacht. Jij legt een hand op de doek over de kom.',
          'Door een kiertje probeert de oven geluidloos te gapen. Het ziet er zo grappig uit dat Mies haar lach verstopt in haar schort. Onder de doek voel je de kom zacht bewegen.'
        ),
        'Het deeg gaat een beetje op en neer. Het is net of het ademt. Zodra iedereen stilstaat, wordt het ronder. Door het raam kijken de eerste maanbewoners mee. Ze staan al klaar voor hun brood. Mies gebaart dat het nog even duurt. Een goed brood bakken kost nu eenmaal een beetje tijd.',
        say(
          'Het maanbrood wordt graag op zijn eigen tempo wakker. Daarom leggen jullie de spullen die lawaai maken opzij. De zeef rammelt nu niet meer. Het grote bakblik ligt zacht op een kussen.',
          'Maanbrood wil best wakker worden, maar wel op zijn eigen manier. Jullie zetten daarom de spullen die lawaai maken opzij. De meelzeef hoeft niet meer te rammelen en het grote bakblik krijgt een zacht kussen.'
        ),
        'Buiten gaan de maanbewoners op de bank zitten. Eén van hen legt zijn lepel zo zacht mogelijk neer. Binnen kunnen jullie de oven helpen zijn voetjes stil te houden. Geef hem een rustige maat, dan hoeft hij niet te stampen op de vloer.',
        'Op de tafel ligt een zachte doek naast de schone kneedplek. Je kijkt naar allebei. Er is genoeg ruimte op tafel om iets uit te proberen. Neurie je een liedje bij het kneden? Of wieg je het deeg in de doek?'
      );
    case 4:
      return paragraphs(
        dough === 0
          ? say('Je neuriet een zacht liedje. Mies kneedt langzaam op jouw maat. De oven houdt zijn voetjes stil. Het deeg wordt zacht en dik.', 'Op jouw zachte melodie kneedt Mies het deeg in langzame rondjes. De oven zet zijn voetjes stil. Even later is het deeg zacht en luchtig.')
          : say('Jullie houden elk een punt van de doek vast. Het deeg wiegt rustig heen en weer. Even later zit het vol lucht. Het voelt zacht.', 'Jullie tillen elk een kant van de doek op. Het deeg wiegt rustig tussen jullie in, tot het helemaal luchtig en zacht is.'),
        'De bakkerij ruikt lekker. Nu is het tijd om het brood een vorm te geven. Mies geeft je eerst een stukje deeg om te voelen. Als je erop duwt, zie je even een klein kuiltje. Het lijkt op een kratertje in de maan. Dan wordt het kuiltje langzaam weer vol. Het deeg veert terug als je je vinger optilt.',
        say(
          '‘Dat is goed!’ zegt Mies. De oven kijkt blij toe. Hij hoeft vandaag niet harder te gloeien. De wensgist heeft zijn werk al gedaan. Mies pakt twee bakplaten en een rond mes voor het deeg. Op elke plaat legt ze een glad vel bakpapier.',
          '‘Dat is precies goed,’ zegt Mies. De oven kijkt tevreden toe. Hij hoeft niet harder te gloeien, want de wensgist heeft zijn werk gedaan. Mies legt glad bakpapier op twee bakplaten en pakt haar ronde deegmes.'
        ),
        'Buiten wordt de ontbijttafel steeds langer. Een maanbewoner schuift aan met een leeg bord vol vakjes. In elk vakje kan straks een andere smaak. Een bezorger zet een mand op de grond. Daar passen ook kleine broodjes in.',
        say(
          '‘Kijk, hier past één grote broodmaan op,’ zegt Mies. Ze wijst naar de eerste plaat. Dan kunnen jullie buiten aan één tafel eten. Iedereen kiest zelf een punt. Mies schuift de andere bakplaat dichterbij.',
          'Op de eerste plaat past één grote broodmaan voor de lange tafel. Jullie kunnen die samen delen, zodat iedereen zelf een punt kiest. Mies wijst ook de tweede plaat aan. Die is groot genoeg voor losse broodjes.'
        ),
        say(
          `De kleine broodjes kunnen zelf op pad. Ze hobbelen naar de mensen die verder weg wonen. Zo krijgt iedereen ontbijt. ‘Allebei kan met dit deeg, ${hero},’ zegt Mies. Ze houdt haar mes klaar. Jij mag kiezen.`,
          `Als jullie kleine wandelbroodjes maken, kunnen die ook bij maanbewoners verderop op bezoek. ‘Voor allebei is er genoeg wensgist, ${hero},’ zegt Mies. ‘Alleen de vorm en de plek waar iedereen eet, zijn anders. Kies het ontbijt dat jij het fijnst vindt voor deze ochtend.’`
        ),
        'Maken jullie één broodmaan of een heleboel kleine broodjes?'
      );
    default:
      if (breakfast === 0) {
        return paragraphs(
          say(
            'De grote broodmaan komt goud uit de oven. Mies snijdt het brood in zachte punten. Jij dekt de lange tafel. De mot brengt bloemen. De broodbezorgers schuiven hun lege manden onder de bank.',
            'De broodmaan komt goudgeel uit de oven. Terwijl Mies zachte punten snijdt, dek jij buiten de lange tafel. De mot brengt maanbloemen en de bezorgers schuiven hun manden onder de bank.'
          ),
          `Als iedereen een stuk brood heeft, klinkt de ontbijtbel over het plein. Zelfs de oven gaapt heel voorzichtig. Mies geeft ${hero} een klein sterbroodje. ‘Dat is een bakkersster. Daar hoef je geen hap van te nemen. Bewaar die maar voor later, dan denk je weer aan deze ochtend.’`,
          say(
            'Een kleine maanbewoner houdt zijn broodpunt tegen het licht. In het brood zitten gaatjes als kleine sterren. Hij kiest het stuk met de grootste korst. ‘Dat is mijn lievelingsstuk.’ Mies legt bij ieder bord een bloemblad om je mond mee af te vegen.',
            'Een maanbewoner houdt zijn broodpunt tegen het licht. In de zachte binnenkant zitten gaatjes als piepkleine sterren. Hij kiest zijn lievelingsstuk, dat met de grootste korst. Mies legt naast ieder bord een bloemblad als servet.'
          ),
          'De mot zit naast je en schuift zijn vleugels tegen zich aan. Hij haalt diep adem door zijn schone snor. Dat kriebelt geen beetje meer. Nu kan hij goed ruiken hoe lekker het warme brood ruikt.',
          say(
            'In je hand geeft de ster zacht licht. Hij is stevig. Met je duim voel je het gladde randje. Uit het ronde raam hoor je een tevreden zucht van de oven. Dan gaan jullie allemaal eten.',
            'De bakkersster gloeit zacht in je hand. Hij is stevig genoeg om te bewaren en het gladde randje past precies onder je duim. Door het ronde raam zucht de oven tevreden. Iedereen begint rustig aan het ontbijt.'
          )
        );
      }
      if (route === 0) {
        return paragraphs(
          say(
            'De broodjes krijgen ronde voetjes. Ting, ting, ting! Ze huppelen over de sterstenen. Mies loopt voorop met een vlag van bakpapier. Bij elk leeg bord staat een broodje stil. Het maakt een diepe buiging.',
            'De broodjes krijgen kleine voetjes. Ting, ting, ting! Ze huppelen over de sterstenen. Mies loopt voorop met een vlag van bakpapier. Bij ieder leeg bord stopt een broodje om een diepe buiging te maken.'
          ),
          `De maanbewoners moeten zo lachen dat ze hun ontbijt bijna vergeten. Mies heeft iets voor ${hero}: een belletje aan haar vlag. Het klinkt net als de stenen waarop jullie samen naar de krater liepen.`,
          say(
            'Bij het kleinste huis stoppen de broodjes. De deur zit hoog. Er staat een bord op een kruk. Eén broodje maakt een grote hup. Het landt precies op het bord. De bewoner klapt twee keer zacht. Dan kunnen de andere broodjes op dezelfde maat verderlopen.',
            'Bij het kleinste huis houden de broodjes even stil. Er staat een leeg bord op een kruk onder de hoge deur. Eén broodje hupt omhoog en landt precies midden op het bord. De bewoner geeft twee zachte klapjes zodat de rest zijn maat niet kwijtraakt.'
          ),
          'Je loopt nog een stukje mee. Onder je voeten klinken de sterstenen laag en rond. Het belletje antwoordt licht en helder. Als de laatste mand leeg is, rolt Mies de vlag op bij haar bakkersdeur. Op het plein loopt iedereen weer rustig rond.',
          say(
            'Jij mag het belletje bewaren. Beweeg je hand maar een beetje. Ting! Dan hoor je nog hoe de broodjes vandaag over de maan liepen. Allemaal op weg naar een plekje waar iemand op ontbijt wachtte.',
            'Je mag het belletje houden. Als je het heel zacht beweegt, kun je weer horen hoe het ontbijt over de maan naar iedereen toe kwam. Het lichtste geluid is het laatste dat over het plein klinkt.'
          )
        );
      }
      return paragraphs(
        say(
          'De broodjes springen in schone houten lepels. Ze varen over de rivier van maanlicht. Mies zwaait bij elk huis. De mot brengt de lege lepels terug. Plof! Het volgende broodje landt op een bord.',
          'De broodjes springen in schone houten lepels en varen van huis naar huis. Mies zwaait bij elke aanlegplek terwijl de mot de lege lepels terugbrengt. Bij elk geopend luikje ploft een broodje op een bord.'
        ),
        `De maan ruikt naar verse korst. Voor ${hero} maakt Mies een kleine lepelboot. Het zeil is van bakpapier. Dat mag je bewaren. Dan kun je nog eens denken aan die rustige reis over de rivier van licht.`,
        say(
          'Bij een huisje gaat een rond raampje open. Daar kijkt iemand met slaperige ogen. Hij hoorde de bel al, maar zijn deken lag zo lekker. Nu ruikt hij zijn broodje. Hij schuift zijn bord met een glimlach naar buiten.',
          'Bij een rond ontbijtluik verschijnt een slaperig gezicht. De bewoner hoorde de bel al, maar zijn deken wilde hem nog niet loslaten. Door de geur van het verse brood schuift hij toch glimlachend zijn bord naar buiten.'
        ),
        'Het bootje wacht tot hij zijn broodje heeft gepakt. Met je vinger volg je de rand van jouw kleine lepelbootje. Bij één zacht zuchtje beweegt het zeil al. Mies vertelt dat de grote lepels straks weer in de bakkerij horen.',
        say(
          'De rivier wordt stil en helder. Op de rand staan lege bordjes met een paar kruimels. Iedereen heeft ontbijt gehad. Nu zijn jullie aan de beurt. Je zoekt met Mies een fijn warm plekje aan tafel.',
          'De rivier van maanlicht wordt weer rustig en helder. Op de oevers staan lege borden met alleen nog wat kruimels. Het ontbijt is overal aangekomen. Nu kunnen jullie zelf nog een fijne warme plek aan tafel kiezen.'
        )
      );
  }
};

export const storyLevelsWeather: Record<string, LevelText> = { weather, moonbakery };
