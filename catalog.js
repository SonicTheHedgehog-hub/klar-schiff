// Klar Schiff – Aufgabenkatalog. Je Aufgabe: [Name, alle N Tage, Minuten, Putztipp, Teil der Startauswahl (1/0)]
export const TYPES = {
  kitchen:{label:'Küche', tasks:[
    ['Spülmaschine ausräumen',1,10,'Erst unten ausräumen, dann oben: So tropft kein Restwasser aus den Tassen auf trockenes Geschirr.',1],
    ['Arbeitsflächen abwischen',1,5,'Ein Spritzer Spüli in warmem Wasser reicht. Mit einem trockenen Tuch nachwischen, dann bleiben keine Schlieren.',1],
    ['Müll rausbringen',2,5,'Eine Lage Zeitungspapier unten im Eimer saugt Flüssigkeit auf und hält den Eimer sauber.',1],
    ['Herd reinigen',7,10,'Eingebranntes auf dem Ceranfeld mit Backpulver-Paste 15 Minuten einweichen und dann mit dem Glasschaber abheben.',1],
    ['Boden wischen',7,15,'Erst saugen, dann wischen. Vom hintersten Eck Richtung Tür arbeiten, damit du nicht über nasse Stellen läufst.',1],
    ['Spüle & Armatur entkalken',7,5,'Ein Tuch in Essigwasser (1:1) um den Wasserhahn wickeln und 20 Minuten einwirken lassen.',0],
    ['Mikrowelle reinigen',14,5,'Schale Wasser mit Zitronenscheiben 3 Minuten erhitzen. Der Dampf löst die Spritzer, danach einfach auswischen.',0],
    ['Fronten & Griffe abwischen',14,10,'Griffe sind die Stellen, die am häufigsten angefasst werden. Ein feuchtes Mikrofasertuch reicht meistens.',0],
    ['Kühlschrank auswischen & aussortieren',30,20,'Am besten vor dem Großeinkauf, dann ist er fast leer. Natron-Wasser neutralisiert Gerüche.',1],
    ['Backofen reinigen',60,30,'Natron mit etwas Wasser zur Paste rühren, über Nacht einwirken lassen, morgens mit Essigwasser abwischen.',0]]},
  bath:{label:'Badezimmer', tasks:[
    ['Waschbecken putzen',3,5,'Zahnpastareste lösen sich am besten mit einem warmen, feuchten Tuch. Armatur zum Schluss trocken polieren.',1],
    ['Toilette reinigen',3,10,'Reiniger zuerst unter den Rand geben und einwirken lassen, während du den Rest des Bads machst.',1],
    ['Dusche putzen',7,15,'Nach jedem Duschen kurz abziehen spart die Hälfte der Putzarbeit. Kalk mit Zitronensäure lösen.',1],
    ['Spiegel putzen',7,5,'Mit einem fast trockenen Mikrofasertuch in Z-Bewegungen wischen. Kein Küchenpapier, das fusselt.',1],
    ['Handtücher wechseln',7,5,'Handtücher bei 60 °C waschen und ohne Weichspüler, dann saugen sie besser.',1],
    ['Boden wischen',7,10,'Haare vorher mit einem leicht feuchten Tuch einsammeln, der Staubsauger verteilt sie sonst nur.',0],
    ['Abfluss reinigen',30,10,'2 EL Natron und eine Tasse Essig in den Abfluss, 15 Minuten warten, mit heißem Wasser nachspülen.',0],
    ['Fugen schrubben',60,30,'Alte Zahnbürste und Paste aus Natron und Wasser. Bei Schimmel lieber zu einem Chlorreiniger greifen und lüften.',0]]},
  bed:{label:'Schlafzimmer', tasks:[
    ['Staubsaugen',7,10,'Unters Bett mit der Fugendüse. Dort sammelt sich der meiste Staub.',1],
    ['Bettwäsche wechseln',14,15,'Bettwäsche bei 60 °C waschen, um Milben zu entfernen. Die Matratze in der Zeit ohne Bezug lüften lassen.',1],
    ['Staub wischen',14,10,'Von oben nach unten arbeiten: erst Schrank und Regale, dann Nachttische, zum Schluss den Boden.',1],
    ['Kleiderschrank aufräumen',60,30,'Alles, was du seit einem Jahr nicht getragen hast, in eine Spendentüte.',0],
    ['Matratze wenden & lüften',90,10,'Kopf- und Fußende tauschen und einmal umdrehen, so liegt sie sich gleichmäßiger.',1],
    ['Fenster putzen',90,20,'Nicht in der prallen Sonne putzen, sonst trocknet das Wasser zu schnell und hinterlässt Streifen.',0]]},
  living:{label:'Wohnzimmer', tasks:[
    ['Aufräumen',2,10,'10-Minuten-Regel: Wecker stellen und in der Zeit so viel wie möglich an seinen Platz bringen.',1],
    ['Pflanzen gießen',4,5,'Fingerprobe: Erst gießen, wenn die oberen 2 cm Erde trocken sind.',1],
    ['Staubsaugen',7,15,'Erst Kissen und Kleinkram vom Boden räumen, dann geht es doppelt so schnell.',1],
    ['Staub wischen',7,10,'Leicht feuchtes Mikrofasertuch nehmen. Trocken wischen wirbelt den Staub nur auf.',1],
    ['Boden wischen',14,15,'Bei Holzböden nur nebelfeucht wischen, stehendes Wasser lässt das Holz aufquellen.',0],
    ['Sofa absaugen',30,15,'Polsterdüse benutzen und die Ritzen nicht vergessen. Kissen dabei ausklopfen.',0],
    ['Kissenbezüge & Decken waschen',30,10,'Decken nach dem Waschen draußen trocknen lassen, dann riechen sie frischer.',0],
    ['Fenster putzen',90,25,'Ein Spritzer Spüli und ein Schuss Essig im Wasser, dann mit dem Abzieher von oben nach unten.',0]]},
  office:{label:'Arbeitszimmer', tasks:[
    ['Schreibtisch aufräumen',7,10,'Am Freitag zum Feierabend aufräumen, dann startet die neue Woche ohne Chaos.',1],
    ['Staubsaugen',7,10,'Kabelsalat vorher hochlegen, damit der Sauger nichts einzieht.',1],
    ['Bildschirm & Tastatur reinigen',14,5,'Bildschirm nur mit trockenem Mikrofasertuch. Krümel in der Tastatur: umdrehen und sanft ausklopfen.',1],
    ['Staub wischen',14,10,'Hinter dem Monitor und auf dem Rechner sammelt sich viel Staub, der die Lüfter belastet.',0],
    ['Papierkram sortieren',30,20,'Drei Stapel: erledigen, ablegen, wegwerfen. Alles erst einmal anfassen und sofort entscheiden.',1],
    ['Fenster putzen',90,15,'Rahmen und Dichtungen vor dem Glas putzen, sonst tropft der Schmutz auf die saubere Scheibe.',0]]},
  hall:{label:'Flur', tasks:[
    ['Schuhe wegräumen',3,5,'Feste Regel: Pro Person stehen höchstens zwei Paar Schuhe draußen.',1],
    ['Staubsaugen',7,5,'Der Flur ist der Schmutzfang der Wohnung. Lieber öfter kurz saugen als selten gründlich.',1],
    ['Boden wischen',7,10,'Streusalz-Ränder im Winter mit einem Schuss Essig im Wischwasser lösen.',1],
    ['Fußmatte ausklopfen',14,5,'Draußen kräftig ausklopfen und einmal umgedreht absaugen.',0],
    ['Türgriffe & Lichtschalter abwischen',14,5,'Die meistgenutzten Stellen der Wohnung. Ein Tuch mit etwas Spüli reicht völlig.',1],
    ['Garderobe sortieren',30,10,'Jacken der falschen Saison in den Schrank, dann wird die Garderobe sofort luftiger.',0]]},
  balcony:{label:'Balkon', tasks:[
    ['Pflanzen gießen',2,5,'Im Sommer morgens oder abends gießen, mittags verdunstet das meiste Wasser sofort.',1],
    ['Boden fegen',14,10,'Laub und Blüten früh entfernen, bevor sie Flecken auf dem Boden hinterlassen.',1],
    ['Balkonmöbel abwischen',30,10,'Mit Schmierseifen-Wasser abwaschen. Holzmöbel einmal im Jahr ölen.',1],
    ['Geländer & Glas reinigen',60,15,'Bei Glasbrüstungen gilt dasselbe wie bei Fenstern: Abzieher und nicht in der Sonne.',0],
    ['Balkonkästen pflegen',90,30,'Verblühtes abzupfen und im Frühjahr frische Erde einfüllen.',0]]},
  other:{label:'Sonstiges', tasks:[
    ['Aufräumen',3,10,'Alles, was nicht hierhergehört, in einen Korb und auf dem Rückweg verteilen.',1],
    ['Staubsaugen',7,10,'Den Staubsaugerbeutel wechseln, wenn er zu drei Vierteln voll ist, dann saugt er deutlich besser.',1],
    ['Staub wischen',14,10,'Ein Paar alte Socken über die Hand ziehen: ideal für Lamellen und schmale Ecken.',1],
    ['Fenster putzen',90,20,'Bewölktes Wetter ist ideal zum Fensterputzen, dann trocknet nichts zu schnell an.',0]]}
};
export const USER_ROOMS = [['Küche','kitchen'],['Badezimmer','bath'],['Schlafzimmer','bed'],['Wohnzimmer','living'],['Arbeitszimmer','office'],['Flur','hall'],['Balkon','balcony']];
export const FREQS = [[1,'täglich'],[2,'alle 2 Tage'],[3,'alle 3 Tage'],[4,'alle 4 Tage'],[7,'wöchentlich'],[14,'alle 2 Wochen'],[30,'monatlich'],[60,'alle 2 Monate'],[90,'vierteljährlich'],[180,'halbjährlich']];
export const MODES = {fair:'Fair nach Punkten',rotate:'Abwechselnd',fixed:'Fest zugeteilt',open:'Offen zum Aussuchen'};
export const MODE_HELP = {fair:'Die App gibt die Aufgabe der Person, die gerade weniger Punkte gesammelt hat.',rotate:'Wer es zuletzt gemacht hat, ist beim nächsten Mal nicht dran.',fixed:'Immer dieselbe Person.',open:'Niemand ist zugeteilt. Wer zuerst „Ich mach’s“ tippt, übernimmt sie.'};
