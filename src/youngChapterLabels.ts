import type { StoryId } from './storyCatalog';

type ChoiceLabels = readonly [string, string];
type ChapterLabels = {
  title: string;
  choices: ChoiceLabels | ((picks: number[]) => ChoiceLabels);
};

export const youngChapterLabels: Partial<Record<string, readonly ChapterLabels[]>> = {
  station: [
    { title: 'Een trein voor je raam', choices: ['Help Dibbel', 'Pak de gouden sleutel'] },
    { title: 'Waar rijdt de trein heen?', choices: ['Volg de muziek', 'Volg de lichtjes'] },
    { title: 'De wolk heeft de hik', choices: ['Zing een liedje', 'Geef de wolk thee'] },
    { title: 'Een briefje in de trein', choices: ['Luister naar het getik', 'Volg de sterrenkaart'] },
    { title: 'De laatste keuze', choices: ['Maak een nieuw station', 'Breng het station naar huis'] },
  ],
  dream: [
    { title: 'Pippa brengt een droom', choices: ['Door de tunnel', 'Over de regenboogbrug'] },
    { title: 'Wie krijgt een droom?', choices: ['Eerst naar de beer', 'Eerst naar de maan'] },
    { title: 'De dromen vliegen weg', choices: ['Zing de dromen terug', 'Vang ze met een net'] },
    { title: 'De grote droombel', choices: (picks) => [picks[0] === 0 ? 'Vraag Melle om hulp' : 'Vraag Fien om hulp', 'Stap zelf naar binnen'] },
    { title: 'Een zaadje vol dromen', choices: (picks) => ['Plant een tuin voor iedereen', picks[1] === 0 ? 'Geef het aan de beer' : 'Geef het aan de maan'] },
  ],
  toy: [
    { title: 'De boot naast je bed', choices: ['Neem Bram de beer mee', 'Neem Nola het konijn mee'] },
    { title: 'Golven op het kleed', choices: ['Bouw een brug van potloden', 'Vaar in de pantoffel'] },
    { title: 'Het kleine sokkenmonster', choices: ['Maak een slaapzak', 'Neem hem mee'] },
    { title: 'Een reus ligt te slapen', choices: ['Zing een slaapliedje', 'Vraag of je langs mag'] },
    { title: 'Het licht is terug', choices: ['Maak een weg naar huis', 'Bouw een huis voor vrienden'] },
  ],
  weather: [
    { title: 'Potjes vol weer', choices: ['Zoek de juiste plaatjes', 'Luister naar de potjes'] },
    { title: 'De kar komt niet vooruit', choices: ['Vraag de slak', 'Pak het windlint'] },
    { title: 'Regen op de verkeerde plek', choices: ['Lok het wolkje met rozen', 'Tik voor het wolkje'] },
    { title: 'Een potje zonder zon', choices: ['Vang licht met het bekertje', 'Klap de paraplu open'] },
    { title: 'Feest in het dorp', choices: ['Maak een regenboogpad', 'Maak een fijne picknickplek'] },
  ],
  moonbakery: [
    { title: 'Een plat brood', choices: ['Open het receptenblik', 'Luister naar het deeg'] },
    { title: 'Een snufje wensgist', choices: ['Loop over de sterstenen', 'Vaar in de lepel'] },
    { title: 'De mot met de snor', choices: ['Borstel zijn snor', 'Wapper met de bloemen'] },
    { title: 'Het deeg wordt zacht', choices: ['Neurie en kneed', 'Wieg het deeg'] },
    { title: 'Ontbijt op de maan', choices: ['Bak één grote broodmaan', 'Bak broodjes die lopen'] },
  ],
  ocean: [
    { title: 'Ssst, de zee is stil', choices: ['Volg de sporen in het zand', 'Volg de luchtbelletjes'] },
    { title: 'Een muur van zeewier', choices: ['Klem het wier opzij', 'Vraag de garnalen'] },
    { title: 'De vis durft niet', choices: ['Speel samen één noot', 'Laat een bloem luisteren'] },
    { title: 'Water voor de bloemen', choices: ['Leg een pad van stenen', 'Gebruik de holle schelp'] },
    { title: 'De tuin zingt weer', choices: ['Luister in een kring', 'Bouw een toren voor muziek'] },
  ],
  garden: [
    { title: 'Een tuin vol reuzenbloemen', choices: ['Klim naar de druppel', 'Vraag de slakken'] },
    { title: 'Een bakje voor water', choices: ['Pak een zaaddopje', 'Vouw een tulpenblad'] },
    { title: 'Naar de overkant', choices: ['Maak de takjesbrug af', 'Maak een bladbootje'] },
    { title: 'Het zaadje ligt verstopt', choices: ['Vraag de worm', 'Hark de grond los'] },
    { title: 'Kijk, het zaadje groeit!', choices: ['Laat een bladertent groeien', 'Laat een bloementrap groeien'] },
  ],
  clock: [
    { title: 'De klok gaat te snel', choices: ['Volg de kaart', 'Luister naar het getik'] },
    { title: 'Een veer zit vast', choices: ['Rol de veer uit', 'Leg de veer in mos'] },
    { title: 'Tik, tik, pauze', choices: ['Luister naar de specht', 'Luister naar de druppels'] },
    { title: 'De bel is te vroeg', choices: ['Maak een houten klepje', 'Maak een touwtje vast'] },
    { title: 'De klok tikt weer goed', choices: ['Speel een ochtendliedje', 'Maak een wachtbankje'] },
  ],
  library: [
    { title: 'Een huisje in de modder', choices: ['Leg takken neer', 'Leg lege boekkaften neer'] },
    { title: 'Een piepje in een boek', choices: ['Volg het piepje', 'Volg het rode lint'] },
    { title: 'De muis en de reus', choices: ['Teken een huis', 'Vouw een brug'] },
    { title: 'Vier vieze voeten', choices: ['Dans in de regenton', 'Maak zeepbellen'] },
    { title: 'Een plek voor de boeken', choices: ['Breng boeken rond', 'Maak hier een leeshoek'] },
  ],
  balloon: [
    { title: 'De wind is weg', choices: ['Luister in het gras', 'Hang linten op'] },
    { title: 'Een klein zuchtje', choices: ['Blaas door de fluitketel', 'Draai het molentje'] },
    { title: 'Poef durft niet', choices: ['Maak een nest van de sjaal', 'Vraag wat Poef wil'] },
    { title: 'Een mandje gaat vliegen', choices: ['Vlieg boven de bomen', 'Volg de windharpjes'] },
    { title: 'Het eerste mandje vertrekt', choices: ['Breng broodjes naar de lezers', 'Breng zaadjes naar de tuin'] },
  ],
  forest: [
    { title: 'Het bos is grijs', choices: ['Volg het vogellied', 'Ruik aan de aardbeien'] },
    { title: 'Daar is het eerste rood!', choices: ['Kijk in de plas', 'Volg de zon naar de bloem'] },
    { title: 'Waar is het groen?', choices: ['Dans met de bladeren', 'Klap naar de bomen'] },
    { title: 'Een zilveren bloem', choices: ['Leg stenen in een kring', 'Zing een lied voor de bloem'] },
    { title: 'De kleuren zijn terug', choices: ['Maak een kijk- en luisterpad', 'Vul het kleurenboek'] },
  ],
  snow: [
    { title: 'Een stil sneeuwfeest', choices: ['Bouw een podium van sneeuw', 'Zwaai met vlaggen'] },
    { title: 'Puk zoekt de maat', choices: ['Luister naar de slee', 'Tik met de lepels'] },
    { title: 'De sneeuwpop doet mee', choices: ['Hang belletjes aan zijn armen', 'Laat hem de maat aangeven'] },
    { title: 'Een heel klein bezoek', choices: ['Maak een zitplek op de kist', 'Speel muziek bij het muisje'] },
    { title: 'Het sneeuwfeest begint', choices: ['Loop langs de lichtjes', 'Laat elk geluid horen'] },
  ],
  stars: [
    { title: 'Sterren aan de waslijn', choices: ['Borstel het pluis weg', 'Doe de sterren in bad'] },
    { title: 'Het licht is weg', choices: ['Volg het draadje', 'Luister naar het tingelen'] },
    { title: 'De wolk vol glitters', choices: ['Kam het wolkenpluis', 'Zing een wiegeliedje'] },
    { title: 'Al die lichtjes!', choices: ['Leg dezelfde vormen bij elkaar', 'Laat de sterren om de beurt knipperen'] },
    { title: 'De sterren gaan naar huis', choices: ['Maak een sterrenoptocht', 'Breng de kleinste ster thuis'] },
  ],
} satisfies Record<StoryId, readonly ChapterLabels[]>;
