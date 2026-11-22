type AgeVersion = (picks: number[], hero: string, band: 'under6' | '6to8', step?: number) => string;

const snow: AgeVersion = (picks, hero, band, step) => {
  if (band === 'under6') {
    if (step === undefined) return picks[4] === 0
      ? `Jullie lopen van lampje naar lampje. Puk draagt zijn twee kopjes. Hij tikt het lied van het feest. Als hij even stopt, hoor je iets anders. De sneeuw kraakt onder je schoenen.

Nori draagt de pan met warme soep. Aan het eind van de straat staan kopjes klaar. De sneeuwpop blijft op het plein staan. Hij zwaait met zijn takken. Jij zwaait terug. Zijn witte buik glanst in het gele licht.

Bij het tweede lampje stopt een meisje. Er liggen kleine vlokjes op haar want. Ze houdt haar hand in het licht. Kijk, ze glimmen! Puk laat haar rustig kijken. Dan tikt hij weer verder.

Het muisje loopt een eindje mee. Dan kruipt het warm bij een bezoeker. Jullie lopen rustig door. Niemand hoeft snel te gaan.

De soep ruikt naar wortel. Nori geeft jou een houten hangertje. Er zit een gat in. Dat gat heeft de vorm van een sneeuwvlok. ‘Dat is voor jou, ${hero},’ zegt Nori.

Je houdt het hout bij het lampje. Op tafel zie je de vorm van een vlok. Je wijst ernaar. Nori lacht. Jullie drinken de soep op. Het laatste lampje blijft nog even aan. Dan gaan jullie naar huis.`
      : `Alle bezoekers staan bij de soep. Puk tikt twee keer. De sneeuwpop zwaait met zijn takken. Het muisje piept. Dan doen ze het samen. Overal op het plein kun je het horen. Het wordt niet te hard.

Nori schept warme soep in kopjes. Hij maakt zijn gele sjaal wat losser. Jij krijgt een ronde knop van hout. ‘Voor het lied dat we samen maakten, ${hero},’ zegt hij.

Puk tikt nog twee keer. Hij houdt de kopjes stil tegen zijn buik. Nu hoor je andere geluiden. Een sjaal schuurt langs een jas. Een schoen stapt in sneeuw. De soep klotst zacht in een kom.

Het muisje steekt zijn neus omhoog. Het heeft het hele lied gehoord. Het zwaait met een dun pootje. Je zwaait terug. Er drijven nog twee vlokjes voorbij zijn neus.

Je rolt de knop tussen je handen. Er zit een deukje voor je duim in. Je tikt met een vinger. Tik, tik. Puk hoort het bij de kraam. Hij antwoordt met zijn kopjes.

Dan stopt Puk de kopjes weg. Het lied is klaar. De sneeuwpop glimlacht op het lege plein. De lampjes blijven nog even aan. De bezoekers lopen rustig naar hun warme huisjes.`;
    return [
      `${hero} vouwt een vlok van papier open. Ineens zie je een dorp in de sneeuw. De daken dragen witte mutsen. Op het plein staat ijsbeer Nori. Hij heeft een gele sjaal om.

Puk de pinguïn komt naar je toe. Hij houdt twee lege kopjes omhoog. ‘Het feest begint zo,’ zegt Nori. ‘De lampjes zijn aan. De soep is warm. Hoor je de bel?’

Het klinkt als een zacht hikje. Puk tikt de kopjes tegen elkaar. Bijna niets! De verse sneeuw maakt de geluiden klein. Puk houdt de kopjes naast zijn oor. Hij probeert het nog eens.

Daar is het: ting! Je kunt het horen. Het klinkt heel ver weg, ook al staat Puk naast je. ‘Het geluid is er nog,’ zegt Puk. ‘Het is alleen heel zacht.’

Nori zet een mand op de tafel. Er zitten droge wanten in. Die mag je lenen. De bezoekers stappen zacht door de sneeuw. Een kind tekent met een vinger een ster op de witte tafel. Het kind blaast zacht. Er stuiven een paar vlokjes van zijn vinger af.

Naast de ster liggen lepels en lege doosjes. Er ligt een houten plank. Er zijn ook vlaggen in felle kleuren. Puk zet de kopjes neer. ‘Hoe zullen we ons feest beginnen?’ vraagt Nori. Je kunt met de plank een klein podium bouwen. Of je laat de vlaggen zwaaien.`,
      `${picks[0] === 0 ? 'Je legt een brede plank op twee blokken sneeuw. Zo maak je een laag podium. Puk stapt erop. Hij tikt zijn kopjes. Nu klinkt de tik helder.' : 'Je zet gekleurde vlaggen langs het plein. Puk pakt een vlag en zwaait. De bezoekers zwaaien terug. Ze zien dat het feest is begonnen.'}

Puk wil een lied spelen voor de mensen. Tik, tik, tik. Hij speelt zo snel dat hij de tel kwijt is. Hij stopt. Dan begint hij weer. Ook nu weet hij niet waar het lied verder gaat.

Nori zet de soep terug op tafel. ‘We zoeken tikjes die we makkelijk kunnen herhalen,’ zegt hij. Puk schudt zijn schouders los. Hij heeft tijd om nog eens goed te luisteren.

De kok geeft Puk een leeg doosje. Het is licht en glad aan de rand. Daar kun je fijn op tikken. Puk probeert het. Na de eerste tik gaat hij weer zo snel dat hij zelf moet lachen.

Nori tikt zacht met één poot op zijn knie. Je hoort ook nog andere tikjes. Naast het plein gaat een slee de heuvel af. Elke keer hobbelt hij op dezelfde plek. De man op de slee zwaait.

De kok legt de soeplepels in rijtjes. Na twee tikjes wacht hij even. De slee is ook even stil tussen twee hobbels.

Je luistert met je handen stil. Twee mensen bij de pan wachten ook. Nu hoor je de tussenruimte goed. Puk houdt de kopjes klaar. Welk geluid zullen jullie nadoen?`,
      `${picks[1] === 0 ? 'De slee zegt hob-bel, hob-bel. Puk luistert even. Dan tikt hij mee op zijn kopjes. Nu weet hij precies wanneer hij weer aan de beurt is.' : 'De kok legt twee lepels neer. Tik, tik. Dan wacht hij even. Puk doet het na op zijn kopjes. Nu weet hij precies wanneer hij verder gaat.'}

Aan de rand van het plein staat een sneeuwpop. Zijn neus is een wortel. Zijn armen zijn takken. Die gaan heel zacht heen en weer. ‘Ik wil ook graag muziek maken,’ fluistert hij.

Hij kijkt naar zijn armen. ‘Maar ik heb geen handen. Hoe kan ik een kopje vasthouden?’ Nori kijkt naar de vlaggen en de lampjes. Misschien is er een ander plan.

De sneeuwpop bekijkt het eind van een tak. Er zit een klein takje aan. Het lijkt op een vinger. Hij zwaait er heel voorzichtig mee. Een jongen zwaait terug. De sneeuwpop glimlacht.

Nori legt twee lichte belletjes op een doek. Daar raken ze niet kwijt in de sneeuw. Puk doet het lied nog eens voor. Hij tikt twee keer. Daarna wacht hij stil. Iedereen moet goed kijken en luisteren. Een meisje doet de tikjes na. Ze klopt zacht met haar want op haar knie.

De sneeuwpop steekt zijn wortelneus vooruit. Je hoeft geen handen te hebben om mee te doen. Jullie kunnen de belletjes aan de takken hangen. Dan hoor je ze als hij zwaait. Of iedereen wacht op zijn zwaai. Dan laat hij zien wanneer het lied begint.`,
      `${picks[2] === 0 ? 'Er hangen belletjes aan de takken. De sneeuwpop zwaait met zijn ene arm. Kling! Dan probeert hij de andere arm. Puk wacht tussen zijn tikjes, zodat je de belletjes goed hoort.' : 'De sneeuwpop tilt zijn takken op. Puk speelt. De sneeuwpop laat zijn armen zakken. Iedereen wacht. De mensen op het plein weten nu wanneer ze aan de beurt zijn.'}

Onder de soepkraam hoor je een piep. Daar zit een klein sneeuwmuisje. Het wil de muzikanten graag zien. Er staan zo veel grote voeten in de weg. Het muisje kan alleen maar schoenen zien.

Nori buigt zich naar het muisje. Je hurkt naast hem. Er zitten twee vlokjes op zijn snor. Het tuurt naar de kopjes en doet met zijn staart een tikje na. Dan lacht het naar de sneeuwpop.

Nori zet zijn voeten wat verder uit elkaar. Zo heeft het muisje alvast meer ruimte. Jullie zoeken samen een plek waar het naast de anderen kan luisteren.

Er staat een lage kist tegen de kraam. Daarop ligt een zacht doekje. De kist staat stevig. Verderop liggen warme kussens. De wind komt daar bijna niet. Toch zie je alle lampjes. Van hier hoor je de kopjes ook. Je wijst naar Puk.

Het muisje mag zelf laten zien waar het fijn zit. Puk houdt de kopjes stil. De bezoekers wachten. Jullie kunnen het muisje op de kist laten kijken. Of je speelt het lied bij de kussens voor het muisje.`,
      `${picks[3] === 0 ? 'Het muisje zit op de kist. Nu ziet het het hele plein. Nori blijft bij de kist staan. Puk zwaait en speelt. Het muisje tikt mee met zijn staart.' : 'Jullie spelen het lied bij de kussens. Het muisje zit warm. Het kan alles goed horen. Andere bezoekers komen erbij. Het kringetje wordt groter.'}

Het plein klinkt weer vrolijk. Je hoeft niet hard te spelen. De sneeuw houdt grote geluiden tegen. Zelfs de kleinste tikjes van Puk en de sneeuwpop zijn nu goed te horen.

De kok legt een deksel op de pan. Zo blijft de soep warm. Een geitje raapt de losse lepels op. Het zet ze rechtop in een mand.

Even spelen de muzikanten niet. Toch hoor je het lied nog. Iemand zingt het heel zacht mee. Een ander tikt met zijn want op zijn jas. Puk hoort dat en lacht.

Een bezoeker met een kopje soep tikt met een voet mee. Een klein kind blijft vlakbij staan. Het doet de tikjes heel zacht na. Zo kan iedereen meedoen.

‘We hebben nog tijd voor één ding,’ zegt Nori. Hij kijkt langs de straat. De lampjes maken gele rondjes op de sneeuw. Iedereen kan rustig van het ene lampje naar het andere lopen. Het lied kan mee.

Nori kijkt ook naar de soepkraam. Er is plek voor een grote kring. Daar kan ieder om de beurt zijn eigen geluid laten horen. De kinderen willen nog één keer samen meedoen. Gaan jullie wandelen? Of spelen jullie bij de kraam het laatste lied?`,
    ][step];
  }

  if (step === undefined) return picks[4] === 0
    ? `De bezoekers lopen samen door de straat. Puk tikt het ritme zodra jullie bij een nieuwe lantaarn komen. Tussen de tikjes in hoor je de sneeuw kraken onder je schoenen. Nori gaat mee met de pan soep.

Vanaf het plein zwaait de sneeuwpop diep met zijn takken. Je zwaait terug. Het sneeuwmuisje doet een stukje mee, maar klimt daarna bij een bezoeker om warm te blijven.

Bij de tweede lantaarn ziet een meisje kleine glinsters op de sneeuw. De vlokken lijken wel met suiker bestrooid. Puk houdt zijn kopjes stil tot iedereen goed heeft gekeken. Dan klinkt jullie bekende ritme weer.

Aan het einde van de straat staan kopjes op een tafel. Nori schenkt de warme, naar wortel geurende soep in. Hij heeft ook een houten hangertje voor je gemaakt. In het midden zit een uitgesneden sneeuwvlok.

‘Je hebt ons feest een eigen geluid gegeven, ${hero},’ zegt Nori. Je houdt het hangertje voor de lantaarn. Op de tafel verschijnt de donkere vorm van een sneeuwvlok. Nori buigt zich voorover om te kijken en lacht.

Jullie drinken de laatste slok soep. De lantaarn blijft nog even branden. Iedereen neemt rustig afscheid. Met het houten hangertje op zak wandel jij terug naar huis.`
    : `Bij de soepkraam vormt iedereen een grote kring. Puk geeft twee tikjes. De sneeuwpop zwaait en het sneeuwmuisje laat een piepje horen. Daarna klinken alle kleine geluiden tegelijk. Het is precies hard genoeg, ook aan de rand van het plein.

Nori deelt warme soep uit. Hij slaat zijn gele sjaal losser om zijn nek. ‘Als er volgend jaar weer zo veel sneeuw ligt, weten we een lied,’ zegt hij. Hij geeft ${hero} een ronde houten knop.

Puk speelt nog twee tikjes en houdt zijn kopjes tegen zijn buik. Nu hoor je opeens andere geluiden: een sjaal die ritselt, een schoen in de sneeuw en soep die in een kom stroomt.

Het sneeuwmuisje steekt zijn neus boven zijn plekje uit. Het heeft elke tik gehoord. Het zwaait met zijn kleine poot. In jouw houten knop zit een kuiltje waar je duim precies in past.

Je tikt er met je wijsvinger twee keer tegenaan. Vanaf de kraam hoor je Puk kort antwoorden op zijn kopjes. Dan bergt hij ze op. De sneeuwpop kijkt tevreden hoe de eerste bezoekers naar huis gaan.

Het feest is klaar. De lantaarns blijven nog even aan om de weg naar de warme huisjes te verlichten.`;
  return [
    `Zodra ${hero} een papieren sneeuwvlok openvouwt, verschijnt er een winterdorp. Dikke pakken sneeuw bedekken de ronde daken. Op het plein wachten Nori de ijsbeer en Puk de pinguïn. Nori draagt een gele sjaal, Puk heeft twee lege theekopjes vast.

‘Het sneeuwfeest begint bijna,’ zegt Nori. ‘De lantaarns branden al en de soep is warm. Maar luister eens.’ Puk tikt de kopjes tegen elkaar. Je hoort bijna niets. Zelfs de grote bel geeft alleen een zacht hikje.

De verse sneeuw maakt alle geluiden zachter. Puk brengt de kopjes dicht bij zijn oor. Als hij nu tikt, hoort hij een klein tingeltje. ‘Het geluid is er nog,’ zegt hij. ‘Alsof er een dikke deken voor hangt.’

Nori wil weten of jullie een feest kunnen maken dat past bij deze zachte sneeuw. Op de tafel liggen houten lepels, lege doosjes en felle vlaggen. Nori zet er een mandje met droge handschoenen bij. Zo kunnen bezoekers ook rustig kijken zonder koude handen te krijgen.

Onder de schoenen van de bezoekers kraakt de sneeuw zacht. Een kind tekent met zijn vinger een ster op de rand van de tafel. Puk zet zijn kopjes veilig neer.

Nori kijkt naar een brede plank en naar de stapel vlaggen. ‘Ons feest kan beginnen met iets kleins dat iedereen kan horen óf zien,’ zegt hij. Jullie kunnen een laag podium maken of het dorp met vlaggen begroeten.`,
    `${picks[0] === 0 ? 'Je schuift een plank op twee stevige sneeuwblokken. Zodra Puk erop gaat staan, klinkt het eerste tikje veel helderder. Een paar bezoekers draaien zich om.' : 'Je zet gekleurde vlaggen langs het plein. Puk zwaait met een vlag. De bezoekers zwaaien allemaal terug. Het feest is al een beetje begonnen.'}

Puk wil een welkomstlied spelen. Hij tikt snel, stopt en begint opnieuw. Halverwege raakt hij telkens de tel kwijt. Nori zet de soeppan rustig terug op tafel. ‘Laten we een ritme zoeken dat iedereen makkelijk mee kan doen.’

De kok leent Puk een leeg doosje. Het is licht en heeft gladde randjes. Puk tikt één keer. Zijn tweede poging gaat zo snel dat hij er zelf om moet lachen. Hij schudt zijn schouders los om nog eens goed te luisteren.

Nori tikt rustig op zijn knie. Tijd genoeg. Op een hellinkje naast het plein hobbelt een ronde slee voorbij. De bestuurder komt steeds op dezelfde plek uit zijn bocht. Daar zwaait hij naar jullie.

Bij de keuken legt de kok de lepels naast de kommen. Hij maakt nette rijtjes. Je hoort twee tikjes en dan een korte stilte. Ook bij het hobbelen van de slee zit zo’n pauze.

Je tikt een keertje op je handschoen om het verschil te horen. Nori wacht mee tot de slee opnieuw voorbij komt.

Puk zet de kopjes weer klaar. Dit keer begint hij nog niet. Hij wil de geluiden eerst goed horen. Naar welke van de twee luisteren jullie samen?`,
    `${picks[1] === 0 ? 'Puk hoort de slee opnieuw over de sneeuw hobbelen. Hob-bel, hob-bel. Hij doet het na op zijn kopjes. Opeens weet hij precies wanneer hij weer moet beginnen.' : 'De kok legt twee lepels neer en wacht. Tik, tik, pauze. Puk speelt het na op zijn kopjes. Hij knikt: dit ritme kan hij onthouden.'}

Een sneeuwpop aan de rand van het plein beweegt zijn takkenarmen mee. ‘Ik zou ook graag muziek maken,’ fluistert hij. ‘Maar zonder handen kan ik niets vasthouden.’ Nori kijkt naar de lichtjes en vlaggen voor een idee. Het mooie aan die vlaggen is dat ze al bewegen bij een klein beetje wind. Zou dat met iets lichters ook lukken?

De sneeuwpop bestudeert zijn eigen armen. Aan één tak zit een klein uitsteeksel dat wel op een vinger lijkt. Hij zwaait ermee naar een jongetje. Als het jongetje terugzwaait, wordt zijn gezicht meteen vrolijker.

Nori legt lichte belletjes op een doekje. Zo raken ze niet kwijt in de sneeuw. Puk laat horen hoe hij even wacht tussen zijn tikjes. Jullie horen dat je tijdens die korte stilte ook goed kunt opletten.

De sneeuwpop steekt zijn wortelneus nieuwsgierig naar voren. Hij hoeft zijn takken helemaal niet te veranderen. Je kunt er lichte belletjes aan hangen die klinken als hij beweegt.

Je kunt zijn zwaai ook gebruiken als startsein voor het lied. Dan wordt hij de dirigent en wacht iedereen tot hij zijn takken optilt. Welke rol zou fijn voor hem zijn?`,
    `${picks[2] === 0 ? 'Aan elke tak van de sneeuwpop hangt een licht belletje. Hij zwaait met zijn ene tak en probeert daarna de andere. Puk laat net genoeg tijd tussen zijn tikjes om het klingelen te horen.' : 'De sneeuwpop tilt zijn takken op en Puk begint. Dan laat hij zijn armen zakken. Het hele plein wacht. Zonder iets te zeggen laat hij iedereen weten wanneer het lied verdergaat.'}

Onder de soepkraam piept een sneeuwmuisje. Het wil graag kijken, maar alle grote voeten staan ervoor. Nori buigt zich naar het muisje toe en jij hurkt ernaast.

Op de snorharen van het muisje zitten twee sneeuwvlokjes. Het kijkt naar de kopjes van Puk en tikt het lied na met zijn staart. Dan glimlacht het naar de sneeuwpop.

Nori schuift zijn voeten verder uit elkaar. Nu kan het muisje tenminste gemakkelijk onder de kraam vandaan. Jullie kijken waar het veilig en fijn kan zitten.

Tegen de kraam staat een lage kist. Er ligt een zachte lap op en de poten staan stevig. Tussen de warme kussens bij het plein is het minder koud. De lampjes zijn ook vanuit dat hoekje te zien.

Je houdt even je hoofd op dezelfde hoogte als het muisje. Nu begrijp je pas hoe groot de laarzen op het plein lijken.

Puk houdt zijn kopjes stil zolang jullie zoeken. Het muisje mag laten merken wat prettig voelt. Jullie kunnen het hoog genoeg laten zitten om te kijken. Of jullie spelen het lied dichtbij de kussens.`,
    `${picks[3] === 0 ? 'Op de lage kist ziet het muisje alles. Nori blijft ernaast staan. Eerst zwaait Puk naar het muisje en dan speelt hij het lied. Het muisje tikt vrolijk mee met zijn staart.' : 'Jullie spelen zacht bij de kussens. Het muisje hoeft alleen maar te luisteren. Andere bezoekers schuiven dichtbij en maken de kring vanzelf groter.'}

Nu klinkt het plein warm en vrolijk. De sneeuw maakt harde geluiden nog steeds zachter. Maar jullie kleine tikjes, klingels en piepjes passen precies bij deze winterdag.

Bij de kraam zet de kok een deksel op de pan om de soep warm te houden. Een geitje stopt de losse lepels in een mand. Jullie nemen even pauze.

Ook tijdens de pauze hoor je stukjes van het lied. De ene bezoeker neuriet en de andere tikt een ritme met zijn handschoen tegen zijn jas. Van iedereen heeft het lied iets gekregen.

Bij het muisje gaat een bezoeker door de knieën om te luisteren. Het muisje tikt mee met zijn staart. Van zo dichtbij klinken de kleine tikjes ineens een stuk duidelijker.

‘Nog één keer samen,’ stelt Nori voor. De lantaarns langs de straat maken ronde gele plekken in de sneeuw. Tijdens een lichtjeswandeling kunnen jullie van plek naar plek lopen en het ritme meenemen.

Bij de soepkraam is genoeg ruimte voor een kring. Daar kan iedereen om de beurt zijn geluid laten horen voordat jullie gezamenlijk eindigen. De kinderen op het plein komen alvast dichterbij. Puk geeft een knikje. Hij wacht op jouw keuze voor het laatste feestmoment.`,
  ][step];
};

const stars: AgeVersion = (picks, hero, band, step) => {
  if (band === 'under6') {
    if (step === undefined) return picks[4] === 0
      ? `Wisse maakt de waslijn los. De sterren zweven omhoog. Ze volgen de lijn naar de hemel. Het lijkt een rij gouden lampjes. Dons gaat een stukje mee. Hij blijft ver genoeg weg van hun licht.

Jij helpt de laatste ster. Ze vouwt haar stralen open. Eén, twee, drie. Dan zweeft ook zij naar haar plekje. Beneden zwaait Wisse met een doek. Je zwaait terug.

De sterren kijken om. Een lange straal zwaait als een lint. Een kleine ster maakt haar licht even fel. Dan maakt ze het weer zacht. Zo zegt ze dank je wel. Dons kijkt vanaf zijn eigen plek.

Wisse zet een kopje water voor je neer op het terras. Het ruikt er fris. Hij geeft je een kleine wasknijper van goud. ‘Dank je wel, ${hero}. Nu zijn de sterren schoon. Ze kunnen weer glanzen.’

Je doet de knijper open. Er staat een kleine ster in. Daarmee kun je thuis een tekening ophangen. Wisse laat je zien hoe dat gaat. Je houdt hem goed vast.

De trap van wolken rolt uit. De treden voelen stevig. Je stapt rustig naar beneden. De sterren hebben allemaal een plekje. Je kijkt nog één keer omhoog. Wat een mooie, lichte nacht!`
      : `Je zweeft met de kleinste ster naar boven. Jullie gaan rustig. Daar is een leeg stukje hemel. Er staan twee sterren die ze al kent. Zij schuiven wat op.

De kleine ster houdt haar stralen omhoog. Eerst één. Dan ook de andere. Alles past precies. ‘Hier wil ik wonen,’ zegt ze. Vanaf hier kun je het terras zien.

Beneden helpt Wisse de andere sterren op weg. Dan vouwt hij zijn doek op. Dons blijft bij de schoorsteen. Hij houdt een kopje wolkenthee vast. Hij blaast zacht. Het terras lijkt wel een lampje.

De kleine ster legt iets in jouw hand. Het is een lichtpareltje. ‘Zo denk je nog eens aan onze tocht, ${hero},’ zegt ze. Het pareltje voelt koel. Het is glad en veilig om vast te houden.

Je doet je hand weer open. Je ziet een klein lichtje in de parel. Het blijft even zacht glanzen, ook als je erin knijpt. Je stopt de parel veilig weg en zwaait.

De trap voert je terug naar huis. Op de onderste trede kijk je omhoog. Je ziet de kleine ster meteen. Daar, tussen haar buren! Ze ziet jou ook. Ze knippert langzaam. Jij neemt jouw lichtje mee naar huis.`;
    return [
      `Aan het gordijn van ${hero} hangt iets. Het is een gouden wasknijper. Je raakt hem aan. Daar rolt een trap uit. De treden zijn van wolken. Ze veren onder je voeten.

Boven staat Wisse de wasbeer. Hij draagt een blauw schort. Aan zijn waslijn hangen sterren. ‘Welkom!’ zegt Wisse. ‘Hier maak ik sterren schoon. Kijk eens hoe ze jeuk hebben.’

Er zit wolkenpluis aan hun stralen. Het voelt kriebelig. Een ster niest. Er valt een klein lichtje van haar af. Wisse zet een houten kuip klaar. Straks kunnen de sterren weer fijn glanzen.

De trap wordt achter je weer een rand. Op het terras ruikt het als na een regenbui. Toch is de lucht helder. Een wolkenveertje drijft naar je toe. Het plakt even aan je mouw.

Onder de bank zitten zachte borstels in een bak. Op het raam ligt een schelp met warm water. Wisse hangt een doek op. Daar kan een schone ster op liggen zonder weg te rollen.

‘Vinden ze wassen wel fijn?’ vraag je. ‘Vraag eerst waar het kriebelt,’ zegt Wisse. De kleinste ster steekt één straal op. Ze wijst waar het pluis zit. Op een andere plek wil ze liever geen aanraking.

Je kunt het pluis wegvegen met een zachte borstel. Of je maakt een warm badje in de kuip. De ster laat je weten wat prettig voelt.`,
      `${picks[0] === 0 ? 'Je veegt met de zachte borstel over de ster. Het pluis valt eraf. Ze draait zich om. Zo kun je ook bij haar andere stralen komen.' : 'Je zet de ster in een warm badje. Langzaam laat het pluis los. De ster drijft in de kuip. Ze lijkt wel een gouden koekje. Ze zucht tevreden.'}

De ster is nu schoon. Toch glanst ze nog maar een beetje. Wisse pakt een vergrootglas. Je kijkt erdoor. Er zitten lege plekjes op haar stralen. Daar horen lichtjes te zitten.

Een andere ster draait ook om. Je ziet precies dezelfde lege plekken op haar rug. Ze beweegt haar stralen. Het pluis is eraf, maar het licht komt niet zomaar terug. Wat vreemd!

‘Ik zag net een wolk langs de waslijn gaan,’ zegt Wisse. ‘Daar plakt het licht aan vast!’ Hij pakt een leeg mandje. Dat neemt hij mee om de lichtjes op te vangen.

De ster draait langzaam rond. Je hoeft haar niet te duwen. Er dobbert nog één lichtje in de kuip. Wisse schept het op met een schelp. Hij legt het voorzichtig in de mand.

Aan de lijn zit een zilveren draadje. Het gaat verder de lucht in. De wind blaast het tegen de schoorsteen. Tik! Verderop hoor je ook ting, ting.

Je houdt je hand boven je ogen. Zo kun je goed kijken. Het terras heeft een brede rand. Wisse kent de rustige weggetjes over de wolken. Jullie kunnen het draadje volgen. Of jullie gaan op het geluid af. Waar zoeken jullie eerst?`,
      `${picks[1] === 0 ? 'Je volgt het zilveren draadje. Het leidt naar een ronde wolk naast de schoorsteen. Aan de buik van de wolk zie je gouden lichtjes.' : 'Je luistert bij de rand van de wolken. Daar vind je een ronde wolk. Als die beweegt, doen de gouden lichtjes op zijn buik ting, ting.'}

‘Ik heet Dons,’ zegt de wolk. ‘Ik keek naar het wassen. Toen bleef alles aan mijn buik plakken.’ Wisse gaat naast hem staan. ‘Het licht kan vanzelf loskomen. Dan moet je je wel veilig voelen.’

In het dakraam ziet Dons zijn eigen buik. Het lijkt alsof er goud op zit. ‘Ik dacht dat ik zelf een ster was,’ zegt hij. Wisse legt uit waar het licht thuishoort.

Dons wil het licht graag teruggeven. Hij wil wel dat het zacht gebeurt. Hij houdt niet van trekken of kriebelen. Jij beweegt je hand langzaam door de lucht. Dons kijkt goed.

Dons durft dichterbij te komen. Zijn buik zweeft nu vlak boven de mand. Jij kunt een los puntje zien. Als hij stilhangt, begint het zacht te fonkelen.

Naast de schoorsteen ligt een brede kam. De punten zijn rond. Wisse houdt de kam bij zijn schort. Zo kan Dons de tanden zien. Wisse neuriet ook één toon. Het geluid klinkt zacht terug.

Bij allebei mag Dons zeggen wanneer jullie stoppen. Hij vraagt of Wisse bij hem blijft. Wisse zet de mand onder zijn buik. Zo vallen de lichtjes niet naar beneden. Kammen jullie zacht? Of zingen jullie een rustig lied?`,
      `${picks[2] === 0 ? 'Je haalt de kam heel zacht door Dons. Hij strekt zich tevreden uit. Eén voor één laten de gouden puntjes los. Ze vallen in Wisses mand.' : 'Jullie zingen een langzaam lied. Dons wiegt mee. Bij elke lange toon komen er lichtjes los. Ze vallen heel zacht in Wisses mand.'}

De sterren zijn schoon. Alleen liggen alle lichtjes door elkaar. Een kleine ster zoekt een klein lichtje. Een lange ster mist een streep van licht. Wisse zet lage schaaltjes op de tafel.

Een lang lichtje probeert op een ronde ster te passen. Kijk, het steekt aan beide kanten uit! Wisse legt het rustig terug. ‘Bijna. We blijven zoeken,’ zegt hij.

Een klein rond lichtje rolt tegen de kleine ster. De ster giechelt. Ze weet nog niet of het haar licht is. Ze vindt het fijn dat jullie wachten.

Wisse wijst naar een ander schaaltje. Daar ligt een streep naast twee rondjes. Hij schuift het schaaltje naar je toe. Je kunt de ronde vormen nu goed naast de lange streep zien.

Je schuift de schaaltjes uit elkaar. Nu rollen de vormen niet door elkaar. Wisse zet het lampje lager. Zo zie je de lichtjes beter. Dons is moe en rust bij de schoorsteen. Hij kijkt toe.

De sterren wachten aan de waslijn. Eén wijst naar een rondje. Een ander knippert zacht als er een lichtje dichtbij komt. Jullie kunnen de vormen bij elkaar leggen. Of jullie kijken welk lichtje terugknippert. Hoe helpen jullie de sterren zoeken?`,
      `${picks[3] === 0 ? 'Het kleine lichtje past op een kleine ster. De lange streep past op een lange straal. Wisse legt het laatste rondje op zijn plek. Nu klopt alles.' : 'De sterren knipperen één voor één. Elk lichtje knippert op zijn eigen manier terug. Dan springt het lichtje op de straal waar het thuishoort.'}

Aan de lijn glanst een hele rij schone sterren. Dons spoelt de kuip schoon. Dan mag hij even naast het terras rusten. ‘Het wordt bijna avond,’ zegt Wisse. Hij hangt zijn blauwe schort op.

Wisse haalt de laatste knijper van de lijn. Hij stopt hem in zijn zak. Bij de trap zet hij een lampje neer. Zo kun je straks de weg naar huis zien.

Het terras wordt donkerder. De sterren lijken daardoor nog lichter. De kleinste ster beweegt haar stralen één voor één. Eerst de bovenste. Dan die aan de zijkant. Ze kijkt naar de grote hemel.

Jij gaat bij de kleine ster zitten. Samen kijken jullie welke lichtjes daar al branden. Er zijn nu nog maar twee te zien.

Je wijst naar een brede plek boven het terras. Daar is ruimte voor een rij sterren. Tussen twee sterren ligt ook een rustig hoekje. Wisse zegt dat iedere plek anders is. Vanaf de ene zie je een rivier. Vanaf de andere zie je huizen of bomen.

Dons schuift de kuip onder de bank. Alles is opgeruimd. De kleinste ster wil rustig naar haar hoekje. Andere sterren willen samen omhoog. Help je de hele rij sterren? Of ga je met de kleinste mee?`,
    ][step];
  }

  if (step === undefined) return picks[4] === 0
    ? `Wisse maakt beide kanten van de waslijn los. De sterren zweven langs de lijn omhoog alsof het een optocht met gouden lampionnen is. Ieder lichtje gaat naar zijn eigen plek. Dons drijft mee op een afstandje.

Bij de laatste ster help je haar stralen ontvouwen. Dan vindt ook zij haar plaats. Vanaf het terras zwaait Wisse met zijn theedoek. Boven zwaait de langste straal als een gouden lint terug.

Een kleine ster laat haar licht langzaam feller worden en daarna weer zachter. Dat lijkt wel op een bedankje dat de hele hemel kan zien. Dons bewondert het van een wolkenbreedte verderop. Zo blijft het licht niet weer aan zijn buik plakken.

Terug op het terras zet Wisse een kopje water voor je klaar. Alles ruikt nog fris van het wassen. Hij geeft je een kleine gouden wasknijper. ‘Bedankt voor je hulp, ${hero}. Nu kunnen alle sterren rustig glanzen.’

Aan de binnenkant van de knijper zie je een klein sterretje staan. Wisse laat zien hoe je er thuis een tekening mee kunt ophangen. Zo heeft jullie wasdag daar ook een eigen plaats.

Onder je voeten rolt de wolkentrap langzaam uit. Je stapt naar beneden. Alle sterren glanzen helder boven je huis.`
    : `Jij gaat met de kleinste ster mee naar een rustig stukje hemel. Daar ziet ze twee sterren die ze al kent. Ze schuiven een beetje op om plaats te maken. Daardoor kan ze haar stralen één voor één uitstrekken.

‘Hier kan ik precies mezelf zijn,’ zegt ze. Intussen helpt Wisse de andere sterren op weg. Dons blijft bij de schoorsteen staan. Hij houdt met twee pluizige randjes een kopje wolkenthee vast. Jij ziet hem blazen over de warme thee.

Vanaf hier lijkt het terras op een klein lampje tussen de wolken. Wisse vouwt zijn theedoek op. Al het werk voor vandaag zit erop.

De kleine ster legt een koel lichtpareltje in je hand. ‘Voor onze tocht, ${hero},’ zegt ze. Je draait de parel om. Hij voelt glad en binnenin fonkelt een minuscuul lichtje. Als je zacht knijpt, blijft het even rustig gloeien.

Je zwaait bij de wolkentrap. Op de onderste trede kijk je nog één keer omhoog. De kleine ster vind je meteen tussen haar buren. Als ze jou ook ziet, knippert ze langzaam terug.

Daarna ga je naar huis, met het pareltje veilig in je hand. De kleinste ster is thuis, en de andere sterren staan ook op hun plek.`;
  return [
    `Aan het gordijn van ${hero} bungelt een gouden wasknijper. Zodra je die aanraakt, rolt er een trap van wolken uit. Elke trede veert een beetje mee. Boven staat Wisse de wasbeer te wachten in zijn blauwe schort.

Op het terras hangt een hele rij sterren aan de waslijn. ‘Welkom in de Sterrenwasserij,’ zegt Wisse. ‘De sterren hebben vandaag wolkenpluis tussen hun stralen gekregen.’ Eén ster niest zo hard dat ze een glinstertje laat vallen.

Wisse zet een houten kuip klaar. Onder de bank liggen maanborstels met zachte haren. Op de vensterbank staat een schelp met warm sterrenwater. Jullie kunnen de sterren helpen om weer prettig te glanzen.

Achter je trekt de wolkentrap samen tot de rand van het terras. Het ruikt er fris alsof het net heeft geregend. Toch is het boven jullie helder. Aan de rand van het terras drijft nog een wolkje voorbij. Een wolkenveertje drijft tegen je mouw.

Wisse hangt alvast een extra theedoek op. Daar kan een schone ster straks op liggen zonder weg te rollen. ‘Vinden ze wassen wel fijn?’ vraag je.

‘Ja, als iemand eerst vraagt hoe zacht het moet,’ zegt Wisse. De kleinste ster steekt één straal op. Ze laat je zien waar het pluis kriebelt en waar ze liever niet wordt aangeraakt. Je kunt zacht borstelen of een warm badje maken. De ster kan zelf aangeven wat ze fijn vindt.`,
    `${picks[0] === 0 ? 'Met je maanborstel veeg je het losse wolkenpluis rustig weg. De ster draait zich tevreden om. Zo kun je ook bij haar andere stralen komen.' : 'In het warme badje laat het pluis langzaam los. De ster zucht tevreden. Terwijl ze dobbert, lijkt ze op een gouden koekje in de houten kuip.'}

De ster is schoon, maar glanst nog maar half. Wisse pakt zijn vergrootglas. Je ziet gladde plekken waar het licht normaal zit. Wisse weet hoe dat komt. ‘Hun glinsters zijn blijven plakken aan de wolk die net voorbij kwam!’

Een tweede ster buigt haar langste straal naar het vergrootglas. Op haar licht zit ook een kale plek. Wisse houdt de lamp erbij. Ze ziet het nu zelf ook.

De ster draait langzaam rond zodat je haar niet hoeft te duwen. Aan de rand van de kuip dobbert nog één los lichtpuntje. Wisse schept het voorzichtig op met een schelp en legt het in zijn mandje.

Aan de waslijn zit een zilveren draadje. Het loopt de lucht in en tikt tegen de rand van de schoorsteen als de wind waait. Aan de andere kant hoor je zacht getingel, ergens achter een hoge wolkenrand.

Je houdt een hand boven je ogen om beter te zien. Wisse stopt het mandje in zijn tas. Dan kunnen jullie meteen meer lichtjes opvangen als jullie ze vinden.

Er is genoeg ruimte langs het terras. Wisse kent de veilige paadjes over de wolken. Volgen jullie eerst het zilveren draadje? Of gaan jullie af op het zachte getingel?`,
    `${picks[1] === 0 ? 'Het zilveren draadje brengt je naar een ronde wolk die naast de schoorsteen hangt. Er flonkeren gouden puntjes op zijn buik.' : 'Jullie luisteren verder dan de hoge wolkenrand. Daar hangt een ronde wolk. Telkens wanneer hij beweegt, tingelen de gouden puntjes aan zijn buik.'}

‘Ik heet Dons,’ zegt de wolk zacht. ‘Ik wilde alleen zien hoe wassen werkt. Nu plakt van alles aan me.’ Wisse gaat bij hem staan. ‘We kunnen de sterrenlichtjes helpen loskomen. Je hoeft er niet aan te trekken.’

In het ronde dakraam ziet Dons zijn gouden buik. Hij dacht even dat hij zelf een ster geworden was. Wisse vertelt waar het licht vandaan komt. Dons geeft het graag terug, als het maar niet kriebelt.

Dons probeert even zijn buik laag te houden. In het dakraam ziet hij dat er al een puntje wiebelt. Hij durft wat dichter naar het terras te schuiven.

Je laat hem zien hoe langzaam je een hand door de lucht kunt bewegen. Wisse toont een brede kam met ronde punten. Hij houdt die eerst bij zijn eigen schort, zodat Dons alles goed kan zien.

Wisse neuriet ook één toon. Samen luisteren jullie naar de echo. Dons steekt zijn pluizige rand een beetje omhoog. Hij vraagt of Wisse naast hem blijft, wat jullie ook proberen.

Het mandje staat alvast onder Dons om de glinsters op te vangen. Dons mag op elk moment vragen om te stoppen. Jullie kunnen zijn wolkendons zacht kammen of een rustig wiegelied zingen.`,
    `${picks[2] === 0 ? 'Je kamt voorzichtig door de wolk. Dons ontspant zich en rekt zich uit. De gouden puntjes komen één voor één los en vallen in Wisses mand.' : 'Dons wiegt rustig met jullie lied mee. Bij elke lange noot laat een groepje gouden puntjes los. Ze dwarrelen omlaag in de wasmand.'}

Alle sterren zijn schoon. Alleen liggen hun glinsters door elkaar. De kleinste ster zoekt een klein vonkje. Een lange ster zoekt een lichtstreep. Wisse zet een paar lage schaaltjes klaar.

Een lichtstreep probeert op een ronde ster te passen. Aan weerszijden steekt hij uit. ‘Bijna!’ zegt Wisse. Hij tilt het lichtstreepje terug in het schaaltje. Je hoeft het streepje nergens naartoe te duwen.

De kleine ster giechelt als een rond lichtje tegen haar straal rolt. Ze kent het nog niet goed genoeg om te weten of het bij haar hoort. ‘Ik wil graag rustig kijken,’ zegt ze.

Wisse wijst naar de punt van haar langste straal. Die is kleiner dan het losse rondje. De ster buigt opzij om te zien of het ronddraait als ze beweegt.

Je schuift de schaaltjes uit elkaar. Zo blijven de vormen gescheiden. Wisse zet de lantaarn lager zodat de kleine vonkjes beter opvallen. Dons rust bij de schoorsteen en kijkt nieuwsgierig toe.

Een paar sterren wijzen naar een vorm die bij hen zou kunnen passen. Andere knipperen zacht als een glinster in de buurt komt. Jullie kunnen de vonken en strepen op vorm sorteren, of de sterren hun eigen knipperritme laten spelen.`,
    `${picks[3] === 0 ? 'De kleine vonkjes passen op de kleine sterren. De lichtstrepen glijden naar de lange stralen. Wisse legt het laatste rondje op de juiste plek.' : 'Elke ster knippert op haar eigen ritme. De juiste glinsters knipperen terug. Daarna springen ze voorzichtig op de ster waar ze bij horen.'}

Aan de waslijn straalt een vrolijke rij schone sterren. Dons heeft intussen de kuip uitgespoeld. Hij schuift die onder de bank en gaat even uitrusten. ‘Het wordt bijna avond,’ zegt Wisse. Hij legt de laatste wasknijper weg.

Bij de trap zet hij een lantaarntje. Daar kunnen jullie straks de weg aan zien. Op het terras wordt het langzaam donkerder. Daardoor valt het schone licht van de sterren nog meer op.

De kleinste beweegt haar stralen één voor één. Eerst de bovenste en dan die aan de zijkanten. Ze is blij met haar licht. Toch kijkt ze even stil naar de grote hemel.

Je gaat naast haar zitten. Er staat al een eerste rij lichtjes in de verte. De ster laat zien welke twee ze van vorige nachten herkent.

Je wijst naar de open ruimte boven het terras en naar het hoekje tussen twee bekende sterren. Ieder plekje heeft een eigen uitzicht, vertelt Wisse. De ene ster ziet een rivier, de andere kijkt uit over een bos of een dorp.

Een paar sterren willen graag in een feestelijke rij samen omhoog. De kleinste wil het liever rustig aan doen. Nu het werk af is, kunnen jullie de optocht helpen of de kleine ster naar haar plek begeleiden.`,
  ][step];
};

export const storyLevelsSnowStars: Record<string, AgeVersion> = { snow, stars };
