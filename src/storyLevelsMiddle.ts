type StoryLevel = 'under6' | '6to8';
type StoryLevelText = (picks: number[], hero: string, band: StoryLevel, step?: number) => string;

const paragraphs = (...pieces: string[]) => pieces.join('\n\n');

const garden: StoryLevelText = (picks, hero, band, step) => {
  const young = band === 'under6';
  const read = (simple: string, middle: string) => young ? simple : middle;

  switch (step) {
    case 0:
      return paragraphs(
        read(
          `Op de vensterbank staat een bloempot. ${hero} vindt er een laddertje in. Je vouwt het open. Het gaat zo hoog! Bovenaan zie je een tuin. De bloemen zijn groot. Eentje is zo groot als een parasol.`,
          `Op de vensterbank vindt ${hero} een opgevouwen ladder in een bloempot. Als je hem uitrolt, gaat hij omhoog tot in een tuin. Onder een madelief zo groot als een parasol staat Pip de egel met zijn kruiwagen.`
        ),
        read(
          'Onder de bloem staat Pip de egel. Zijn kruiwagen heeft een dopje als wiel. ‘Kijk hoe hoog alles groeit!’ zegt Pip. Hij geeft je een strohoed. Die heeft gaatjes voor oren. Ze waren te klein voor zijn oren.',
          'Pip heeft een zaaddopje als wiel aan zijn kruiwagen gemaakt. Hij geeft je een strohoed. ‘Die gaatjes heb ik voor mijn oren gemaakt,’ zegt hij, ‘maar ze passen er niet doorheen.’ Bij jou zit de hoed prima.'
        ),
        'Een hommel vliegt langs een bloem. Hij is dik en zacht, net een luchtballon. Bzzzz! De blaadjes trillen als hij voorbijgaat. Pip zet de kar stil bij een plant met een breed blad. Hier ruikt het naar warme aarde. De stengels zijn zo hoog dat jij je hoofd ver naar achteren doet om de bloemen te zien.',
        read(
          '‘Er is één zaadje dat nog slaapt,’ zegt Pip. Het ligt tussen steentjes. Zo stapt er niemand op. Boven het zaad zit een groot rabarberblad. Het is net een paraplu. De regen komt er niet onder.',
          '‘Een zaadje wil nog niet wakker worden,’ zegt Pip. Hij wijst naar een kring van steentjes onder een rabarberblad. Zo weet iedereen dat hij om het perkje heen moet lopen. Het brede blad werkt als een paraplu: alle regen rolt erlangs.'
        ),
        read(
          'Het zaadje ligt in een droog bedje. Het heeft maar één druppel nodig. Een druppel dauw. Dat is water dat je vroeg in de ochtend op blaadjes ziet. Pip legt zijn handen op de kruiwagen. ‘Die druppel gaan we halen.’',
          'De grote bloemen krijgen genoeg water, maar daar in de schaduw blijft het droog. Pip legt uit dat één druppel ochtenddauw genoeg is. Die kleine druppels blijven na een koele nacht op de bladeren liggen. Samen gaan jullie er een bezorgen.'
        ),
        'Boven op een blad schittert een druppel. Een ladder tussen de stengels leidt ernaartoe. Verderop verzamelen slakken dauw in bakjes van bloemblaadjes. Pip zwaait naar ze. De kruiwagen staat klaar voor vertrek. Waar willen jullie eerst kijken?'
      );
    case 1:
      return paragraphs(
        picks[0] === 0
          ? read('Pip houdt het laddertje stil. Jij klimt naar een laag blad. Daar hangt een ronde druppel. Je kunt er net bij. ‘We hebben hem!’ roep je naar Pip. Hij rolt de kruiwagen wat dichter naar het blad toe.', 'Pip houdt de ladder vast terwijl je tussen de stengels omhoog klimt. Op het lage blad hangt precies binnen handbereik een ronde druppel. Je wenkt Pip. Hij zet zijn kruiwagen meteen onder het blad, klaar voor de rit naar het perkje.')
          : read('Jullie gaan naar de slakken. Die zitten tussen natte viooltjes. Ze hebben hun bakjes al gevuld. Eén slak schuift een ronde druppel naar jullie toe. ‘Neem maar mee!’ Pip zet zijn kruiwagen dicht bij het bloemblaadje.', 'Tussen de natte viooltjes zitten slakken met hun bakjes. Ze hebben meer dauw verzameld dan ze nodig hebben. Een slak schuift een volle druppel naar jullie toe. ‘Deze is voor het zaadje.’ Pip komt eraan met zijn lege kruiwagen.'),
        'Oei! De druppel rolt uit de kruiwagen. Op een blaadje blijft hij nog even wiebelen. Pip legt wat mos onder het wiel. Dan rijdt de kar niet weg. In de druppel staat de hele tuin op zijn kop. Daar ziet Pip zelfs zijn neus! Hij kijkt van links en van rechts. Dan moet hij lachen.',
        read(
          'Pip haalt een zacht lint uit zijn zak. Het is gemaakt van gras. Er zitten knoopjes in. Hij legt het lint rond de druppel. Dan meet hij de kar. ‘We hebben een bakje nodig. Anders rolt hij weer weg.’',
          'Pip haalt zijn meetlint van gevlochten gras tevoorschijn. Kleine knoopjes staan op de plaats van cijfers. Hij meet eerst de druppel en daarna de ruimte in de kruiwagen. ‘De bodem van de kar is te breed,’ zegt hij. ‘Hier moet een kommetje in.’'
        ),
        'Een mier komt voorbij. Hij draagt een piepklein pakje op zijn rug. In zijn eigen wagentje liggen twee kussentjes van mos. De mier wijst ernaar. Daar kan een pakje tussen liggen zonder te schuiven. ‘Bedankt voor de tip!’ zegt Pip.',
        read(
          'Bij een zonnebloem ligt een leeg dopje. Het is hard en rond. Verderop ligt een zacht blad van een tulp. Het kan buigen. Pip geeft je een sprietje gras. Daarmee kun je het blad dichtknopen als je het vouwt.',
          'Nu zoeken jullie iets dat goed om de druppel past. Naast de zonnebloem liggen lege zaaddopjes. Die zijn rond en stevig. Een gevallen tulpenblaadje voelt zacht genoeg om te vouwen. Als het niet vanzelf blijft zitten, kun je het met een grasspriet vastbinden.'
        ),
        'Pip zet een plukje mos aan elke kant van de lege plek. Hij draait aan zijn dopjeswiel om te kijken of het nog goed rolt. Jij legt de grasspriet klaar. Met welk bakje nemen jullie de druppel mee?'
      );
    case 2:
      return paragraphs(
        picks[1] === 0
          ? read('De druppel zit in een hard dopje. Het past mooi om hem heen. Pip zet het dopje tussen twee plukjes mos. Jij geeft de kar een duwtje. De druppel blijft zitten. Nu kunnen jullie verder naar het zaadje.', 'Het zaaddopje sluit mooi rond de druppel. Pip zet de kom tussen twee moskussentjes in zijn kruiwagen. Als hij de kar een stukje vooruitduwt, blijft de druppel rustig liggen. Nu kan de reis naar het perkje beginnen.')
          : read('Je vouwt het zachte tulpenblad omhoog. Er zit een sprietje gras omheen. Jij trekt dat vast met een knoopje. De druppel ligt in het zachte bakje. Pip zet het tussen het mos en duwt de kruiwagen vooruit.', 'Je vouwt het tulpenblad om de druppel. Met een draadje gras houd je het blad bij elkaar. Het zachte kommetje past tussen de twee plukjes mos in de kar. Pip tilt de handvatten op en rijdt de tuin in.'),
        'Jullie komen bij een beekje. Je hoort het water zacht langs een wortel lopen. Een kevertje is er druk met takjes in de weer. Het wil een brug bouwen. ‘Er mist nog één stukje,’ zegt het. ‘De kar kan er zo niet over.’',
        read(
          'Het kevertje legt zijn spullen neer. ‘Ik help graag met een druppel voor het zaadje!’ zegt het. Pip zet de kar op een vlak stuk grond. De druppel mag niet schudden. Het kevertje haalt nog wat droog mos voor jullie.',
          'Het kevertje bergt zijn gereedschap even op. ‘Voor een druppel voor het zaadje maak ik graag tijd.’ Pip zoekt een vlak plekje voor de kar, zodat niets gaat klotsen. Het kevertje draagt nog een paar droge moskussentjes aan.'
        ),
        read(
          'Op de oever ligt een veertje. Het voelt zacht aan de rand. In het midden is het hard. Dat harde stukje past op de brug. Het kevertje kan je laten zien waar het steun nodig heeft. Er ligt ook een plat steentje.',
          'De takjes van de brug liggen in kleine gleufjes. Op de oever ligt een licht veertje met een stevige schacht in het midden. Je kunt die als ontbrekend latje gebruiken. Het kevertje weet precies waar je het veertje moet laten rusten.'
        ),
        'Aan de overkant beweegt een breed blad mee met het water. Daar kan de kom ook op staan. Het blad wordt dan een bootje. Het kevertje kent iedere bocht van het beekje. Het kan een touw van gras vasthouden terwijl jullie varen. Zo blijft het bootje ook bij de draai om de wortel dichtbij.',
        'In de druppel zie je een stukje blauwe lucht. Het mos houdt de kom koel. Er is tijd genoeg om rustig naar beide plannen te kijken. Maken jullie de brug af of gaat de druppel met een bladbootje over het water?'
      );
    case 3:
      return paragraphs(
        picks[2] === 0
          ? read('Het veertje past tussen de takjes. Het kevertje stapt als eerste over de brug. Die houdt! Pip rolt de kar er langzaam achteraan. Jij kijkt naar de druppel in het bakje. Hij blijft netjes liggen. Jullie zijn aan de overkant.', 'De harde schacht van het veertje vormt het laatste latje van de takjesbrug. Het kevertje test de brug eerst met zijn eigen pootjes. Daarna duwt Pip de kruiwagen rustig naar de overkant. Jullie druppel is veilig meegereisd.')
          : read('Het bladbootje glijdt over het beekje. Het kevertje houdt het lange grastouw vast. Jij stuurt het blad van de wortel weg. De druppel rolt maar een heel klein stukje in zijn bakje. Dan raakt het bootje de overkant.', 'Met het grastouw in de poten van het kevertje kan het bladbootje rustig oversteken. Jij stuurt langs een wortel. Heel even rolt de druppel een stukje in zijn kom. Dan raakt het blad de overkant en kan Pip alles weer inladen.'),
        'Eindelijk komen jullie bij het perkje onder het rabarberblad. Daar ligt het zaadje, onder een harde bonk aarde. Pip kijkt naar zijn rug. ‘Mijn stekels zijn een slechte hark,’ zegt hij. ‘Straks zit de hele kluit aan me vast!’',
        read(
          'Pip gaat op zijn buik liggen. ‘Hier zit een barst.’ Jij kijkt mee. Onder de barst is de aarde donker en zacht. Dat is een fijn bed voor het zaadje. Jullie hoeven alleen een weg voor de druppel vrij te maken.',
          'Pip gaat op zijn buik liggen en ziet een barstje in de kluit. Daaronder is de grond zacht en donker. Het zaadje ligt dus al goed. Jullie hoeven alleen de harde laag los te maken, zodat de druppel erbij kan.'
        ),
        'Je zet de dauwkom op een vlak blad. Daar kan hij niet omvallen. Pip legt er een bloemblaadje boven. In die schaduw blijft het water koel. Een worm steekt zijn kop uit een hoopje aarde. Hij groet jullie heel zacht. Je wijst naar de barst, zodat de worm weet waar jullie willen beginnen.',
        read(
          'De worm kent de grond van binnen. Hij kan door een zacht stukje graven. Er ligt ook een klein harkje naast het perkje. De tandjes zijn van gras. Jij buigt er eentje. Zo kun je van boven kleine kruimels loshalen.',
          'De worm weet waar de grond van onderen het zachtst is. Daar kan hij een tunneltje maken. Het harkje bij het perkje werkt juist van bovenaf. Pip toont de tandjes van gevlochten gras. Ze buigen mee als je losse stukjes aarde weghaalt.'
        ),
        'Het kevertje kijkt vanaf de rand mee. Niemand hoeft hard te trekken of te duwen. Er hoeft maar een klein weggetje te komen. Dan glijdt het water vanzelf naar het zaadje. Vraag je de worm om hulp of pak je het grasharkje?'
      );
    case 4:
      return paragraphs(
        picks[3] === 0
          ? read('De worm graaft door de zachte aarde. Dan valt de harde bonk opzij. Nu kan de druppel bij het zaadje. Pip bedankt de worm. Jij haalt het bloemblaadje weg dat boven jullie kommetje ligt. Het water blinkt nog steeds.', 'De worm graaft een tunneltje onder de kluit. Zodra de kluit opzij zakt, komt er lucht bij het zaadje. Pip bedankt de worm en tilt de dauwkom op. Jij haalt het bloemblaadje weg dat de druppel koel heeft gehouden.')
          : read('Je maakt kleine rondjes met het harkje. De harde aarde valt uit elkaar. Nu liggen er zachte kruimels om het zaadje. Pip tilt het kommetje uit de kar. Jij helpt hem om het precies boven het zaadje te houden.', 'Je trekt kleine kringen over de kluit met het grasharkje. Het harde stuk valt in zachte kruimels uiteen. Zo kan het water erlangs. Pip tilt de dauwkom uit de kruiwagen en samen houden jullie hem boven het zaadje.'),
        'Plip! De druppel glijdt uit het bakje. Hij zakt in de grond. Daar is een groene punt. Hij groeit heel langzaam. Het grote rabarberblad ritselt boven jullie. Tussen twee bladeren valt een warme streep zon op het perkje.',
        read(
          'Het puntje maakt een blad los. Dat blad zit nog dicht. Het lijkt op een groene envelop. Pip buigt zijn neus naar voren. Hij hoort een zacht kraakje. Het blaadje draait vanzelf open. Er valt een kleine schaduw op de grond.',
          'Het eerste blaadje zit nog opgevouwen als een groene envelop. Van dichtbij hoort Pip een kraakje. ‘Hij gaat vanzelf open,’ fluistert hij. Samen wachten jullie tot de rand van het blaadje langzaam naar buiten draait en een fijne schaduw maakt.'
        ),
        'De slakken en het kevertje komen kijken. Pip zet zijn kar naast het plantje. De dauwkom is nu leeg. De bodem glanst nog. ‘Dit is een luisterzaadje,’ zegt Pip. Als jij praat, buigt het plantje naar je toe. Het luistert naar jullie ideeën. Pip maakt plaats tussen de steentjes. Nu kunnen de slakken het blaadje ook zien zonder op het perkje te komen.',
        read(
          'Onder de grote bloemen is nog plek. Een tent van bladeren zou er passen. Dan kunnen kleine dieren droog zitten als het regent. Je kijkt ook naar de muur. Bovenaan schijnt de zon. Daar kan een trap van bloemen naartoe.',
          'Je kijkt eerst naar de plek onder de hoge bloemen. Daar zou een brede tent van bladeren een fijne schuilplek zijn. Langs de kale muur kan ook iets groeien: een bloementrap van het perkje naar de zonnige bovenrand.'
        ),
        'Pip fluistert de twee plannen bij het plantje. Als hij over de tent praat, buigt het blaadje een beetje. Bij de trap beweegt het ook. Het plantje lijkt beide ideeën te horen. Welke kant laten jullie het groeien?'
      );
    default:
      if (picks[4] === 0) return paragraphs(
        read('Twee bladeren groeien naar elkaar toe. Ze maken een ronde tent. Pip duwt met zijn neus tegen de opening. De deur gaat open. Pip past er precies doorheen. Hij kan rechtop staan zonder met zijn stekels in het dak te prikken.', 'Twee brede bladeren buigen naar elkaar toe tot ze een ronde tent vormen. Pip steekt zijn neus door de opening. De deur is precies groot genoeg voor hem. Onder het nieuwe dak is het koel, ook al schijnt buiten de zon.'),
        'Het kevertje brengt een bankje van takjes. De slakken komen met een schaaltje dauw. Ze zetten hun huisjes naast de deur neer. De worm maakt de grond bij de ingang zacht. Pip hangt een open blad op. Dat betekent dat je binnen mag komen.',
        read('Er valt een druppel op het dak. Plok! Je hoort hem wel, maar voelt hem niet. Binnen is het droog. Pip rolt zijn kruiwagen onder een blad. Daar kan de kar blijven staan tot Pip hem morgen weer nodig heeft.', 'Een regendruppel landt op het bladerdak. Hij klinkt als een zacht trommeltje. Binnen blijft iedereen droog. Pip zet zijn kruiwagen onder de rand. Daar kan die vannacht rustig wachten tot Pip hem morgen weer nodig heeft.'),
        'Je gaat op het bankje zitten. Het wiegt een klein stukje mee. Het ruikt naar verse bladeren. Door de deur zie je de lange weg die jullie met de druppel hebben afgelegd. In die grote tuin hebben jullie nu ook een kleine, fijne plek.',
        `Pip rolt een zacht blad op tot een kussentje. Hij bindt er jullie grastouw om. Het knoopje houdt het blad goed vast, zonder het plat te drukken. ‘Voor jou, ${hero},’ zegt Pip. Jij neemt het kussentje mee naar huis.`
      );
      if (picks[2] === 0) return paragraphs(
        read('Langs de muur groeit een rij bladeren. Eén, twee, drie. Elk blad is een trede. Het kevertje maakt een leuning van zachte takjes. Zo kun je je vasthouden. Pip gaat achter je aan. Hij klimt met je mee naar boven.', 'Het plantje laat langs de muur brede bladeren groeien. Elk blad vormt een trede naar de zonnebloem. Het kevertje bouwt een leuning van twijgen, net zo zorgvuldig als zijn takjesbrug. Pip klimt met je mee naar het eerste rustplekje.'),
        'Sommige bladeren zijn dun en lichtgroen. De stevige bladeren zijn donker. Jullie gaan op een brede trede zitten. Boven jullie draait de zonnebloem haar grote gezicht naar de zon. Hier kun je haar heel goed zien.',
        read('Beneden zwaaien de slakken. Jij zwaait terug. Het lege kommetje staat nog tussen de steentjes. Het lijkt nu maar een stipje. ‘Al die blaadjes begonnen met één druppel,’ zegt Pip. Je ziet jullie brug in de verte.', 'Onder aan de trap zwaaien de slakken bij het perkje. Tussen de steentjes glanst het lege dauwkommetje. Van hier lijkt het zo klein als een stip. Jij herkent verderop de brug, waar het kevertje jullie eerder veilig heeft laten oversteken.'),
        `Pip vindt een zaadje met een zacht pluimpje. Het is zo licht als een veertje. ‘Dit mag met jou mee, ${hero}.’ Je houdt het vlak tegen je hand. Het lijkt wel een kleine parachute die zo weg kan vliegen.`,
        'Pip laat zien hoe je een kommetje van je handen maakt. Dan blijft het zaadje erin liggen. Samen gaan jullie de trap stap voor stap weer af. Op elke trede ziet de tuin er een beetje anders uit. Beneden zwaait Pip je uit.'
      );
      return paragraphs(
        read('De bloemen maken een trap langs de muur. Halverwege groeit een breed blad. Het is net een balkon. Pip duwt zijn kar erop. Er is genoeg plek om hem te draaien. De slakken komen ook naar boven, met een bakje dauw.', 'De bloementrap klimt langs de muur en maakt halverwege een breed balkon. Pip rijdt zijn kruiwagen helemaal tot boven op het blad. Daar heeft de kar zelfs genoeg ruimte om te keren. Een rij slakken brengt hun dauw mee naar boven.'),
        'Onder aan de trap meert het bladbootje aan. Het kevertje legt het vast aan zijn grastouw. Het haalt zijn spullen uit de boot en gaat zitten. Vanaf het balkon zien jullie het water en het wandelpad. Er zijn nu twee wegen door de tuin.',
        read('Pip ziet een leeg zaaddopje op het balkon. Hij raapt het op. Er komt een klein hengsel aan. Nu is het een mandje. In het hengsel maakt hij een gaatje. Daar kan nog een draadje doorheen als je het thuis wilt ophangen.', 'Pip raapt een leeg zaaddopje op dat op het balkon ligt. Hij maakt er een mandje van door er een hengsel aan te zetten. In het hengsel boort hij een klein gaatje, waar later een grasdraadje door kan.'),
        `‘Voor jou, ${hero},’ zegt Pip. Het ronde mandje ligt stevig in je hand. Je kunt er een blaadje of een mooie kiezel in bewaren. Nu is het nog leeg. Straks komt er vanzelf een vondst langs die je wilt houden.`,
        'Beneden zet Pip zijn kruiwagen weer bij het perkje. Een blad van het luisterplantje ritselt boven jullie hoofd. Het maakt een klein vlekje schaduw. Daar zeggen jullie elkaar gedag.'
      );
  }
};

const clock: StoryLevelText = (picks, hero, band, step) => {
  const young = band === 'under6';
  const read = (simple: string, middle: string) => young ? simple : middle;

  switch (step) {
    case 0:
      return paragraphs(
        read(`Ting, ting! In de boom hangt een grote klok. Hij slaat wel twaalf keer. Toch is de zon net op. ${hero} kijkt omhoog. Onder de klok zit een deur. Daar steekt een muis zijn kop uit. Hij heeft een blauwe sjaal om.`, `Terwijl de zon net opkomt, slaat de boomklok al twaalf keer. ${hero} kijkt naar boven. Onder de wijzerplaat zwaait een houten deurtje open. Daar staat muis Tik, met zijn blauwe sjaal scheef om zijn nek.`),
        read('‘Ik heet Tik. Kom maar naar boven!’ roept de muis. Je klimt de trap op. In de kamer draaien houten wieltjes. ‘De klok loopt te snel. De bel gaat al voor het ontbijt. Mijn ketel fluit terwijl het water nog koud is.’', '‘Kom kijken!’ roept Tik. Je klimt langs een brede trap naar zijn werkplaats. Houten tandwielen draaien boven de deur. ‘De klok loopt vooruit. Hij luidt de ontbijtbel veel te vroeg. Mijn ketel fluit al voordat het water warm wordt!’'),
        'In de werkplaats ruikt het naar hout en bloementhee. Tik hangt zijn sjaal op. Hij zet een krukje voor je neer. Door het raam zie je een konijn met een koude boterham. ‘De bel zei dat het tijd was,’ roept het konijn.',
        read('Vannacht waaide er wind naar binnen. Sindsdien doet de klok alles te snel. Tik zet de wielen even stil. Kijk maar. Aan elk wiel zitten tandjes. Die zien er allemaal nog heel uit. Sommige zijn breed. Andere hebben kleine punten of bobbeltjes.', 'Vannacht kwam er een haastige windvlaag door een kiertje. Sindsdien draait alles sneller. Tik laat de klok even stoppen, zodat je dichtbij kunt kijken. De houten wielen hebben verschillende tanden. Sommige zijn breed, andere puntig en weer andere hebben ronde golfjes. Er is niets afgebroken.'),
        read('Tik doet de klok weer aan. Achter de muur hoor je iets. Tik… tik… tikketik! Op tafel ligt een kaart. Er staan pijlen op. Ze wijzen van het ene wiel naar het andere. Er staan ook twee bekertjes om mee te luisteren.', 'Zodra Tik de klok weer aanzet, hoor je achter de muur een onregelmatig getik. Op tafel liggen een kaart van de tandwielen en twee luisterbekertjes. Met de kaart kun je volgen welke wielen elkaar aan het draaien brengen. De bekertjes helpen je goed te luisteren.'),
        'Nog één zuchtje wind komt door het kiertje. Tik zwaait naar het konijn beneden. ‘We zoeken uit waar de haast zit!’ roept hij. Je kunt de pijlen op de kaart volgen. Je kunt ook het snelste getik zoeken. Waar beginnen jullie?'
      );
    case 1:
      return paragraphs(
        picks[0] === 0
          ? read('Je legt je vinger op de eerste pijl. Die wijst naar de kast waar de thee staat. Boven de kast draait een klein wieltje. Het gaat veel sneller dan alle andere wielen. Je wijst het aan. ‘Daar is de haast!’ zegt Tik.', 'De pijlen op de kaart leiden je langs de houten tandwielen tot boven de theekast. Daar draait een klein rad veel sneller dan de rest. Je wijst het aan. ‘Goed gevonden,’ zegt Tik. ‘Vanaf daar wordt de hele klok opgejaagd.’')
          : read('Tik, tik, tikketikketik! Je houdt je oor dicht bij de muur. Daar klinkt het getik het snelst. Je loopt achter het geluid aan. Boven de theekast vind je een klein wieltje. Het draait veel te snel. Je roept Tik erbij.', 'Met je oor bij de muur volg je het snelste geluid: tikketikketik! Boven de theekast vind je een klein rad dat veel sneller draait dan alle andere wielen. Je wenkt Tik. Vanaf hier wordt het getik door de hele klok opgejaagd.'),
        'Tik drukt op een grote, ronde stopknop. Alle wijzers staan stil. Zelfs het wiel boven de deur stopt. Nu kun je van dichtbij zien wat er in het kleine wiel zit. Een veer heeft zich opgerold tot een hele strakke krul.',
        read('Tik tekent twee rondjes op de werkbank. Eerst een heel klein rondje. ‘Zo zit de veer nu opgerold.’ Dan tekent hij een rondje dat veel groter is. Je gaat met je vinger langs de rand. Daar heeft de veer veel meer plek.', 'Met krijt tekent Tik een klein kringeltje op de werkbank. Zo strak zit de veer nu. Daar omheen tekent hij een grotere kring. Als de veer zich uitrolt tot de buitenste rand, heeft hij weer genoeg ruimte om soepel te bewegen.'),
        'Op de werkbank liggen twee houten spatels. De uiteinden zijn breed en glad. Tik legt ze naast elkaar. Jullie kunnen elk een spatel vasthouden. Daartussen kan de veer zich langzaam uitrollen. Zo zet je de krul tijdens het uitrollen nergens klem.',
        read('Naast de spatels staat een bakje met mos. Het mos is groen en zacht. Voel maar. Het is niet nat. De veer kan erop liggen als in een nest. Dan hoeft niemand hem vast te houden. Hij kan vanzelf losser worden.', 'Het zachte mos in het andere bakje is droog en luchtig. Tik laat je voelen hoe het met je vinger meebuigt. Als jullie de veer erin leggen, kan hij zich op zijn eigen tempo uitstrekken. Het mos geeft hem overal steun.'),
        'Tik schuift zijn gereedschapsdoos opzij, zodat jullie genoeg plek hebben. De veer mag terug in de klok als hij weer een ruime krul heeft. Eerst mag jij een plan kiezen. Wil je hem met de spatels helpen uitrollen of in het mosbakje leggen?'
      );
    case 2:
      return paragraphs(
        picks[1] === 0
          ? read('Jij pakt een houten spatel. Tik pakt de andere. Jullie houden de veer tussen de twee gladde uiteinden. Hij rolt langzaam uit. De krul wordt steeds groter. Als de veer genoeg ruimte heeft, tilt Tik hem voorzichtig op.', 'Jullie pakken elk een houten spatel. Tussen de gladde uiteinden rolt de haastveer langzaam uit. Zodra de krul groot genoeg is om bij de buitenste kring van Tiks tekening te passen, tilt Tik de soepele veer voorzichtig op.')
          : read('Tik legt de veer in het bakje. De strakke krul ligt eerst heel stil op het mos. Dan komt er een zacht zuchtje. De veer rolt vanzelf uit. Nu is de krul groot genoeg. Tik tilt hem voorzichtig uit het nestje.', 'In het mosbakje rolt de strakke veer zich uit. Even lijkt het alsof hij opgelucht zucht. De krul heeft nu genoeg ruimte en kan soepel bewegen. Tik kijkt of hij bij de buitenste kring op de werkbank past en tilt hem op.'),
        'Tik zet de veer terug en laat de grote stopknop los. De wijzers bewegen nu kalm. Maar de klok klinkt gek. Tik… taktak… tik. Je tikt met je vinger op tafel. Soms weet je niet wanneer de volgende tik komt. Dan tik je ernaast.',
        read('Tik probeert het ook. Zijn snorren gaan scheef staan. Hij haalt diep adem. Dan legt hij zijn poot stil op tafel. ‘We zoeken eerst een goed voorbeeld. Een geluid dat elke keer op tijd komt. Dat kunnen we aan de klok leren.’', 'Tik probeert het ook. Zijn snorharen gaan scheef staan van het nadenken. Dan haalt hij diep adem en stopt met meetikken. ‘We hebben een ritme nodig dat steeds hetzelfde blijft,’ zegt hij. ‘Dan kan het grote tandwiel ons voorbeeld volgen.’'),
        'Door het raam hoor je een specht. Met zijn snavel tikt hij op een holle tak. Tik, tik, tik. Dan wacht hij even. Na dat kleine stukje stilte begint hij weer. Jullie kunnen onder zijn boom gaan staan om het beter te horen.',
        read('Beneden staat ook een oude waterpomp. Aan de tuit groeit een druppel. Die wordt dik en rond. Dan valt hij in een emmer. Plop! Even later komt de volgende. Tussen twee druppels zit steeds evenveel tijd. Dat is ook een fijn geluid.', 'Bij de waterpomp hoor je telkens een druppel in een emmer plonzen. Aan de tuit wordt de druppel langzaam rond en laat los. De volgende druppel doet er even lang over. Je zou het ritme kunnen onthouden door zachtjes mee te knikken.'),
        'Tik doet de deur van zijn werkplaats open. De trap is breed genoeg om samen af te dalen. De luisterbekertjes mogen op tafel blijven. Vandaag nemen jullie alleen een ritme mee. Ga je luisteren naar de specht of naar de druppels?'
      );
    case 3:
      return paragraphs(
        picks[2] === 0
          ? read('De specht tikt drie keer op de holle tak. Dan is het even stil. Hoor je de drie tikken weer? Tik klopt zacht mee op een houten plankje. Jij probeert het ook. Zo onthouden jullie het ritme voor de klok.', 'De specht tikt drie korte tikken op de holle tak en wacht even. Dan begint hij opnieuw. Tik klopt op zijn houten plankje mee, zodat hij het ritme kan onthouden voor de klok. Jij doet het na op je knie. Dan lopen jullie samen de trap weer op.')
          : read('Bij de pomp luisteren jullie naar de druppels. Plop, plop, plop. Ze vallen stuk voor stuk in de emmer. Tussen twee druppels is het steeds even lang stil. Tik knikt mee. Zo kan hij het ritme meenemen naar boven.', 'Bij de waterpomp kijken jullie hoe de druppels vallen. Plop, plop, plop. Tussen twee druppels zit evenveel tijd, zonder dat ze elkaar opjagen. Tik knikt bij ieder plonsje. Zo kan hij het ritme onthouden voor het grote rad.'),
        'Boven in de werkplaats doet het grote houten wiel mee. De wijzers lopen netjes gelijk. Maar de ontbijtbel zwaait al heen en weer. Het is nog niet tijd! ‘Ik wil graag helpen,’ zegt de bel. ‘Hoe weet ik wanneer ik aan de beurt ben?’',
        read('De bel hangt aan een balkje. Er zit een rond raampje naast. Zo ziet ze wie over het plein loopt. Elke keer als iemand een bord draagt, wil de bel luiden. ‘Ik dacht dat je maar beter vroeg kon beginnen,’ vertelt ze.', 'Naast het balkje van de bel zit een rond raam met uitzicht op het plein. Zodra er iemand met een bord langsloopt, wil de bel al luiden. ‘Ik dacht dat vroeg beginnen altijd handig was,’ vertelt ze. Beneden haalt iemand nog zijn brood.'),
        'Tik drukt weer even op stop. Nu kunnen jullie bij het balkje. Hij houdt een klein houten klepje omhoog. Dat kan voor de bel schuiven, zodat ze stil blijft. Als het juiste tandje voorbijkomt, kan het klepje weer opzij. Dan mag de bel luiden.',
        read('Aan de andere kant zie je een glad ringetje. Daar past een zacht koord doorheen. Het koord kan aan de goede wijzer vast. Op tijd trekt het aan de bel. Dan kan de bel zelf horen dat het haar beurt is.', 'Tik wijst naar een glad oogje bij de wijzer. Daar past een zacht koord doorheen. Als jullie het koord aan de juiste wijzer vastmaken, kan het een klein trekje geven zodra de bel aan de beurt is.'),
        'Je houdt eerst het klepje omhoog en daarna het koord. De bel blijft stil, maar zwaait een beetje om te laten zien dat ze oplet. Tik laat het grote rad nog even wachten. Welk seintje maken jullie voor de bel?'
      );
    case 4:
      return paragraphs(
        picks[3] === 0
          ? read('Het houten klepje houdt de bel even tegen. Daar komt het juiste tandje aan. Het klepje schuift opzij. Ting! Jij kijkt uit het raam. De dieren zetten net hun kommen op tafel. De bel heeft precies op het goede moment geluid.', 'Het wachtklepje houdt de bel stil totdat het juiste tandje voorbijkomt. Dan schuift het opzij. Ting! Als je uit het raam kijkt, zie je de dieren hun ontbijtkommen op tafel zetten. De bel klinkt precies als alles klaarstaat.')
          : read('Het zachte koord zit aan de wijzer. Die beweegt een beetje verder. Dan krijgt de bel een zacht trekje. Ting! Jij kijkt uit het raam. De dieren schuiven net hun stoelen bij de tafel. De bel heeft precies op tijd geluid.', 'Het zachte koord beweegt mee met de wijzer. Zodra de kommen op tafel staan, geeft het de bel één klein trekje. Ting! Op het plein schuiven de dieren aan voor het ontbijt. Deze keer heeft de bel precies op tijd geluid.'),
        'Nu hoor je de vogels tussen de tikken door. Beneden schenkt iemand thee in. Een muis zwaait met zijn lepel en gaat weer zitten. Niemand hoeft te rennen voor een bel die te vroeg gaat. Tik kijkt tevreden door het ronde raam.',
        read(`Tik knoopt zijn blauwe sjaal om. ‘Zullen we nog iets maken, ${hero}? Iets voor een rustige ochtend.’ Hij pakt een doek en legt die op zijn tafel. Er liggen nog wat gladde plankjes en drie ronde staafjes van hout. Jij mag ze even voelen.`, `Tik knoopt zijn blauwe sjaal om. ‘Zullen we iets maken dat onze ochtenden fijn houdt, ${hero}?’ Hij spreidt een doek uit op de werkbank. Daar legt hij gladde plankjes en drie houten klankstaafjes neer. Jij mag voelen hoe glad de randen zijn.`),
        'Tik houdt een staafje tussen zijn vingers. Als jij erop tikt, klinkt er een zachte toon. Elk staafje klinkt weer anders. Met alle drie kunnen jullie een klein liedje maken. Een paar tonen en dan weer stilte. Dat zou mooi zijn voor de ochtend.',
        read('Van de plankjes kun je een bankje maken. Dan heeft wie nog even wacht een plek om te zitten. Daar valt straks zon op. Iemand kan er luisteren of even niets doen. Jij kijkt naar de plankjes en de drie staafjes.', 'Van de overgebleven plankjes zouden jullie buiten een wachtbankje kunnen maken. Dan hebben de dieren een fijn plekje om te zitten voordat hun volgende plan aan de beurt is. Er is genoeg hout voor een rugleuning en een brede zitplek.'),
        'Tik wacht met potlood pakken. Jij krijgt de tijd om te kiezen. De klok tikt rustig verder. Er is ruimte tussen iedere tik en tak. Wat voegen jullie toe voor de volgende ochtenden? Een muziekje of een bankje bij de boom?'
      );
    default:
      if (picks[4] === 0) return paragraphs(
        read('Tik zet de drie houten staafjes aan het grote wiel vast. Elke ochtend spelen ze een kort liedje. Hoor je de drie tonen? Dan is het weer stil. Pas daarna gaat de ontbijtbel. Nu heeft ieder geluid zijn eigen beurt.', 'Tik maakt de drie houten klankstaafjes vast aan het grote rad. Iedere ochtend spelen ze een klein liedje vlak voordat de ontbijtbel klinkt. Daarna is er weer ruimte voor de andere geluiden. Je hoort de waterpomp druppen en de specht luistert vanaf zijn tak.'),
        'Een kleine muis doet haar raam open en rekt zich uit. Ze is niet geschrokken van het liedje. Het was precies zacht genoeg. Ze zwaait met twee pootjes naar de boom. Beneden gaan de dieren rustig aan tafel voor het ontbijt.',
        read(`Tik zet twee stoeltjes bij zijn werkbank. Hij schenkt warme bloementhee in. Voor ${hero} ligt een houten klokje klaar. Je kunt het ophangen aan een haakje. Er staan geen cijfers op. Je ziet een zon, een bankje en een ronde maan.`, `Bij de werkbank zet Tik twee stoeltjes en een kan warme bloementhee neer. Voor ${hero} heeft hij een houten klokhangertje gemaakt. De wijzerplaat heeft geen cijfers. In plaats daarvan staan er een zon, een bankje en een mooie, ronde maan op.`),
        'Je voelt met je vinger langs de gladde rand. Bij de zon zit een klein rond kuiltje. Naast de zon zie je het bankje. In gedachten ga je erop zitten. Tik veegt de laatste houtkrullen weg en bergt zijn gereedschap op.',
        'De klok tikt rustig verder. Je hoeft je kopje niet snel leeg te drinken. Terwijl je nog een slokje neemt, begint boven jullie hoofd het kleine muziekwerk langzaam aan een volgende ronde. Jij mag blijven kijken tot het tijd is om naar huis te gaan.'
      );
      if (picks[2] === 0) return paragraphs(
        read('Jullie zetten een bankje onder de tak van de specht. Wie te vroeg is voor iets, kan daar wachten. Tik hangt zijn kaart in het deurtje van de klok. Zo kan hij later nog zien waar jullie het snelle wieltje hebben gevonden.', 'Jullie bouwen het bankje onder de tak van de specht. Wie te vroeg is voor een afspraak, kan er even uitrusten en naar het ritme luisteren. Tik hangt zijn raderkaart in het klokdeurtje, zodat hij jullie zoektocht naar het haastige tandwiel kan terugvinden.'),
        'De specht is er al. Hij tikt drie keer op de tak. Dan houdt hij zijn snavel stil. Jij tikt drie keer terug op de bank. Tik lacht. Jullie hebben meteen een spel voor het bankje. Een eekhoorn komt erbij zitten.',
        read(`Tik geeft ${hero} een houten plankje. Op de voorkant staan drie stippen. Na die drie stippen komt een stukje zonder stip. Daar moet je even wachten. Achterop heeft Tik een klein blaadje getekend. Dat is voor de boom waar jullie samen aan de klok werkten.`, `Tik geeft ${hero} een houten ritmeplankje met drie stippen en ruimte voor een pauze. Het is hetzelfde ritme dat de klok hielp. Op de achterkant heeft Tik een blaadje getekend als herinnering aan de boom waarin jullie samen werkten.`),
        'Je legt het plankje op je schoot en tikt de stippen na. In het stille stukje na de derde tik hoor je de wind door de bladeren gaan. De specht wacht rustig. De eekhoorn kijkt omhoog zonder iets te zeggen. Er is tijd genoeg.',
        'De klok loopt rustig verder. Even later gaat de bel precies op tijd voor jullie tweede kopje thee. Tik schenkt bij. Jij tikt nog één keer op het plankje. De specht geeft antwoord. Je kunt het spel thuis ook met iemand spelen.'
      );
      return paragraphs(
        read('Jullie zetten het bankje bij de oude pomp. Tik hangt een klein schaaltje onder de emmer. Een druppel valt erin. Plop! Je hoort hem heel goed. De volgende druppel klinkt precies even zacht. Bij de pomp is een fijne plek om te wachten.', 'Het bankje krijgt een plek naast de oude waterpomp. Tik hangt een schaaltje onder de emmer, zodat elke druppel er helder in klinkt. Plop, plop, plop. Wie moet wachten, kan hier zitten en naar het rustige water luisteren.'),
        'Een konijn komt met een marktmand bij het bankje. Hij is vroeg voor de markt. Eerst weet hij niet waar hij heen moet. Dan zet hij zijn mand neer en gaat bij jullie zitten. Samen tellen jullie drie plonsjes. Daarna luistert hij verder.',
        read(`Tik heeft iets voor ${hero}. Hij geeft je een blauw kraaltje aan een draad. Het lijkt net een waterdruppel. Als je het op je hand legt, zie je er een streepje licht in. Tik maakt het knoopje nog eens goed vast.`, `Tik knoopt een glad, blauw kraaltje aan een draad voor ${hero}. Het lijkt op een waterdruppel. Als je het tegen het licht houdt, zie je er een dun streepje in. Tik trekt het knoopje extra stevig aan voor onderweg.`),
        'Je kunt het kraaltje in je jaszak stoppen of thuis ophangen. Dan denk je weer aan de klank van de druppels. Even hoor je de boomklok door de plonsjes heen. Ze klinken allebei anders. Elk geluid heeft de tijd om te komen.',
        'Jij staat op. Het konijn blijft nog even zitten. Tik loopt met je mee naar de trap bij de boom. Daar zwaait hij je uit. In je jaszak voel je het kraaltje. Bij de pomp klinkt nog één zachte plop.'
      );
  }
};

export const storyLevelsMiddle: Record<string, StoryLevelText> = { garden, clock };
