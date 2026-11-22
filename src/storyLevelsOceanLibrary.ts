type Band = 'under6' | '6to8';
type Paragraph = string | readonly [young: string, middle: string];
type Passage = (picks: number[], hero: string, band: Band, step?: number) => string;

function read(band: Band, paragraphs: Paragraph[]) {
  const level = band === 'under6' ? 0 : 1;
  return paragraphs.map(paragraph => typeof paragraph === 'string' ? paragraph : paragraph[level]).join('\n\n');
}

const ocean: Passage = (picks, hero, band, step) => {
  switch (step) {
    case 0:
      return read(band, [
        [
          `Op het strand vindt ${hero} een schelp. Tik, tik. De schelp klopt zacht. Je tilt hem op. Floep! Om jou heen zit een grote, heldere luchtbel. Je zakt ermee in zee. Je kunt gewoon blijven ademen. Door de bel zie je een schildpad.`,
          `Op het strand hoort ${hero} iets tikken. Het komt uit een schelp. Zodra je hem oppakt, groeit er een doorzichtige luchtbel om je heen. De bel zakt onder water, maar je kunt er gewoon in ademen. Een kleine zeeschildpad zwemt naar je toe.`,
        ],
        [
          '‘Ik heet Tiko,’ zegt de schildpad. ‘Kom eens mee. Onze tuin maakt geen geluid meer.’ Hij zwemt naar het roze koraal. Daar hangt een zeepaardje aan een stengel. Ze heet Lumi. Ze heeft een kaart bij zich, gemaakt van schelpen.',
          '‘Ik ben Tiko,’ zegt de schildpad. ‘De koraaltuin is stil. Normaal hoor je iedere ochtend de klokbloemen.’ Hij neemt je mee naar het roze koraal. Lumi het zeepaardje hangt aan een stengeltje. Ze laat jullie haar schelpenkaart zien.',
        ],
        [
          'Het water trekt zacht langs de bel. Je hoort een tikje. Je hoort ook geritsel. Dan klinkt er een diepe plop. Tiko doet voor hoe je kunt draaien. Hij wijst met zijn poot. Je draait zo zacht dat het zand netjes blijft liggen.',
          'Binnen in de bel klinkt de zee anders dan op het strand: tikjes, geritsel en soms een diepe plop. Tiko laat met zijn voorpoot zien hoe je de bel kunt sturen. Je maakt een rustige draai, zodat het zand niet omhoog dwarrelt.',
        ],
        'Lumi wijst op roze takjes en blauwe lijnen. De takjes zijn het koraal. De lijnen laten zien waar het water stroomt. Dat water moet bij de klokbloemen komen. Lumi heeft daar een leeg rondje getekend. Op die plek mist het ochtendgeluid.',
        [
          'Een klokbloem gaat open. Normaal hoor je ting! Nu komt er alleen een zuchtje uit. Je houdt je oor dicht bij de bloem. Tiko luistert ook. ‘Waar blijft het water?’ vraagt hij. De andere zeediertjes zorgen intussen verder voor de tuin.',
          'Een bloem vlakbij doet haar blaadjes open. Er klinkt geen getingel, alleen een klein zuchtje. Tiko luistert met je mee. ‘Het water moet ergens een omweg maken,’ zegt hij. Terwijl de tuinbewoners verder werken, speuren jullie naar de plek waar het misgaat.',
        ],
        'Op het zand staan afdrukken, achter elkaar. Verderop dansen kleine bubbels in een rij. Tiko kijkt naar het zand. Lumi kijkt naar de bubbels. Beide sporen kunnen jullie op weg helpen. Welk spoor volg jij als eerste?',
      ]);
    case 1:
      return read(band, [
        picks[0] === 0 ? [
          'Je volgt de afdrukken met Tiko. Hij zwemt net boven het zand. Zo blijven alle afdrukken staan. Het spoor komt uit bij lange, groene bladeren. Het is zeewier. De bladeren hangen vóór jullie, net als een gordijn.',
          'De afdrukken leiden jullie naar een gordijn van lange zeewierbladeren. Tiko zwemt laag boven het zand. Hij beweegt zijn poten zo voorzichtig dat het spoor zichtbaar blijft. Tussen twee bladeren door zie je een donkere opening.',
        ] : [
          'Je gaat achter de bubbels aan. Ze dansen tot bij lange, groene bladeren. Het is zeewier. De bubbels maken daar een rondje. Dan doen ze het nog eens. Het water komt niet verder. Vóór jullie hangt het wier als een gordijn.',
          'Je volgt de dansende belletjes tot aan een gordijn van zeewier. Daar komen ze niet verder. Steeds als ze langs de bladeren willen, draaien ze terug in dezelfde kleine kring. Tiko remt naast je af en kijkt tussen twee groene bladeren door.',
        ],
        [
          'Achter het wier klinkt een zacht fluitje. ‘Dat is de stroomvis,’ zegt Lumi. ‘Hij blaast het water naar de tuin.’ Het wier zit in de knoop. De vis zit aan de andere kant. Door een gaatje zie je zijn zilveren fluitje bewegen.',
          'Lumi spitst haar oren. Het gefluit achter het wier kent ze. ‘De stroomvis! Die blaast iedere ochtend water naar onze tuin.’ De bladeren zijn in elkaar geraakt. Lumi houdt haar kaart dicht bij zich en wijst naar een flits zilver: het fluitje van de vis.',
        ],
        'Lumi duwt een blad opzij. Het blad veert terug en raakt haar neus. Hatsjoe! Drie bubbels komen uit haar mond. Tiko wacht tot ze boven zijn. ‘We hoeven geen blad af te breken,’ zegt hij. ‘We moeten ze alleen uit elkaar houden.’',
        [
          'Er zwemt een groepje poetsgarnalen voorbij. Dat zijn kleine helpers met dunne sprieten. Hun sprieten bewegen heen en weer. Ze kunnen de slierten uit de knoop halen. De garnalen komen wat dichterbij. Ze willen zien waar het fluitje vandaan komt.',
          'Een familie poetsgarnalen zwemt nieuwsgierig dichterbij. Hun dunne sprieten bewegen alsof ze al naar losse uiteinden zoeken. Ze zijn handig met slierten die in de knoop zitten. Samen kunnen ze de groene bladeren ontwarren.',
        ],
        [
          'Op het zand liggen schelpen op een rij. Daar zitten klemmetjes aan. Je pakt er eentje. De rand voelt glad. De klem kan een blad vasthouden. Het blad gaat er niet van stuk. Zo kun je het wier op zijn plek houden.',
          'Op het zand ligt ook een rij lege schelpklemmetjes. De randen zijn glad en breed genoeg om een blad vast te houden. Zo kun je de stukken wier opzijzetten zonder erin te knijpen. Lumi probeert een klemmetje in haar staart te pakken.',
        ],
        'Het fluitje klinkt weer. Midden in de toon wordt het stil. ‘We komen eraan!’ roep je. Tik. Iemand tikt zacht tegen een steen. Het klinkt alsof de vis al op jullie wacht. Een klein gat is genoeg. Zolang jullie de vis maar goed kunnen zien. Hoe maken jullie het gordijn open?',
      ]);
    case 2:
      return read(band, [
        picks[1] === 0 ? [
          'Je zet de schelpklemmen op de randen van het wier. Eén blad blijft links. Het andere blijft rechts. Er is nu ruimte tussen de bladeren. Tiko houdt die plek vrij. In de opening zit een ronde vis.',
          'Met de schelpklemmen pak je de stevige randen van de bladeren vast. Zo blijft de doorgang open en kan iedereen er rustig door. Tiko houdt het water bij de opening vrij. Midden in de opening zit een ronde vis.',
        ] : [
          'Elke poetsgarnaal grijpt een los stukje wier. Samen trekken ze de slierten uit elkaar. Het wier hangt nu als een groene boog. Tiko zorgt voor genoeg ruimte om erdoor te zwemmen. Onder de boog zit een ronde vis.',
          'De poetsgarnalen pakken elk een los uiteinde. Voor je het weet hebben ze het zeewier uit de knoop. Het hangt als een groene boog boven jullie. Tiko houdt de doorgang vrij. Onder de boog wacht een ronde vis.',
        ],
        [
          'Het is de stroomvis. Hij houdt zijn fluitje half onder zijn vin. ‘Ik heb een nieuwe toon,’ zegt hij. ‘Hij klinkt anders. Wat als de klokbloemen hem niet mooi vinden?’ Op zijn buik zie je blauwe stippen. Ze lichten elke keer op als hij ademt.',
          'De stroomvis stopt het zilveren fluitje onder zijn vin. ‘Ik heb een nieuwe toon bedacht,’ zegt hij. ‘Maar wat als de bloemen hem niet mooi vinden?’ Blauwe stippen glimmen op zijn buik. Bij iedere ademhaling lichten ze op, alsof de melodie eruit wil.',
        ],
        [
          'Lumi schudt haar hoofd. ‘Dat hoeven we niet te raden.’ Ze zoekt een rustig plekje naast hem. Daar drijft haar kaart niet weg. Tiko komt dichterbij. ‘Misschien klinkt iets in jouw buik anders,’ zegt hij. ‘Iemand anders hoort het op zijn eigen manier.’',
          '‘Dan ontdekken we samen hoe het klinkt,’ zegt Lumi. Ze gaat op zoek naar een rustig plekje en hangt naast hem, dicht bij de bodem. Zo drijft haar kaart niet weg als ze hem loslaat. Tiko denkt na. ‘Voor jou voelt een nieuwe toon misschien heel anders dan voor iemand die luistert.’',
        ],
        'De vis knippert. Hij had daar nog niet aan gedacht. Hij haalt rustig adem en blaast uit. Nog zonder zijn fluitje. Jij kijkt buiten de boog van wier. Daar staat een klokbloempje. Het draait zijn blaadjes een beetje naar jullie toe. Misschien zou het graag willen luisteren.',
        [
          'Er staat een bloempot bij de bloem. Het is een pot die kan drijven. Daarin kan het bloempje naar de vis toe. Op het zand liggen ook open schelpen. Met wat lucht uit je bel maak je een toon in zo’n schelp.',
          'Bij het bloempje staat een pot die veilig kan meedrijven. Lumi zou die kunnen gebruiken om de bloem hierheen te brengen. Op de bodem liggen ook open schelpen. Je kunt zachtjes over een schelp blazen om er een toon uit te krijgen.',
        ],
        'De vis hoeft geen heel lied te spelen. Eén kleine toon is genoeg om te proberen. Lumi en Tiko blijven dichtbij. Wil jij samen met de vis een toon spelen? Of breng je eerst een klein klokbloempje om te luisteren?',
      ]);
    case 3:
      return read(band, [
        picks[2] === 0 ? [
          'Je blaast zacht over een schelp. De stroomvis speelt één toon. Jullie tonen klinken samen als water dat rustig langs je voeten loopt. De vis kijkt blij. Hij durft nu verder te spelen op zijn fluitje.',
          'Je blaast over de rand van een open schelp. De stroomvis speelt er één zachte toon naast. Samen klinkt het als water dat langs stenen kabbelt. De vis merkt dat zijn toon er prima bij past en speelt vrolijk verder.',
        ] : [
          'Lumi brengt de pot met het klokbloempje. De pot drijft tot bij de stroomvis. Hij speelt zijn toon. Meteen gaat het bloempje open. De vis kijkt blij. Hij durft nu verder te spelen op zijn fluitje.',
          'Lumi laat een klokbloempje in zijn pot naar de stroomvis drijven. Zodra hij zijn nieuwe toon speelt, opent de bloem haar kleine kelk. De vis straalt. Het bloempje heeft hem het antwoord gegeven dat hij zo graag wilde horen.',
        ],
        [
          'Het ochtendwater stroomt weer. Maar niet al het water komt bij de tuin. Bij een hoopje zand gaat het alle kanten op. Je ziet een beetje water verder stromen. Dat is te weinig voor de klokbloemen. Er is een nieuw waterpad nodig.',
          'Het gefluit zet het ochtendwater weer in beweging. Alleen splitst de stroom zich om een zandheuveltje in te veel kleine stroompjes. De klokbloemen krijgen nog lang niet genoeg water. Jullie moeten het weer dezelfde kant op laten gaan.',
        ],
        'Het hoopje zand is het huis van een visje. Hij heet een grondel. Hij slaapt met zijn neus onder een blaadje. Hij snurkt heel zacht. Bij elk snurkje komt er een luchtbel boven zijn huis. Tiko legt een poot voor zijn mond.',
        [
          'Je kijkt waar het water nu heen gaat. Hier rollen de zandkorrels mee. Daar liggen ze stil. Het pad mag niet door het huis van de grondel gaan. Hij mag lekker blijven slapen. Jullie kunnen met een bocht om hem heen.',
          'Je volgt met je ogen de zandkorrels die met de stroom meegaan. Zo zie je waar het water afbuigt en waar het stilstaat. Niemand hoeft de grondel wakker te maken. Met een ruime bocht kunnen jullie de stroom om zijn huisje heen sturen.',
        ],
        [
          'Tiko zoekt gladde stenen. Hij legt ze naast elkaar. Daarmee kun je een pad voor het water maken. Lumi pakt een lange, holle schelp. Water kan door het open stuk lopen. Ze houdt hem bij de bocht op haar kaart.',
          'Tiko zoekt gladde steentjes bij elkaar voor een slingerpad. Lumi pakt een lange, holle schelp en legt die langs een blauwe lijn op haar kaart. De bochten lijken op elkaar. ‘Hier kan het water ook doorheen, net als door een gootje,’ zegt ze.',
        ],
        'Jullie kijken waar het water erin kan en waar het er weer uit komt. De stroomvis speelt zacht door, zodat je het water ziet bewegen. Laat ook ruimte voor alle kleine zwemmers. Welke weg maak jij voor het water, langs stenen of door de schelp?',
      ]);
    case 4:
      return read(band, [
        picks[3] === 0 ? [
          'Het water glijdt tussen de gladde stenen door. Het maakt een bocht rond het huis van de grondel. Hij slaapt gewoon door. Verderop loopt het water weer de tuin in.',
          'Tussen de gladde stenen maakt het water een wijde slinger om het huisje van de grondel. Hij blijft slapen terwijl het stroompje eindelijk terug naar de koraaltuin loopt.',
        ] : [
          'Het water glijdt door de holle schelp. De schelp maakt een zacht, laag zoemgeluid. Het stroompje komt aan de andere kant uit de schelp. Het loopt weer de tuin in.',
          'Het water loopt door de holle schelp en maakt een lage zoemtoon. Aan de uitgang stroomt het weer in de juiste richting, recht naar de klokbloemen van de koraaltuin.',
        ],
        [
          'Eén bloem gaat open. Ting! Dan volgt de volgende. Tong! De hele rij tingelt weer. De stroomvis hoort de bloemen bij het wier. Hij speelt mee op zijn fluit. Tiko wijst jou een lege plek in de tuin.',
          'De klokbloemen gaan één voor één open. Ting, tong, tingeling! Bij de boog van zeewier hoort de stroomvis de tuin weer klinken. Hij speelt meteen mee. Tiko zwemt naar een open plek tussen de bloemen en wenkt je.',
        ],
        'Een jong visje steekt zijn kop tussen de takjes van het koraal. Hij kijkt met één oog naar de bloemen. Dan tikt hij met zijn vin. De klokbloemen geven hem een toon terug. Lumi lacht. ‘Ze vinden bezoek leuk!’',
        [
          'Op de lege plek ligt zacht zand. Er schijnt licht op. Lumi houdt met haar staart een klein koraalplantje vast. Het wiegt heen en weer. Tiko haalt twee grote schelpen uit de weg. Nu is er genoeg plaats voor jullie plan.',
          'Een brede strook licht valt op het zachte zand. Lumi houdt het jonge koraalplantje voorzichtig vast in haar staart. Tiko schuift de grote schelpen weg uit het looppad. Nu is er ruimte om iets te maken dat het geluid helpt bewaren.',
        ],
        [
          'Je kunt bankjes in een kring zetten. Dan kan iedereen dicht bij de bloemen zitten. Of je maakt een toren van koraal. Die brengt het lied naar een andere tuin. De twee plannen passen allebei op het stukje zand.',
          'Met een luisterkring kunnen gasten dicht bij het getingel zitten. Een muziektoren zou de melodie meenemen naar tuinen verderop. Je kijkt nog eens hoeveel ruimte er is. Het koraalplantje zou hier voor beide plannen kunnen groeien.',
        ],
        'De stroomvis speelt eerst een toon die je dichtbij hoort. Dan speelt hij er één die over de tuin glijdt. Je hoort die toon nog bij het verste koraal. Het zeepaardje komt met het plantje naar je toe. ‘Wat zullen we maken?’ vraagt Lumi. Jij mag kiezen.',
      ]);
    default:
      if (picks[4] === 0) return read(band, [
        [
          'Rond het jonge koraal leggen jullie schelpen neer. Het zijn net bankjes. Tiko laat in de kring een grote plek vrij voor jouw luchtbel. Lumi roept de poetsgarnalen. De stroomvis komt met zijn fluitje.',
          'Jullie maken een kring van schelpen rond het jonge koraal. Tiko schuift de bankjes ver genoeg uit elkaar om ook jouw luchtbel een plaats te geven. Lumi nodigt de poetsgarnalen uit. De stroomvis begint te spelen.',
        ],
        'De klokbloemen tingelen. De stroomvis speelt zijn eigen toon. Iedereen mag een ander geluid maken. Als alles samen klinkt, is het alsof de hele zee wakker wordt. Je kunt het goed horen vanaf jouw plek in de kring.',
        [
          'De kleinste garnaal zit eerst achter een schelp. Hij wil alleen maar luisteren. Zijn sprieten gaan zacht heen en weer. Dan schuift hij wat dichterbij. Tiko draait een grote schelp, zodat iedereen de bloemen kan zien.',
          'De kleinste poetsgarnaal kijkt eerst vanachter een schelp. Alleen zijn sprietjes wiegen op de maat. Na een tijdje schuift hij dichterbij. Er is ruimte genoeg. Tiko draait de grootste schelp om, zodat de bloemen voor iedereen te zien zijn.',
        ],
        [
          `‘Voor jou, ${hero},’ zegt Tiko. Hij geeft je een luisterschelp. Je ziet er een glad rond lijntje in. Je gaat er met je duim over. De luchtbel brengt je langzaam terug naar boven.`,
          `Voor je teruggaat, geeft Tiko ${hero} een kleine luisterschelp. Het gladde kringeltje erin voelt fijn onder je duim. Je volgt de bocht terwijl de luchtbel steeds verder omhoog beweegt.`,
        ],
        'Lumi zwaait met haar staart. Ze wordt steeds kleiner. Dan voel je aan het strand weer warm, zacht zand onder je voeten. Je houdt de schelp even stil bij je oor. De schelp praat niet. Je hoort alleen een zacht ruisje. Je denkt aan de bloemen die weer zingen.',
      ]);
      if (picks[3] === 0) return read(band, [
        [
          'Het kleine koraal groeit. Het wordt een toren met open raampjes. Het lied gaat door de raampjes heen. Dan gaat het langs jullie stenen. In de tuin verderop klinkt ineens ting. Nog een bloem heeft jullie gehoord!',
          'Uit het jonge koraal groeit een torentje met open ramen. De melodie glijdt erdoorheen en reist langs jullie stenenpad naar een volgende tuin. Ver weg geeft een klokbloem antwoord. Dan volgt een tweede toon uit weer een andere bloem.',
        ],
        'Lumi zwemt een rondje om de toren. Tiko luistert hoe het op de zeebodem steeds gezelliger klinkt. Eerst was het stil. Nu hoor je hier een ting en daar een tong. Er antwoordt zelfs een bloem uit een andere tuin. De klokbloemen horen elkaar ook op een afstand.',
        [
          'Een groepje vissen volgt het geluid. Ze stoppen naast het eerste raam. Zo kan het lied er nog goed uit. Het hoeft niet harder te klinken. Het rustige stroompje neemt het wel mee.',
          'Een schooltje vissen zwemt op het lied af. Bij de eerste opening van de toren blijven ze ernaast hangen. Zo geven ze het geluid alle ruimte. De stroom draagt de melodie vanzelf verder, ook als de bloemen zacht blijven.',
        ],
        [
          `Tiko vindt een steentje voor ${hero}. Het glanst als een parel. Op één kant zit een bobbeltje. Op de andere voel je een rond kringeltje. Tiko wijst waar het lag. Daar is het waterpad begonnen.`,
          `Tiko vindt voor ${hero} een glad steentje dat glanst als een parel. Je voelt een kringeltje en een klein bobbeltje. Tiko wijst naar het begin van het pad, waar de steen tussen de andere stenen heeft gelegen.`,
        ],
        'Je luchtbel gaat langzaam omhoog. Het steentje is lekker koel in je hand. Beneden spelen de klokbloemen verder. Van steeds verder weg klinkt hun zachte getingel. Je houdt het steentje vast en luistert tot je bijna weer boven bent.',
      ]);
      return read(band, [
        [
          'Jullie bouwen de muziektoren naast de holle schelp. De schelp zoemt diep. De klokbloemen klinken hoog. Samen maken ze een lied. Het lied gaat mee met het water. In de tuinen verderop kunnen ze het ook horen.',
          'Naast de holle schelp bouwen jullie de muziektoren. De schelp voegt een diepe zoemtoon toe aan het heldere getingel van de bloemen. Als een zacht golfje rolt het lied naar de tuinen verderop.',
        ],
        'De stroomvis steekt zijn vin op. Hij speelt nog één keer zijn nieuwe toon. Hij verstopt zijn fluitje niet meer. De toon past precies bij de andere geluiden. Het torentje vangt de toon op. De holle schelp zoemt weer mee. Lumi draait een rondje met haar staart.',
        [
          `‘Deze mag mee naar boven, ${hero},’ zegt Lumi. Ze geeft je een licht, leeg schelpje. De schelp draait rond als het huisje van een slak. In de bocht zie je een klein gouden lichtje. Je houdt hem veilig vast.`,
          `Lumi geeft ${hero} een klein leeg spiraalschelpje. In de binnenste bocht vangt het een beetje goudkleurig licht. Je mag het veilig meenemen in je luchtbel. Het rust bijna gewichtloos op je hand.`,
        ],
        [
          'Je kijkt door het gaatje naar boven. De zee lijkt een klein rond plaatje. Het heeft een blauwe rand. Tiko zwemt naast jouw bel tot aan de eerste streep zon. Dan zwaait hij. Hij gaat terug naar de tuin.',
          'Door het gaatje kijk je naar het licht boven je. De schelp maakt van de zee een rond schilderijtje met een blauwe rand. Tiko begeleidt je luchtbel tot de eerste zonnestreep. Daar draait hij om en zwaait naar de tuin.',
        ],
        'Op het strand leg je het schelpje naast je neer. De zon maakt je handen warm. Het schelpje geeft zelf geen geluid. Toch hoor je in je hoofd nog even hoe de fluit, de schelp en de bloemen samen klonken.',
      ]);
  }
};

const library: Passage = (picks, hero, band, step) => {
  switch (step) {
    case 0:
      return read(band, [
        [
          `Klop, klop! ${hero} hoort iets bij het raam. Daarbuiten staat een huisje van hout. Het staat op vier korte poten. In de ramen hangen boeken als gordijnen. Een uiltje zet haar ronde bril recht. ‘Ik ben Loes,’ zegt ze.`,
          `Onder het raam van ${hero} klinkt zacht geklop. Een houten huisje staat op vier korte poten. De boeken in de ramen wiegen als gordijntjes. Een uil met een ronde bril komt naar voren. ‘Ik ben Loes,’ zegt ze.`,
        ],
        [
          '‘Dit is mijn bibliotheek. We brengen boeken bij de mensen thuis.’ Maar één houten voet staat diep in de modder. Het huisje wiebelt. Floep! Er vliegen bladzijden uit de brievenbus. Op eentje staat een klein bed. Er is geen muis te zien.',
          '‘Mijn bibliotheek gaat op bezoek bij lezers,’ vertelt Loes. ‘Maar nu staat ze vast.’ Eén houten voet is in de modder gezakt. Bij iedere wiebel waaien bladzijden uit de brievenbus. Op een blad zie je een muizenbedje zonder muis.',
        ],
        'Er zijn wel meer boekenvrienden zoek. Je wilt ze helpen. Eerst moet het huisje uit de modder. Het dak maakt een brommend geluid. ‘Net een buik die rommelt,’ zeg je. Loes knikt. ‘Zo hoor je dat ze weer verder wil.’',
        [
          'Uit de schoorsteen komt een rond wolkje. Het krult net als een vraagteken. Jullie lopen om de plas heen. De modder glimt. Een merel heeft er pootjes in afgedrukt. Het huisje houdt de houten tenen zo stil als het kan.',
          'Boven de schoorsteen krult een wolkje in de vorm van een vraagteken. Jullie lopen om de plas en zien de pootafdrukken van een merel in de glanzende modder. De bibliotheek probeert ondertussen haar houten tenen heel stil te houden.',
        ],
        'Op een bank ligt een dik boek met een touwtje erom. Loes legt het veilig weg. ‘Onze verhalen willen geen natte voeten.’ Langs het pad liggen dikke takken. Er is ook een stapel oude boekkaften. Er zitten geen blaadjes meer in.',
        [
          'Je voelt aan een droge tak. Dan pak je een lege kaft. Op allebei past de houten voet. Het huisje buigt een raampje naar je toe. Het kijkt mee. Welke spullen leg je in de modder?',
          'Je bekijkt de brede takken en de lege kaften. Beide kunnen de voet dragen en helpen om de plas over te steken. De bibliotheek buigt een raampje naar je toe, nieuwsgierig naar jouw plan. Waarmee wil jij beginnen?',
        ],
      ]);
    case 1:
      return read(band, [
        picks[0] === 0 ? [
          'Je schuift brede takken onder de voet in de modder. Krak! Het huisje stapt op de takken. Die blijven stevig liggen. De bibliotheek staat weer recht. Loes houdt de deur voor je open.',
          'Je schuift de brede takken onder de moddervoet. Met een tevreden kraakje zet de bibliotheek haar voet op het stevige pad. Ze staat weer stevig en Loes nodigt je uit om binnen te komen.',
        ] : [
          'Je legt de oude kaften in de modder. Nu ligt er een breed bruggetje. Het huisje tilt zijn voet uit de plas. Stap voor stap komt het aan de overkant. Loes houdt de deur voor je open.',
          'De lege kaften vormen een brug over de modder. De bibliotheek tilt haar voet op en stapt voorzichtig naar de overkant. Zodra ze weer stevig staat, zet Loes de deur voor je open.',
        ],
        [
          'Het ruikt binnen naar papier en appelthee. Op de leesbank liggen drie boeken open. Uit het eerste boek hoor je een piepje. Uit het tweede boek hangt een rood lint. Dat loopt over de vloer, helemaal naar buiten.',
          'Binnen ruikt het naar papier en warme appelthee. Op een bank liggen drie open boeken. Het eerste laat een klein piepje horen. Een rood lint uit het tweede loopt over de vloer en verdwijnt door de deur naar buiten.',
        ],
        'Je veegt je schoenen af. Op de mat staan voetjes. Grote, kleine en eentje met drie tenen. Aan de kapstok hangt een enorme paraplu voor een reus. Ernaast hangt een mutsje. Dat is klein genoeg voor een erwt.',
        [
          '‘Iedere bezoeker brengt een verhaal mee,’ zegt Loes. Het huisje bromt zacht als je over de vloer loopt. De vloer wiebelt niet meer. ‘De boekenvrienden mogen best naar buiten,’ zegt Loes. ‘Alleen weten ze niet allemaal hoe ze terug moeten.’',
          '‘Iedere bezoeker brengt zijn eigen verhaal mee,’ zegt Loes. Onder je voeten bromt de bibliotheek tevreden. Nu wiebelt ze niet meer. ‘De boekenvrienden wandelen graag een stukje. Alleen weet niet iedereen hoe je weer terugkomt in je eigen boek.’',
        ],
        [
          'Je ziet een brilletje van papier op de bank. Je zet het voor je ogen. De letters lijken kleine weggetjes. Uit een boek komt de geur van vers brood. Uit een ander waait een zacht windje van zee.',
          'Op de leesbank ligt nog een papieren brilletje. Door de glazen lijken de letters net paadjes. Uit het ene boek waait de geur van vers brood. Een ander stuurt een heel zacht windje van zee langs je wang.',
        ],
        'Loes houdt een vleugel aan haar oor. Weer dat piepje. Het rode lint ligt nog op de vloer. Het zijn twee sporen. Jullie kunnen er maar één tegelijk volgen. Waar begin je, bij het piepje of bij het rode lint?',
      ]);
    case 2:
      return read(band, [
        picks[1] === 0 ? [
          'Het piepje komt uit een theekopje. Je buigt naar het oor van het kopje. ‘Hier ben ik!’ klinkt een klein stemmetje. In het kopje zit Mina. Zij is de boekenmuis.',
          'Je volgt het piepje naar een theekopje. Door het oor roept iemand om hulp. Als je dichterbij komt, zie je wie erin zit: boekenmuis Mina.',
        ] : [
          'Het rode lint ligt bij een theekopje. Het loopt over de rand. O kijk! Mina klimt langs het lint omhoog. Voor haar is het net een ladder. Mina is de boekenmuis.',
          'Het rode lint eindigt in een theekopje. Mina de boekenmuis klimt eraan omhoog alsof het een touwladder is. Boven op de rand kijkt ze jullie opgelucht aan.',
        ],
        [
          'Op tafel zit ook een papieren reus. Hij is zo groot als een brooddoos. Zelf vindt hij dat heel groot. ‘Onze laatste bladzijde is leeg,’ zegt Mina. ‘Daarom weten we niet waar we wonen.’ De reus knikt. Hij wil graag een eigen plekje.',
          'Naast het kopje zit een papieren reus. Hij is niet groter dan een broodtrommel, maar vindt zichzelf reusachtig. ‘Onze laatste bladzijde is leeg,’ vertelt Mina. ‘Daarom weten we allebei niet waar we wonen.’ De reus zou graag terugkeren als ze een fijn plekje hadden.',
        ],
        'De reus wijst naar zijn oude bladzijde. Er staat maar één ding op: een hoge stoel. Er is geen tafel, geen deur en geen raam. ‘Je kunt er wel zitten,’ zegt hij. ‘Maar waar moet bezoek dan aanbellen?’',
        [
          'Dat vindt Mina ook. Ze knikt zo hard dat haar snorharen trillen. Loes legt een leeg vel midden op tafel. Jij vindt kleurpotloden. Er ligt ook een lange boekenlegger. Die is nog leeg. Mina pakt een potlood dat bijna zo groot is als zij.',
          'Mina knikt zo hard dat haar snorharen trillen. Zij zou ook graag bezoek ontvangen. Loes legt een leeg vel veilig midden op tafel. Jij legt de kleurpotloden en een lange, lege boekenlegger erbij. Mina kiest een potlood dat bijna even groot is als zijzelf.',
        ],
        '‘Wat nemen jullie mee?’ vraag je. Mina draagt een ronde theepot aan. De reus heeft een kussen. Het is bijna zo groot als zijn bed. Je zet de spullen naast elkaar. Dan weet je hoeveel plek nodig is.',
        [
          'Een potlood rolt tegen de boekenlegger aan. Alles ligt klaar. Met de potloden kun je een huis tekenen. Van de boekenlegger kun je een brug maken naar een fijne leesplek. Wat maak jij?',
          'De potloden rollen zacht tegen de boekenlegger. Mina en de reus wachten af. Je kunt een huis voor ze tekenen op de lege bladzijde, of de boekenlegger vouwen tot een brug naar een gezellige leesplek.',
        ],
      ]);
    case 3:
      return read(band, [
        picks[2] === 0 ? [
          'Je tekent een huis. Mina krijgt een lage deur. De reus krijgt een hoge. Mina tekent er een tuin bij voor de thee. De reus zet een kleine schommel in de tuin. Dan stappen ze blij hun bladzijde op.',
          'Op de lege bladzijde teken je een huis met een lage muizendeur en een hoge reuzendeur. Mina maakt er een tuin bij om thee te drinken. De reus tekent een kleine schommel. Tevreden lopen ze het nieuwe huis in.',
        ] : [
          'Je vouwt de boekenlegger tot een brug. Tussen twee bladzijden ligt een leesplek. Mina zet er een tafeltje voor de thee. De reus brengt zijn lievelingskussen mee. Samen stappen ze blij over jouw brug.',
          'Je vouwt van de boekenlegger een brug naar een leesplek tussen twee bladzijden. Mina zet er een theetafeltje neer en de reus draagt zijn lievelingskussen naar de overkant. Tevreden gaan ze hun verhaal weer in.',
        ],
        [
          '‘Dank je!’ roept Mina. De reus zwaait heel zacht. Het papier maakt bijna geen geluid. Loes zet hun boek op een lage plank. Die plank is fijn voor straks. Daar kan ieder kind het boek zelf weer pakken en lezen.',
          'Mina bedankt je nog vanuit de bladzijde. De reus zwaait zo voorzichtig dat het papier nauwelijks ritselt. Loes schuift hun boek op een lage plank, zodat kinderen het straks gemakkelijk kunnen pakken en openmaken.',
        ],
        'Hatsjoe! De bibliotheek niest. Een klodder modder spettert tegen het onderste raam. ‘O, die vieze voetjes!’ lacht Loes. Op het glas lijkt één klodder op een vis. Een andere lijkt op een aardappel met oren.',
        [
          'De boeken zijn droog. Maar het huisje wil geen modder meer achterlaten. Loes legt een handdoek bij de deur. Jij kijkt in de regenton. Er drijven zachte sponsjes op het water. Daarmee kun je de houten tenen schoonmaken.',
          'De boeken zijn gelukkig droog, maar de bibliotheek wil verder zonder moddersporen. Loes legt een handdoek bij de deur. In de regenton zie je zachte sponsjes drijven. Misschien kunnen jullie daarmee de vieze tenen onder het huisje wassen.',
        ],
        [
          'Het huisje houdt een poot omhoog. Onder elke teen zit een klein gaatje. In al die gaatjes zit modder. Die gaat niet weg met alleen een doek. Jij legt de sponsjes klaar. Loes vult een bakje. Het water ruikt naar regen.',
          'Het huisje steekt een poot omhoog. In de kleine gaatjes onder iedere teen zit modder die met een handdoek niet loskomt. Je legt de sponsjes klaar terwijl Loes een bakje met water vult. Het ruikt zo fris als een regenbui.',
        ],
        'Het huisje vindt wassen spannend. ‘Eén pootje tegelijk,’ zeg je. Nu kan het stil blijven staan. Je kunt de pootjes in de ton laten dansen. Of je maakt zachte zeepbellen om de tenen schoon te krijgen. Hoe help jij?',
      ]);
    case 4:
      return read(band, [
        picks[3] === 0 ? [
          'Links, rechts. Plons, plons! De vier pootjes dansen één voor één in de regenton. Loes klapt op de maat. Jij vangt de laatste druppels op met een spons. De houten voeten zijn weer schoon.',
          'Links, rechts, plons! De bibliotheek danst met haar vier voeten om de beurt in de regenton. Loes klapt het ritme en jij vangt de laatste druppels op met een spons. Haar houten tenen glimmen weer.',
        ] : [
          'Je blaast zachte zeepbellen onder het huisje. De bellen raken de tenen. Elke bel neemt een beetje modder mee. Het huisje wiebelt. Wat kriebelt dat! Als de bellen weg zijn, zijn de vier houten voeten schoon.',
          'Jij blaast een wolk zachte zeepbellen onder de bibliotheek. Iedere bel neemt een beetje modder mee. Het huisje wiebelt omdat het zo kriebelt. Als de laatste bellen uit elkaar spatten, zijn alle vier de voeten schoon.',
        ],
        [
          'Elk boek staat weer op zijn plank. Mina zwaait uit haar verhaal. Loes wijst naar het prikbord. Daar hangt een kaart. Er staan lege stippen op. ‘Op die plekken is nog geen leesbank,’ zegt Loes. ‘Daar kunnen wij met de boeken heen.’',
          'Binnen staat elk boek terug op zijn plek. Mina zwaait vanuit haar nieuwe verhaal. Op het prikbord hangt een kaart met lege stippen. ‘Daar staat nog geen leesbank,’ legt Loes uit. ‘Wij kunnen erheen lopen en boeken meenemen.’',
        ],
        'Er zijn ook kinderen die graag op één vaste plek komen lezen. Loes laat zien hoe de bibliotheek stil kan zitten. Het huisje vouwt zijn vier pootjes onder de vloer. Ernaast staat al een leeg bankje. Daar past een fijn kussen op.',
        [
          'Je gaat samen met Loes bij het raam staan. Buiten loopt een meisje. Ze heeft een rode en een blauwe laars aan. Ze kijkt naar het huisje. Aan de overkant wijst een vader het huisje aan zijn kind. Loes zwaait met haar vleugel.',
          'Vanaf het raam zie je een meisje met een rode en een blauwe laars. Ze blijft staan om naar het wandelende huisje te kijken. Aan de overkant wijst een vader de bibliotheek aan zijn kind. Loes zwaait naar hen met haar vleugel.',
        ],
        [
          'Je kijkt nog eens op de kaart. Een paar stippen zijn dichtbij. Andere liggen ver weg tussen de heuvels. Dan kijk je naar het lege bankje. Binnen zijn genoeg boeken om een hele middag te lezen. Waar zullen alle boeken heen gaan?',
          'Op de kaart staan sommige stippen dicht bij elkaar. Andere liggen ver weg tussen de heuvels. Je kijkt afwisselend naar de kaart en naar het lege bankje. Binnen staan genoeg boeken voor een hele middag lezen. Beide plannen zouden kunnen werken.',
        ],
        'Mina schuift haar raampje open en luistert mee. De papieren reus trekt vast zijn kleinste jas aan. Hij vindt allebei de plannen fijn. ‘Ga je de boeken rondbrengen,’ vraagt Loes, ‘of wil je hier een leeshoek maken?’',
      ]);
    default:
      if (picks[4] === 0) return read(band, [
        [
          'Loes tekent met een gouden potlood op de kaart. Van de ene stip naar de andere. Bij elke stip stopt de bibliotheek straks. Daar mogen kinderen een boek kiezen. Het huisje staat op. Het loopt met een boog om de plassen heen.',
          'Loes tekent met een gouden potlood een route langs de stippen op de kaart. Bij elke stop mogen nieuwe lezers een boek kiezen. De bibliotheek staat op en gaat rustig op pad. Ze loopt met een boog om de modderplassen heen.',
        ],
        [
          `Mina tekent een raampje in haar bladzijde. Zo kan ze onderweg zwaaien. ‘Jij hebt ons op weg geholpen, ${hero},’ zegt Loes. Ze geeft je een boekenlegger. Er staan vier houten voetjes op. Jij mag een volgende keer een stop bedenken.`,
          `Dankzij een raampje in haar eigen bladzijde kan Mina onderweg naar iedereen zwaaien. ‘Deze boekenreis begon bij jou, ${hero},’ zegt Loes. Ze geeft je een boekenlegger met vier houten voetjes erop. Bij een volgend bezoek mag jij een bestemming kiezen.`,
        ],
        'Bij de eerste stop staat een bankje onder een kastanjeboom. Loes doet de deur open. Er komen kinderen kijken. Ze gaan op de bank zitten. Loes geeft iedereen een boek om op schoot te leggen.',
        [
          'Een kind wijst naar de houten voeten. ‘Kunnen boeken ook moe worden?’ Loes denkt heel even na. ‘Alleen als ze altijd dicht moeten blijven.’ De kinderen lachen. Bij de eerste stip tekent Loes een bankje. Daar kun je nu echt lezen.',
          '‘Kunnen boeken ook moe worden?’ vraagt een kind dat naar de houten voeten wijst. ‘Alleen als ze te lang dicht blijven,’ zegt Loes. Iedereen lacht. Op de kaart komt bij de eerste lege stip een getekend bankje. Dat is nu echt een leesplek.',
        ],
        'Mina zwaait uit haar raampje. De reus zwaait met een heel kleine zakdoek. Jij gaat met je vinger over de vier voetjes op je boekenlegger. Ze bewegen even. Het lijkt wel of het volgende verhaal al aan komt stappen.',
      ]);
      return read(band, [
        [
          'Samen zet je een brede bank onder de lindeboom. Het huisje vouwt zijn poten op. De deur staat open. Iedereen kan naar binnen, ook de kleine papieren reus. Loes zet een mand met boeken neer.',
          'Samen met Loes zet je een brede leesbank onder de lindeboom. Het huisje vouwt zijn poten op en laat de deur open. Loes zet een mand met boeken klaar. Elk kind kan een plekje kiezen, zelfs de kleinste papieren reus.',
        ],
        picks[2] === 0 ? [
          'Mina staat trots in haar nieuwe huis. ‘Kijk eens naar die hoge en die lage deur,’ zegt ze. Ze laat ze allebei zien als er iemand bij de bank komt zitten.',
          'Mina laat bezoekers trots het huis zien dat je in haar verhaal tekende. Ze wijst naar haar eigen lage deur en daarna naar de hoge deur van de reus.',
        ] : [
          'Mina pakt de boekenleggerbrug. Ze legt de brug klaar. Die past precies tussen de twee bladzijden. Zo kunnen nieuwsgierige bezoekers naar haar leesplek komen. Ze zwaait door haar raampje.',
          'Mina legt de boekenleggerbrug terug op zijn plek. Nieuwsgierige bezoekers kunnen erover naar de leesplek tussen de bladzijden. Vanuit haar raampje wenkt ze hen.',
        ],
        [
          `Loes geeft jou het eerste kaartje om boeken te lenen. ‘Lees maar op je eigen tijd, ${hero}.’ Op het kaartje staat geen dag om klaar te zijn. Een kind schuift een kussen opzij. Nu kan er nog iemand op de bank.`,
          `Loes geeft jou het eerste uitleenkaartje. Er staat geen dag op waarop je klaar moet zijn. ‘Je mag het verhaal rustig ontdekken, ${hero}.’ Iemand schuift het kussen naar het uiteinde van de bank, zodat er nog een lezer bij past.`,
        ],
        'De boom maakt schaduw op de grond. Nu lijkt de schaduw op een draak. Even later is hij net een grote soepkom. Je wijst de vormen aan. De kinderen op de bank bedenken er samen kleine verhalen bij.',
        [
          'Het huisje zet de deur een stukje verder open. Zo kan het goed luisteren. Mina lacht en de reus schuift zijn kussen naar het raam. Je houdt het kaartje tegen het licht. Als je weggaat, is er op de bank een plekje vrij voor jou.',
          'De bibliotheek opent de deur nog een stukje om naar de verhalen te luisteren. Zij hoeft niet weg om iets nieuws mee te maken. Jij houdt het kaartje even tegen het licht. Het voelt als een uitnodiging. Als je afscheid neemt, blijft een plekje op de bank vrij.',
        ],
      ]);
  }
};

export const storyLevelsOceanLibrary: Record<string, Passage> = { ocean, library };
