// All Czech text of the app: UI strings, chapters, glossary, model simplifications.
// Numbers quoted here come from src/spec.js / src/kin (see comments); the app also computes some of them live.

export const ui = {
  appTitle: 'Motor a převodovka',
  tabs: { chapters: 'Kapitoly', glossary: 'Slovník', simplifications: 'Zjednodušení' },
  notice: 'Všimněte si',
  replay: 'Přehrát znovu',
  prev: 'Předchozí', next: 'Další',
  toolbar: {
    housing: 'Skříně', ghost: 'Průhledné', cut: 'Řez', solid: 'Plné', hidden: 'Skryté',
    show: 'Zobrazit', engine: 'Motor', clutch: 'Spojka', gearbox: 'Převodovka',
    overlays: 'Vrstvy', gas: 'Plyn', flow: 'Tok výkonu', labels: 'Popisky',
    view: 'Pohled', viewOverview: 'Celek', viewEngine: 'Motor', viewClutch: 'Spojka', viewGearbox: 'Převodovka',
  },
  dock: {
    pause: 'Pozastavit', play: 'Spustit', speed: 'Zpomalení', modeRot: 'jen otáčení', modeTime: 'celý čas',
    modeTip: 'Jen otáčení: hřídele se kreslí pomaleji, ale pedály, startér a řazení reagují hned. Celý čas: zpomalí se úplně všechno, i ovládání.',
    engineLbl: 'Motor',
    engine: { run: 'Motor běží', coast: 'Motor dobíhá', off: 'Motor stojí', starting: 'Startuji…' },
    realRpm: 'Skutečně', shownRpm: 'zobrazeno',
    crankAngle: 'Úhel kliky',
    throttle: 'Plyn', clutch: 'Spojka', brake: 'Brzda',
    start: 'Nastartovat', stop: 'Vypnout motor',
    assist: 'Asistent spojky', driver: 'Asistent',
    assistTip: 'Zapnuto: při volbě stupně pedál spojky obsluhuje řidič (automat). Vypnuto: páka jde přímo do převodovky a spojku musíte sešlápnout sami.',
    gear: 'Stupeň', speedKmh: 'Rychlost', rpmCrank: 'Klikový hřídel', rpmInput: 'Vstupní hřídel', rpmCounter: 'Předlohový hř. (− = opačně)',
    rpmMain: 'Výstupní hřídel', clutchState: 'Spojka', torque: 'Moment spojky', syncPhase: 'Synchronizér', syncShort: 'Synchr.',
    engaged: 'sepnutá', slipping: 'prokluzuje', released: 'rozepnutá',
    neutral: 'N', ratio: 'převod',
    negHint: 'Záporné otáčky = opačný směr otáčení než klikový hřídel.',
  },
  driverStages: { slip: 'nechává spojku prokluzovat (nízké otáčky)', declutch: 'sešlapuje spojku', 'wait-stop': 'čeká na zastavení vstupního hřídele', shift: 'řadí', release: 'pouští spojku', hold: 'drží spojku', start: 'startuje' },
  timeBadge: n => `Čas zpomalen ${n}× – pedály, startér a řazení reagují stejně pomalu`,
  syncPhases: { free: 'volný', blocking: 'blokuje', indexing: 'dorovnává zuby', engaged: 'zařazeno', leaving: 'vyřazuje' },
  toasts: {
    stall: 'Motor zhasl – spojka sepnula při stojícím voze',
    grindClutch: 'Synchron blokuje: bez vyšlápnuté spojky se otáčky nesrovnají',
    grindReverse: 'Zpátečka není synchronizovaná – zastavte a počkejte, až se hřídele dotočí',
    start: 'Motor nastartoval',
    startInGear: 'Startér táhne celé auto – sešlápněte spojku nebo vyřaďte',
    engaged: g => `Zařazeno: ${g === 'N' ? 'neutrál' : g === 'R' ? 'zpátečka' : g + '. stupeň'}`,
  },
  stallBanner: 'Motor zhasl', engineOff: 'Motor vypnut',
  partCardClose: 'Zavřít',
  glossSearch: 'Hledat součást…',
  clickHint: 'Kliknutím na součást zobrazíte její popis.',
  loading: 'Sestavuji model…',
  loadingMsg: 'Generuji ozubení, hřídele a skříně', loadingMsgDots: 'Generuji ozubení, hřídele a skříně…',
  simMissing: 'Simulátor (src/sim) není k dispozici.', errorPrefix: 'Chyba: ',
  docTitle: 'Motor a převodovka – interaktivní 3D model',
  docDescription: 'Interaktivní 3D vysvětlení čtyřdobého motoru, spojky a manuální převodovky.',
  panelSubtitle: '4T · 1998 cm³ · 5+R',
  chapterKicker: 'Kapitola ',
  simplHeading: 'Zjednodušení modelu',
  simplIntro: 'Model je mechanicky věrný v kinematice (úhly, zdvihy, převody, pořadí), ale několik věcí je záměrně zjednodušeno nebo odhadnuto:',
  partBody: ' · těleso ', noDescription: 'Pro tuto součást zatím není popis.',
  clutchKey: 'mezerník', rpm: 'ot/min', gapMark: 'mezera ',
  clutchLink: { engine: 'motor', shaft: 'lamela + vstupní hřídel', locked: 'SPOJENO · tření drží', slip: 'PROKLUZUJE', open: 'ROZPOJENO · mezera' },
  langSwitch: 'Jazyk', langCs: 'Čeština', langEn: 'English', panelToggle: 'Panel',
  diag: {
    strokes: { intake: 'Sání', compression: 'Komprese', power: 'Expanze', exhaust: 'Výfuk', combustion: 'Hoření' },
    pvCaption: 'Diagram p–V válce 1 (tlak v barech, objem v cm³)', pvAxisV: 'objem V (cm³)',
    pvInfo: (stroke, psi, p, V) => `${stroke} · úhel cyklu ${psi}° · p = ${p} bar · V = ${V} cm³`,
    pistonCaption: 'Dráha a rychlost pístu podle úhlu kliky (0° = horní úvrať)',
    pistonTravel: 'dráha pístu (0–86 mm)', pistonSine: 'sinus', pistonSpeed: 'rychlost (střed = 0)',
    vMax: a => `v max ≈ ${a}°`,
    pistonInfo: (a, x) => `úhel ${a}° · poloha ${x} mm pod HÚ`,
    curveCaption: 'Pedál → vypínací ložisko → přítlačný kotouč → kapacita spojky', pedalTravel: 'dráha pedálu',
    capacity: 'kapacita', plateLift: 'zdvih kotouče', bearingTravelDashed: 'dráha ložiska (čárkovaně)',
    curveInfo: (b, l, c, n) => `ložisko ${b} mm · kotouč ${l} mm · kapacita ${c} % (${n} N·m)`,
    live: { pedal: 'Pedál', brg: 'Dráha ložiska', lift: 'Zdvih přítl. kotouče', gap: 'Mezera na stranu', cap: 'Kapacita (moment)', slip: 'Prokluz (motor − vstup)', state: 'Stav spojky' },
    directDrive: 'přímý záběr', thGear: 'Stupeň', thTeeth: 'zuby předl./vstup · výstup/předl.', thRatio: 'Převod',
    ratioInfo: 'Převod = otáčky vstupu / otáčky výstupu. Záporný = opačný směr otáčení.', ratioCaption: 'Převodové poměry',
    shaft: { in: 'Vstupní hřídel (34 z)', counter: 'Předlohový hřídel', g1: 'Volné kolo 1. (57 z)', g2: 'Volné kolo 2. (47 z)', g3: 'Volné kolo 3. (39 z)', g5: 'Volné kolo 5. (29 z)', main: 'Výstupní hřídel' },
    thBody: 'Těleso', thRatioEngine: 'poměr k motoru', shaftCaption: 'Živé otáčky hřídelů a volných kol',
    reverseCaption: 'Mezikolo zpátečky', reverseLeft: 'zpátečka', reverseRight: '5. stupeň',
    reverseInfo: (x, a, b) => `poloha tyče ${x} mm (zpátečka −9,5 mm) · vstupní hřídel ${a} ot/min · výstupní ${b} ot/min`,
    reverseStopped: 'hřídele stojí – mezikolo smí zabrat', reverseTurning: 'hřídele se točí – zuby by narážely (skřípění)',
    chain: { crank: 'Klikový hřídel + setrvačník', disc: 'Lamela spojky', input: 'Vstupní hřídel (34 z)', counter: 'Předlohový hřídel (46 z …)', freeGear: 'Volné kolo + objímka', output: 'Výstupní hřídel' },
    chainCaption: 'Cesta výkonu (svítí, co přenáší moment)',
    gearNames: { g1: '1. stupeň', g2: '2. stupeň', g3: '3. stupeň', input: '4. stupeň', g5: '5. stupeň' },
    syncCaption: 'Poloha objímky při řazení (mm zdvihu od neutrálu)',
    syncMarks: { cone: 'kužel', blocking: 'blokace', teeth: 'zuby kola', engaged: 'zařazeno' },
    syncPhase: 'fáze: ', syncIdle: 'klid',
    syncChoice: g => ` · volba: ${g}`, syncPos: x => ` · poloha ${x} mm`,
    syncDiff: (dn, locked) => `rozdíl otáček kola a výstupního hřídele: ${dn} · spojka ${locked ? 'sepnutá' : 'nesepnutá'}`,
    timing1Caption: 'Rozvod válce 1 podle úhlu klikového hřídele (0–720°)', timing4Caption: 'Zdvihy, ventily a jiskra všech válců (0–720°)',
    thCyl: 'Válec', thStroke: 'Zdvih', thCycleAngle: 'Úhel cyklu', thP: 'p (bar)', cylCaption: 'Co dělá který válec právě teď',
  },
};

/* ------------------------------------------------------------------ chapters */

const P = (...paras) => paras.map(p => `<p>${p}</p>`).join('');

// Transverse section through cylinder 1: keeps x >= -16.6 (between the intake valve at x = -17.6 and the exhaust valve at
// x = -15.6 of cylinder 1, so one valve of each kind is cut through its axis). The camera looks rearward (+X): the intake
// side (+Z) is on the right, the exhaust side on the left.
const SECTION_C1 = { normal: [1, 0, 0], constant: 16.6 };
const VIEW_SECTION = (extra = {}) => ({ id: 'rez', label: 'Příčný řez válcem 1', section: SECTION_C1, fit: 400, camera: { position: [-660, 130, -50], target: [0, 130, 0] }, ...extra });

export const chapters = [
  {
    id: 'prehled',
    title: 'Přehled ústrojí',
    html: P(
      'Model ukazuje čtyřdobý řadový čtyřválec o objemu <b>1998 cm³</b> (vrtání × zdvih 86 × 86 mm), suchou jednokotoučovou spojku a pětistupňovou manuální převodovku. Motor je uložen podélně: za klikovým hřídelem následuje setrvačník, spojka, zvon spojky a převodovka.',
      '<b>Cesta výkonu:</b> klikový hřídel → setrvačník → spojka (přítlačný kotouč přitlačí lamelu k setrvačníku) → vstupní hřídel → kolo stálého záběru (34 z) → předlohový hřídel (46 z) → kolo zvoleného stupně → přesuvná objímka synchronizéru → výstupní hřídel. Ve 4. stupni jde výkon ze vstupního hřídele přímo na výstupní a předlohový hřídel se jen volně protáčí.',
      'Model startuje na volnoběh v neutrálu. Tlačítkem „Rozjet v 1. stupni“ rozsvítíte oranžově všechna tělesa, která právě přenášejí točivý moment.',
    ),
    notice: [
      'Setrvačník, víko spojky a přítlačný kotouč se otáčejí s motorem; lamela, vstupní a předlohový hřídel se otáčejí s převodovkou. Lamela <b>není</b> přišroubovaná k setrvačníku – drží ji jen tření.',
      'Vačkové hřídele se otáčejí <b>poloviční rychlostí</b> než klikový hřídel.',
      'Pohled otáčíte myší (levé tlačítko), zoom kolečkem, posun pravým tlačítkem. Kliknutím na součást zobrazíte její popis.',
      'Zpomaleno je jen otáčení hřídelů (skutečné otáčky motoru vidíte vedle volby zpomalení) – pedály, startér a řazení reagují hned. Tlačítkem „Vypnout motor“ motor zastavíte, „Nastartovat“ ho zase spustí.',
    ],
    camera: { position: [380, 330, 1290], target: [385, 105, 0] }, flow: true,
    focus: null, housing: 'ghost', slow: 1 / 20,
    labels: [{ id: 'crankshaft', a: 'b', dx: 0, dy: 60 }, { id: 'flywheel', a: 't', dx: 0, dy: -70 }, { id: 'inputShaft', a: 't', dx: 10, dy: -110 }, { id: 'counterShaft', a: 'b', dx: 0, dy: 60 }, { id: 'mainShaft', a: 't', dx: 40, dy: -70 }],
    diagram: 'chain',
    actions: [{ label: 'Rozjet v 1. stupni', run: a => { a.setInputs({ throttle: 0.3 }); a.requestGear('1'); } }],
    setup(a) { a.reset(); },
  },
  {
    id: 'klika',
    title: 'Klikový mechanismus',
    html: P(
      'Píst se pohybuje přímočaře, klikový hřídel rotuje; spojuje je <b>ojnice</b>. Ojnice je tuhá (138 mm mezi osami): malé oko jde s pístem, velké oko obíhá po kružnici o poloměru 43 mm. <b>Zdvih pístu = 2 × poloměr kliky = 86 mm.</b>',
      'Pohyb pístu <b>není sinusový</b>. Ojnice se při otáčení vyklání (až o 18,2°), takže píst je 90° za horní úvratí (HÚ) už 49,9 mm pod ní – tedy 58 % zdvihu – a největší rychlost má asi <b>74° po HÚ</b>, ne při 90°. Graf níže srovnává skutečnou dráhu pístu se sinusem.',
      'Čepy klikového hřídele leží v jedné rovině: <b>písty 1 a 4 jedou stále společně, písty 2 a 3 opačně</b>. Protizávaží na ramenech vyvažují odstředivou sílu čepů a velkých ok ojnic; nevyvážené zůstávají setrvačné síly 2. řádu.',
    ),
    notice: [
      'Písty 1 a 4 jsou vždy ve stejné poloze, písty 2 a 3 v opačné.',
      'Ojnice se během otáčky vyklání doprava i doleva; největší sklon je při 90° a 270° od HÚ.',
      'Píst stráví více času v dolní polovině zdvihu než v horní – horní polovinu urazí za necelých 90° otáčení kliky.',
      'Klikový hřídel je uložen v pěti hlavních ložiskách v bloku (blok je v řezu).',
    ],
    camera: { position: [-330, 230, 620], target: [130, 95, 0] },
    focus: ['crank', 'piston', 'rod'], housing: 'cut', slow: 1 / 20,
    labels: [{ id: 'piston1', a: 't', dx: -50, dy: -40 }, { id: 'rod1', dx: -60, dy: 10 }, { id: 'crankshaft', a: 'b', dx: 0, dy: 50 }],
    diagram: 'piston',
    setup(a) { a.reset(); },
  },
  {
    id: 'ctyri-doby',
    title: 'Čtyři doby',
    html: P(
      'Jeden pracovní cyklus válce trvá <b>720° (dvě otáčky klikového hřídele)</b> a tvoří ho čtyři zdvihy po 180°. Práci koná jen jeden z nich. Pohled je <b>příčný řez válcem 1</b>: vpravo je <b>sací strana</b> (sací potrubí), vlevo <b>výfuková</b>; vidíte svíčku, jeden sací a jeden výfukový ventil s kanály, píst, ojnici a čep kliky.',
      '<b>1. Sání:</b> sací ventil je otevřený, píst jde dolů a <b>modré částice čerstvé směsi</b> proudí sacím kanálem kolem otevřeného ventilu do válce; s každým milimetrem zdvihu jich přibývá. <b>2. Komprese:</b> ventily jsou zavřené, píst stlačuje náplň z 549,6 cm³ na 50,05 cm³ (<b>kompresní poměr 11 : 1</b>) – mrak částic houstne a modrá přechází do fialové.',
      '<b>3. Expanze:</b> svíčka zapálí směs <b>před horní úvratí</b> (předstih 10° při volnoběhu až 30° při plném zatížení): zablesk u svíčky a od ní se šíří <b>čelo plamene</b> (žluté) a za ním hoří oranžová náplň. Tlak tlačí píst dolů a částice tmavnou do rudé. <b>4. Výfuk:</b> výfukový ventil se otevírá ještě před dolní úvratí – nejdřív rychlý <b>výdech pod tlakem</b> (blow-down), pak píst vytlačuje <b>světle hnědé spaliny</b> výfukovým kanálem doleva. Kolem horní úvratě jsou chvíli otevřené oba ventily (<b>překrytí</b>).',
    ),
    notice: [
      'Zkuste ručně posouvat jezdec „Úhel kliky“ (sání ≈ 360–540°, komprese 540–720°, expanze 0–180°, výfuk 180–360°) a sledujte, kdy se částice objevují, houstnou, hoří a odcházejí.',
      'Zážeh nastává <b>před</b> HÚ (úhel ≈ 710°): jiskra u svíčky a první žlutá jádra plamene vznikají ještě při stoupání pístu.',
      'Plocha uvnitř smyčky v p–V diagramu je práce jednoho cyklu (zmenšená o malou čerpací smyčku sání a výfuku).',
      'Částice jsou ilustrace: plyn a tlak jsou idealizovaný model, ventily a píst se pohybují přesně podle geometrie. Tlačítkem „Plyn“ je lze skrýt.',
    ],
    legend: [['#58b4ff', 'čerstvá směs (sání)'], ['#9a7bff', 'stlačená směs (komprese)'], ['#ffe45e', 'čelo plamene / jiskra'], ['#ff7a1a', 'hořící a spálená náplň'], ['#7a2b12', 'expanze – chladnoucí plyn'], ['#cdb38b', 'spaliny (výfuk)']],
    camera: { position: [100, 250, 740], target: [45, 170, 0] },
    focus: ['piston1', 'rod1', 'crankshaft', 'valveIn1', 'valveEx1', 'springIn1', 'springEx1', 'gas1', 'spark1', 'sparkPlug1', 'cam', 'ignBoot1', 'ignLead1', 'ignFlash1'], housing: 'ghost', slow: 1 / 60,
    views: [
      VIEW_SECTION(),
      { id: 'podelny', label: 'Podélný pohled', housing: 'cut', camera: { position: [100, 250, 740], target: [45, 170, 0] } },
    ],
    labels: [{ id: 'valveIn1a', a: 't', dx: 70, dy: -30 }, { id: 'valveEx1a', a: 't', dx: -70, dy: -30 }, { id: 'sparkPlug1', a: 't', dx: 0, dy: -70 }, { id: 'piston1', dx: -80, dy: 20 }, { id: 'intakeManifold', dx: 60, dy: -20 }, { id: 'exhaustManifold', dx: -60, dy: -20 }],
    diagram: 'pv',
    setup(a) { a.reset(); },
  },
  {
    id: 'rozvod',
    title: 'Rozvod',
    html: P(
      'Ventily řídí <b>dvě vačkové hřídele</b> (DOHC, 16 ventilů: dva sací a dva výfukové na válec). Zubatý řemen je pohání od klikového hřídele s převodem <b>18 : 36 zubů</b>, takže se <b>vačky otáčejí poloviční rychlostí</b> – jedna otáčka vačky připadá na celý 720° cyklus.',
      'Vačka tlačí přímo na <b>hrníčkové zdvihátko</b> s plochým dnem, proto ventil sleduje zdvih vačky: <b>8,56 mm</b> u sací, <b>8,31 mm</b> u výfukové vačky (ventil se zvedne o tu hodnotu zmenšenou o vůli). Zavírá ho pružina. Mezi základní kružnicí vačky a zdvihátkem je za studena <b>vůle ventilu 0,2 mm</b>, aby ventil dosedl i po tepelné roztažnosti.',
      'Časování: sací ventil se otevírá <b>10° před HÚ</b> a zavírá <b>58° za DÚ</b>; výfukový se otevírá <b>58° před DÚ</b> a zavírá <b>10° za HÚ</b> (oba jsou otevřeny 248°). Kolem HÚ mezi výfukem a sáním jsou chvíli otevřené oba – <b>překrytí (střih) ventilů 20°</b>.',
      'Když se rozvodový řemen přetrhne, vačky se zastaví a klikový hřídel se ještě chvíli točí. U <b>interferenčních motorů</b> pak píst narazí do otevřeného ventilu a ohne ho.',
      'Tlačítkem „Příčný řez válcem 1“ uvidíte ventily i s kanály v hlavě zepředu; „Podélný pohled“ je celá hlava s řemenem.',
    ),
    notice: [
      'Řemenice vačky má dvojnásobek zubů řemenice kliky (36 : 18) – proto poloviční otáčky.',
      'Sací ventily jsou větší než výfukové – lepší plnění válce.',
      'Ventil se začne zvedat, až když vačka vybere vůli 0,2 mm; skutečný zdvih ventilu je proto o vůli menší než zdvih vačky.',
      'Laloky vaček jsou na hřídeli natočené podle pořadí zapalování; vačky se otáčejí stejným směrem jako klikový hřídel (jeden zubatý řemen obepíná všechny řemenice).',
    ],
    camera: { position: [150, 420, 640], target: [140, 270, 0] },
    focus: ['cam', 'valve', 'crank', 'belt', 'head', 'sparkPlug', 'ign'], housing: 'ghost', slow: 1 / 60,
    views: [
      { id: 'podelny', label: 'Podélný pohled', camera: { position: [150, 420, 640], target: [140, 270, 0] } },
      VIEW_SECTION({ housing: 'ghost', fit: 330, camera: { position: [-540, 250, -40], target: [0, 250, 0] } }),
    ],
    labels: [{ id: 'camIn', a: 't', dx: 0, dy: -50 }, { id: 'camEx', a: 'b', dx: 90, dy: -30 }, { id: 'crankSprocket', a: 'b', dx: 30, dy: 40 }, { id: 'belt', dx: -30, dy: 0 }],
    diagram: 'timing1',
    setup(a) { a.reset(); },
  },
  {
    id: 'poradi',
    title: 'Pořadí zapalování 1–3–4–2',
    html: P(
      'Pracovní zdvihy čtyř válců se střídají v pořadí <b>1 – 3 – 4 – 2</b>. Cyklus trvá 720° a válce jsou čtyři, takže zážeh nastává <b>každých 180°</b> a pracovní zdvihy na sebe navazují bez mezer – chod je rovnoměrnější než u jednoválce.',
      'Písty 1 a 4 (stejně jako 2 a 3) jdou společně, ale <b>nikdy nejsou ve stejném zdvihu</b>: když válec 1 zapaluje v HÚ, válec 4 končí výfuk a začíná sání (otevřené jsou oba jeho ventily – překrytí). Střídání nesousedních válců rozkládá zatížení po délce klikového hřídele a vyrovnává plnění válců ze společného sacího potrubí.',
      'Zážeh válce 1 je v 0°, válce 3 ve 180°, válce 4 ve 360° a válce 2 v 540° úhlu klikového hřídele.',
      '<b>Kdo rozhoduje, která svíčka dostane jiskru:</b> <b>rozdělovač</b> na zadním konci sací vačkové hřídele. Jeho <b>palec</b> se otáčí s vačkou, tedy poloviční rychlostí klikového hřídele – jednu otáčku za celý cyklus 720°. Zapalovací cívka pošle vysoké napětí středním kabelem na střed víka, palec ho přivede k jednomu ze čtyř kontaktů a jiskra přeskočí malou mezeru (0,8 mm) na kontakt, odkud jde kabelem ke svíčce. Kontakty jsou po obvodu víka po 90° v pořadí <b>1 – 3 – 4 – 2</b> ve směru otáčení.',
      'Předstih zážehu (10–30° před HÚ) mění okamžik jiskry o 5–15° otáčení palce; proto má palec široký hrot, který kontakt překrývá v celém rozsahu.',
    ),
    notice: [
      'Svislá čára v diagramu je okamžitý úhel klikového hřídele (0–720°).',
      'Barevné pásy jsou zdvihy každého válce; tenké pruhy pod nimi jsou doby otevření sacího (modře) a výfukového (oranžově) ventilu.',
      'Žlutá značka je jiskra svíčky – předchází začátek pracovního zdvihu.',
      'Válec 1 je vpředu, u rozvodového řemenu; válec 4 je u setrvačníku.',
      'Přepněte skříně: při „Skryté“, „Průhledné“ a „Řez“ je víko rozdělovače průhledné a je vidět palec; při „Plné“ je víko neprůhledné.',
      'Záblesk u svíčky, na kabelu a mezi palcem a kontaktem patří vždy stejnému válci. Jiskra je vidět i bez vrstvy „Plyn“.',
    ],
    legend: [['#fff4b0', 'jiskra: palec → kontakt víka → kabel → svíčka'], ['#d62828', 'vysokonapěťové kabely']],
    camera: { position: [150, 200, 760], target: [150, 120, 0] },
    focus: ['crank', 'piston', 'rod', 'gas', 'spark', 'sparkPlug', 'ign'], housing: 'cut', slow: 1 / 60,
    views: [
      { id: 'pisty', label: 'Písty a zdvihy', camera: { position: [150, 200, 760], target: [150, 120, 0] } },
      { id: 'zapalovani', label: 'Rozdělovač a svíčky', housing: 'hidden', camera: { position: [700, 600, 450], target: [350, 330, 30] },
        labels: [{ id: 'ignCap', a: 't', dx: 40, dy: -60 }, { id: 'ignRotor', a: 'b', dx: 0, dy: 60 }, { id: 'ignCoil', a: 't', dx: 0, dy: -60 }, { id: 'sparkPlug1', a: 't', dx: -40, dy: -60 }] },
    ],
    labels: [{ id: 'piston1', a: 'b', dx: 0, dy: 45 }, { id: 'piston2', a: 'b', dx: 0, dy: 45 }, { id: 'piston3', a: 'b', dx: 0, dy: 45 }, { id: 'piston4', a: 'b', dx: 0, dy: 45 }],
    diagram: 'timing4',
    setup(a) { a.reset(); },
  },
  {
    id: 'spojka',
    title: 'Setrvačník a spojka',
    html: P(
      '<b>Kudy jde síla:</b> žlutá čárkovaná stopa ukazuje cestu točivého momentu. Z klikového hřídele jde do setrvačníku a dvěma větvemi na <b>dvě třecí plochy</b>: přímo z čela setrvačníku a oklikou přes víko spojky a přítlačný kotouč. Přes tření přejde do obložení lamely, tlumicími pružinami do náboje a drážkováním na vstupní hřídel. <b>Jiné spojení mezi motorem a převodovkou není</b> – přední čep vstupního hřídele se v klikovém hřídeli jen volně otáčí v pilotním ložisku.',
      'Sešlápnutím pedálu se obě třecí plochy rozestoupí (v obrázku tmavá mezera, zvětšená, aby byla vidět – skutečně 0,9 mm) a stopa na nich končí: motor běží dál, lamela se vstupním hřídelem doběhne a zastaví se.',
      '<b>Setrvačník</b> je přišroubovaný na zadní přírubu klikového hřídele a má na obvodu ozubený věnec pro startér (132 zubů). K setrvačníku je šesti šrouby připevněno <b>víko spojky</b> s <b>přítlačným kotoučem</b> a <b>talířovou pružinou</b> – to vše se otáčí s motorem (<b style="color:#ff9a2a">oranžově</b>).',
      'Mezi setrvačníkem a přítlačným kotoučem je <b>lamela</b>, drážkovaná na vstupním hřídeli převodovky (21 drážek) – patří převodovce (<b style="color:#4fa8ff">modře</b>). Pružina ji přitlačuje třením k setrvačníku. Lamela má torzní pružiny (6 ks), které tlumí rázy (v simulaci jen nakresleny).',
      '<b>Sešlápnutím pedálu</b> vidlice posune vypínací ložisko o 9,8 mm (včetně 1,5 mm vůle) směrem k motoru. Ložisko tlačí na konce jazýčků talířové pružiny, ta se překlápí kolem opěrného kroužku a její vnější okraj se pohne <b>opačně</b> – přítlačný kotouč se odtáhne od lamely jen o <b>1,8 mm</b> (páka ≈ 4,6 : 1). Lamela se tím uvolní: z každé strany vznikne mezera 0,9 mm.',
      'Spojka přenáší moment třením. Během prvních 0,8 mm zdvihu kotouče se povolují pružinky lamely a kapacita klesá ze 100 % na nulu – spojka <b>prokluzuje</b>; právě tak se plynule rozjíždíme.',
      'Pohled <b>„Detail třecích ploch“</b> je řez nad horním okrajem třecího kruhu: při pustěném pedálu jsou plochy stisknuté (0,05 mm), při sešlápnutém se otevřou obě mezery a vidíte, jak se jazýček překlápí na opěrném kroužku.',
    ),
    notice: [
      'Zkuste „Ukázat rozpojení“: zařadí se jednička, auto stojí na brzdě – setrvačník se točí, lamela a vstupní hřídel stojí (štítek ukazuje 0 ot/min, drážkování hřídele a zuby kola stálého záběru se nehýbou). Pak „Pustit brzdu“: spojka chvíli prokluzuje a sepne.',
      'Ložisko se pohybuje k motoru, ale okraj pružiny a přítlačný kotouč se pohybují od motoru.',
      'Prvních asi 15 % dráhy pedálu je jen volnost (1,5 mm u ložiska) – spojka ještě drží celým momentem.',
      'Skříň (víko spojky, zvon) je průhledná; přepnutím na „Řez“ ukážete průřez a můžete se přiblížit tlačítkem „Detail třecích ploch“.',
      'Talířová pružina je v modelu nakreslena jako 18 tuhých jazýčků (zjednodušení).',
    ],
    caps: true,
    clutchLink: true,
    legend: [['#f08a1c', 'strana motoru: setrvačník (oranžový), přítlačný kotouč (tmavě oranžový), víko (světlé), jazýčky pružiny (žluté)'], ['#4fa8ff', 'strana převodovky: lamela, vstupní hřídel'], ['#e6ebf0', 'vypínací mechanismus: ložisko, vidlice'], ['#ffd23f', 'cesta točivého momentu (čárky běží rychlostí otáčení)']],
    camera: { position: [690, 205, 490], target: [415, 40, 0] },
    tint: [['clutchCover', '#ffc56e'], ['pilotBearing', '#e6ebf0'], ['crank', '#f08a1c'], ['pressurePlate', '#c9560c'], ['finger', '#ffe08a'], ['clutchDisc', '#4fa8ff'], ['inputShaft', '#4fa8ff'], ['releaseBearing', '#e6ebf0'], ['releaseFork', '#e6ebf0']],
    focus: ['crank', 'pressurePlate', 'finger', 'clutchDisc', 'release', 'inputShaft', 'bellhousing'], housing: 'cut', slow: 1 / 20,
    views: [
      { id: 'celek', label: 'Celek', camera: { position: [690, 205, 490], target: [415, 40, 0] } },
      // exactly edge-on to the friction faces, centred on the disc and far away (fov 3°), so both 0.9 mm gaps open as see-through slits
      { id: 'detail', label: 'Detail třecích ploch', housing: 'cut', fit: 60, camera: { position: [394, 100, 1400], target: [394, 100, 0], fov: 3 } },
    ],
    labels: [{ id: 'flywheel', a: 'c', dx: -130, dy: -70 }, { id: 'clutchDisc', a: 'b', dx: -70, dy: 70 }, { id: 'releaseBearing', a: 'b', dx: 70, dy: 90 }, { id: 'pilotBearing', a: 't', dx: -90, dy: -90 }],
    diagram: 'clutchLive',
    actions: [
      { label: 'Ukázat rozpojení (1. stupeň, stojí)', run: a => { a.setAssist(true); a.setInputs({ throttle: 0, brake: 1, clutchPedal: 0, ignition: true }); a.requestGear('1'); } },
      { label: 'Pustit brzdu – rozjezd', run: a => a.setInputs({ brake: 0 }) },
      { label: 'Sešlápnout a sledovat lamelu', run: a => {
        a.setAssist(true); a.requestGear('N'); a.setInputs({ throttle: 0, clutchPedal: 1, ignition: true });
        a.setHousing('ghost'); a.flyTo({ position: [900, 160, 330], target: [420, 0, 0] }, 1.2);
      } },
      { label: 'Sešlápnout spojku', run: a => a.setInputs({ clutchPedal: 1 }) },
      { label: 'Pustit spojku', run: a => a.setInputs({ clutchPedal: 0 }) },
    ],
    setup(a) { a.reset(); },
  },
  {
    id: 'prevodovka',
    title: 'Uspořádání převodovky',
    html: P(
      'Převodovka má <b>tři hřídele</b>. <b>Vstupní hřídel</b> je spojený s lamelou a nese kolo stálého záběru (34 z). <b>Předlohový hřídel</b> (pod ním) nese pevně všechna kola; jeho kolo se 46 zuby je stále v záběru se vstupním. <b>Výstupní hřídel</b> leží v ose vstupního a nese volná kola 1., 2., 3. a 5. stupně, otočná na hřídeli, a tři <b>náboje</b> synchronizérů, pevné na hřídeli.',
      'Všechna kola jsou <b>stále v zabírání</b> – nic se do záběru nezasouvá (kromě vloženého kola zpátečky). Stupeň se zvolí tak, že <b>přesuvná objímka</b> spojí zvolené volné kolo s nábojem, tedy s výstupním hřídelem.',
      '<b>V neutrálu se sepnutou spojkou</b> se točí vstupní hřídel, předlohový hřídel (opačným směrem) i všechna volná kola; <b>stojí jen výstupní hřídel</b>. Předlohový hřídel v neutrálu tedy neleží – to je častý omyl.',
    ),
    notice: [
      'Tabulka nad tímto seznamem ukazuje živé otáčky: znaménko mínus = opačný směr otáčení.',
      'Volné kolo 5. stupně se v neutrálu točí rychleji než motor, kolo 1. stupně jen asi na 30 % otáček motoru.',
      'Náboje synchronizérů jsou drážkované na výstupním hřídeli a stojí s ním; po nich kloužou objímky.',
      'Skříň převodovky je průhledná; přepnutím na „Řez“ nebo „Plné“ ji zobrazíte.',
    ],
    camera: { position: [700, 150, 860], target: [695, -30, 0] }, flow: true,
    focus: null, housing: 'ghost', slow: 1 / 20,
    labels: [{ id: 'inputShaft', a: 't', dx: -20, dy: -80 }, { id: 'mainShaft', a: 't', dx: 40, dy: -60 }, { id: 'counterShaft', a: 'b', dx: 0, dy: 70 }, { id: 'sleeve12', a: 't', dx: 0, dy: -90 }],
    diagram: 'shafts',
    setup(a) { a.reset(); },
  },
  {
    id: 'tok-vykonu',
    title: 'Řazení a tok výkonu',
    html: P(
      'Celkový převod je <b>(46 / 34) × (z výstupního kola / z předlohového kola)</b>. Například 1. stupeň: 46/34 × 57/23 = 3,353. V tabulce je každý stupeň s počty zubů; model je podobný převodovce Toyota W58 (3,285 / 1,894 / 1,275 / 1,000 / 0,783) a liší se od ní nejvýše o asi 2 %.',
      'Zařazení znamená, že objímka zasune vnitřní zuby na zuby věnce volného kola. Moment pak jde: vstupní hřídel → 34 z → 46 z → předlohový hřídel → kolo stupně → volné kolo → objímka → náboj → výstupní hřídel. Dvě soukolí za sebou znamenají, že výstup se otáčí <b>stejným směrem</b> jako vstup; předlohový hřídel opačně.',
      '<b>4. stupeň je přímý záběr</b> (1,000): objímka 3–4 spojí vstupní hřídel přímo s výstupním a předlohový hřídel jen protáčí nezatížená kola. <b>5. stupeň je rychloběh</b> (0,769): výstupní hřídel se otáčí rychleji než motor.',
    ),
    notice: [
      'Oranžově svítí tělesa přenášející moment (zapněte „Tok výkonu“). Ve 4. stupni mezi nimi není předlohový hřídel.',
      'Nižší stupeň = větší převod = větší moment na výstupním hřídeli při nižší rychlosti.',
      'V neutrálu se otáčejí všechna volná kola, ale žádné nepřenáší moment.',
      'Rychlost vozu je dopočtena s rozvodovkou 4,1 a poloměrem kola 0,30 m (rozvodovka není modelována).',
    ],
    camera: { position: [630, 170, 880], target: [630, -20, 0] }, flow: true,
    focus: null, housing: 'ghost', slow: 1 / 20,
    labels: [{ id: 'inputShaft', a: 't', dx: -30, dy: -90 }, { id: 'mainShaft', a: 't', dx: 60, dy: -70 }, { id: 'counterShaft', a: 'b', dx: 0, dy: 70 }],
    diagram: 'ratios',
    actions: ['1', '2', '3', '4', '5'].map(g => ({ label: g + '. stupeň', run: a => a.requestGear(g) })),
    setup(a) {
      a.reset(); a.setAssist(true);
      const settled = g => () => a.state.gear === g && !a.driver.busy && a.state.rpm.engine > 3000;
      a.requestGear('1'); a.until(settled('1'), 12, { throttle: 0.4 });
      a.requestGear('2'); a.until(settled('2'), 12, { throttle: 0.5 });
      a.requestGear('3'); a.until(settled('3'), 12, { throttle: 0.5 });
      a.setInputs({ throttle: 0.35 });
    },
  },
  {
    id: 'synchron',
    title: 'Synchronizace',
    html: P(
      'Při řazení za jízdy se musí volné kolo, které se točí jinou rychlostí než výstupní hřídel, nejprve <b>vyrovnat otáčkami</b>, jinak by zuby objímky narazily na zuby kola. To obstarává <b>synchronizér</b>: náboj (pevný na hřídeli), <b>objímka</b> (přesuvná) a <b>blokovací kroužek</b> s kuželovou třecí plochou.',
      '<b>Postup:</b> 1) vidlice posune objímku a kroužek se přitlačí na <b>kužel</b> volného kola; 2) rozdíl otáček pootočí kroužek o část rozteče zubů, zuby objímky narazí na zuby kroužku – objímka je <b>zablokovaná</b> a čím víc vidlice tlačí, tím víc kužel brzdí; 3) tření srovná otáčky kola s výstupním hřídelem; 4) třecí moment zmizí, zkosené zuby natočí kroužek zpět a objímka jím projde; 5) zkosení 45° zavede zuby objímky do mezer věnce kola a objímka zapadne.',
      '<b>Proč je nutná spojka:</b> synchronizér musí změnit otáčky celé vstupní strany – lamely, vstupního hřídele, předlohy a volných kol (v modelu 0,008 kg·m²). Při sepnuté spojce by musel měnit i otáčky motoru se setrvačníkem (0,16 kg·m², asi 21× víc), což kužel nezvládne: objímka zůstane zablokovaná a ozve se skřípění.',
    ),
    notice: [
      'Diagram ukazuje polohu objímky: kroužek se dotkne kužele, blokovací poloha (objímka stojí), špičky zubů kola, plné zařazení (9,5 mm).',
      'Blokovací kroužek se v blokování pootočí o čtvrtinu rozteče zubů (2,5° z rozteče 10°).',
      'Dokud se otáčky liší, objímka dál nepostoupí – nemá smysl tlačit silou.',
      'V této kapitole je zapnuto <b>„celý čas“</b>: zpomaleno je úplně všechno včetně pedálů a páky (na scéně svítí štítek se zpomalením). Tlačítkem „Přehrát znovu“ se zopakuje řazení 1 → 2; zkuste vypnout Asistenta spojky a řadit bez pedálu.',
    ],
    camera: { position: [650, 110, 330], target: [635, 10, 0] }, flow: true,
    focus: ['mainShaft', 'gear1', 'gear2', 'sleeve12', 'ring1', 'ring2', 'fork12', 'inputShaft', 'counterShaft'], housing: 'cut', slow: 1 / 20, slowMode: 'time',
    labels: [{ id: 'sleeve12', a: 'b', dx: 0, dy: 80 }, { id: 'gear2', a: 't', dx: -60, dy: -70 }, { id: 'gear1', a: 't', dx: 60, dy: -70 }, { id: 'fork12', a: 't', dx: 0, dy: -100 }],
    diagram: 'sync',
    actions: [
      { label: 'Řadit 2 → 3', run: a => a.requestGear('3') },
      { label: 'Zpět na 2', run: a => a.requestGear('2') },
    ],
    setup(a) {
      a.reset(); a.setAssist(true);
      a.requestGear('1');
      a.until(() => a.state.gear === '1' && !a.driver.busy && a.state.rpm.engine > 3500, 20, { throttle: 0.4 });
      a.setInputs({ throttle: 0.2 }); a.requestGear('2');
    },
  },
  {
    id: 'zpatecka',
    title: 'Zpátečka',
    html: P(
      'Zpátečka obrací směr otáčení tím, že mezi kolo předlohového hřídele (18 z) a kolo na výstupním hřídeli (50 z) vloží <b>mezikolo</b> (22 z). Mezikolo je s kolem předlohy trvale v záběru; při zařazení ho vidlice posune o 9,5 mm, až zabere s výstupním kolem (zabírá 8 z 10 mm šířky věnce).',
      'Směr otáčení: vstup +, předlohový hřídel −, mezikolo +, výstup −. Převod je <b>−(46/34) × (50/18) = −3,758</b>.',
      'Ozubení zpátečky je <b>přímé</b> (válcová kola s přímými zuby, hlučnější než šikmé zuby vpřed) a <b>bez synchronizace</b>. Proto zpátečku řadíme na stojícím voze a po zastavení vstupního hřídele: jinak zuby vsouvaného kola narazí na točící se zuby a ozve se skřípění.',
    ),
    notice: [
      'Mezikolo je jediné ozubené kolo, které se při řazení skutečně zasouvá do záběru; zasouvá je stejná tyč jako 5. stupeň (opačným směrem).',
      'Výstupní hřídel se otáčí opačně – vedle otáček je záporné znaménko.',
      'Zkuste „Zpátečka za jízdy“: simulace nepustí mezikolo do záběru, dokud se vůz pohybuje.',
      'Na stojícím voze řidič nejdřív drží spojku sešlápnutou, dokud se vstupní hřídel nezastaví.',
      'V této kapitole je zapnuto <b>„celý čas“</b>: zpomalený je i řidič, pedály a řadicí páka (na scéně svítí štítek se zpomalením).',
    ],
    camera: { position: [880, 40, 330], target: [700, -45, 20] }, flow: true,
    focus: ['idlerR', 'counterShaft', 'mainShaft', 'fork5', 'sleeve5', 'inputShaft'], housing: 'cut', slow: 1 / 20, slowMode: 'time',
    labels: [{ id: 'idlerR', a: 'b', dx: -60, dy: 90 }, { id: 'fork5', a: 't', dx: -80, dy: -50 }],
    diagram: 'reverse',
    actions: [
      { label: 'Zpátečka za jízdy (skřípe)', run: a => {
        a.reset(); a.setAssist(true);
        a.requestGear('1'); a.fastForward(4, { throttle: 0.5 });
        a.setInputs({ throttle: 0.1 }); a.requestGear('R');
      } },
    ],
    setup(a) {
      a.reset(); a.setAssist(true); a.requestGear('R');
      a.until(() => a.driver.stage === 'shift' || a.driver.stage === 'idle', 15);   // skip the wait for the input shaft to stop
    },
  },
  {
    id: 'jizda',
    title: 'Jízda',
    html: P(
      'Vše je v provozu a můžete ovládat všechno: plyn (<span class="k">W</span> / <span class="k">↑</span>), spojku (<span class="k">mezerník</span>), brzdu (<span class="k">S</span> / <span class="k">↓</span>) a řadicí páku (klávesy <span class="k">1</span>–<span class="k">5</span>, <span class="k">R</span>, <span class="k">N</span>/<span class="k">0</span> nebo kliknutím do schématu H).',
      '<b>Rozjezd:</b> zvolte 1. stupeň, přidejte plyn (kolem 0,3–0,4) – asistent pustí spojku postupně. <b>Řazení:</b> při otáčkách nad cca 4000 ot/min zvolte vyšší stupeň a sledujte fáze synchronizéru ve spodním panelu. <b>Chyba řazení:</b> vypněte Asistenta spojky a řaďte bez pedálu – synchron zablokuje a ozve se skřípění. <b>Zhasnutí:</b> vypněte Asistenta spojky, zabrzděte ve stupni se sepnutou spojkou a motor zhasne (s Asistentem řidič při zastavení spojku sám sešlápne).',
      'Zpomaleno je jen otáčení hřídelů (1/20) – pedály, startér a řazení reagují hned. Chcete-li zpomalit i ovládání, přepněte „jen otáčení“ na „celý čas“.',
    ),
    notice: [
      'Záporné otáčky předlohového hřídele jsou správně – točí se opačným směrem než motor.',
      'Při pomalém rozjezdu v 1. stupni sledujte stav spojky: sepnutá → prokluzuje → sepnutá.',
      'Zpátečku zařaďte až po zastavení vozu.',
      'Tlačítkem „Vypnout motor“ motor dobíhá a zastaví se, „Nastartovat“ spustí startér. S Asistentem startuje řidič i ve stupni; bez něj nejdřív sešlápněte spojku nebo vyřaďte.',
    ],
    camera: { position: [380, 330, 1290], target: [385, 105, 0] }, flow: true,
    focus: null, housing: 'ghost', slow: 1 / 20,
    labels: [],
    diagram: null,
    setup(a) { a.reset(); a.setAssist(true); },
  },
];

/* ------------------------------------------------------------------ glossary
   `match`: prefixes of part id (or body) that this entry describes. First entry whose prefix matches the part id wins,
   then body. */
export const glossary = [
  { title: 'Blok motoru', match: ['block'], text: 'Litinová nebo hliníková skříň s vývrty válců (86 mm) a lůžky pěti hlavních ložisek klikového hřídele. Nese celé ústrojí a vede chladicí kapalinu.' },
  { title: 'Hlava válců', match: ['head'], text: 'Uzavírá válce shora a tvoří spalovací prostor (střechovitý, se svíčkou uprostřed). Nese sedla a vedení ventilů, vačkové hřídele a hrníčková zdvihátka.' },
  { title: 'Ložiska vačkových hřídelí', match: ['camCaps', 'camCap'], text: 'Víka, která přitahují vačkové hřídele k hlavě. Hřídel se v nich otáčí v olejovém filmu.' },
  { title: 'Zapalovací svíčka', match: ['sparkPlug'], text: 'Elektrodami přeskočí jiskra a zapálí stlačenou směs. Zapaluje se před horní úvratí (předstih), protože hoření trvá desítky stupňů klikového hřídele. Svíčka sedí uprostřed spalovacího prostoru mezi vačkovými hřídeli.' },
  { title: 'Palec rozdělovače', match: ['ignRotor'], text: 'Rotující kontakt na zadním konci sací vačkové hřídele; otáčí se s ní, tedy jednu otáčku za 720° cyklus. Přivádí vysoké napětí od středu víka postupně ke čtyřem kontaktům. Má široký hrot, aby kontakt překrýval při každém předstihu.' },
  { title: 'Rozdělovač', match: ['ignDistributor'], text: 'Pouzdro na zadním konci hlavy, které nese víko a ve kterém se otáčí palec. Rozděluje zapalovací napětí mezi čtyři válce v pořadí 1–3–4–2.' },
  { title: 'Víko rozdělovače', match: ['ignCap'], text: 'Plastové víko se středním uhlíkovým kontaktem a čtyřmi kontakty po obvodu (po 90°). Jiskra přeskočí z hrotu palce přes mezeru 0,8 mm na kontakt. V modelu je průhledné (kromě režimu „Plné“), aby byl vidět palec.' },
  { title: 'Zapalovací cívka', match: ['ignCoil'], text: 'Transformátor, který z napětí palubní sítě vytvoří desítky tisíc voltů. Střední kabel ji spojuje se středem víka rozdělovače.' },
  { title: 'Kabel svíčky', match: ['ignLead', 'ignBoot'], text: 'Vysokonapěťový kabel vede od kontaktu víka rozdělovače ke koncovce na svíčce. Kabely jsou v modelu ilustrativní.' },
  { title: 'Klikový hřídel', match: ['crankshaft'], text: 'Mění přímočarý pohyb pístů na rotaci. Má pět hlavních čepů, čtyři klikové čepy (v jedné rovině – písty 1+4 a 2+3 jdou společně) a protizávaží, která vyvažují odstředivé síly.' },
  { title: 'Řemenice klikového hřídele', match: ['crankSprocket'], text: 'Zubatá řemenice s 18 zuby; zubatým řemenem pohání řemenice vaček s 36 zuby (převod 1 : 2).' },
  { title: 'Setrvačník', match: ['flywheel'], text: 'Těžký kotouč na zadní přírubě klikového hřídele. Vyhlazuje kolísání otáček mezi zážehy, jeho čelní plocha je třecí plochou spojky a na obvodu nese ozubený věnec startéru (132 zubů).' },
  { title: 'Píst', match: ['piston'], text: 'Přenáší tlak plynu na ojnici. Nese pístní kroužky (těsnění a stírání oleje) a pístní čep Ø 22 mm. Píst 1 a 4 se pohybují vždy společně.' },
  { title: 'Ojnice', match: ['rod'], text: 'Tuhá tyč délky 138 mm mezi osami. Malým okem je na pístním čepu, velkým okem na klikovém čepu. Při otáčce se vyklání až o 18,2°.' },
  { title: 'Sací ventil', match: ['valveIn'], text: 'Otevírá se 10° před HÚ a zavírá 58° za DÚ, zdvih vačky 8,56 mm. Je větší než výfukový. Pohání ho přes hrníčkové zdvihátko vačka, zavírá pružina.' },
  { title: 'Výfukový ventil', match: ['valveEx'], text: 'Otevírá se 58° před DÚ a zavírá 10° za HÚ, zdvih vačky 8,31 mm. Spaliny odcházejí pod tlakem, proto stačí menší talíř než u sacího ventilu; ventil je silně tepelně namáhán.' },
  { title: 'Pružina ventilu', match: ['spring'], text: 'Zavírá ventil a drží zdvihátko na vačce. Musí být tak tuhá, aby sledovala vačku i při vysokých otáčkách.' },
  { title: 'Sací vačková hřídel', match: ['camIn'], text: 'Otáčí se poloviční rychlostí než klika. Laloky vaček otevírají sací ventily podle pořadí zapalování 1–3–4–2.' },
  { title: 'Výfuková vačková hřídel', match: ['camEx'], text: 'Stejná jako sací, ale s lalokem natočeným pro výfukové ventily. Otáčí se poloviční rychlostí než klikový hřídel.' },
  { title: 'Řemenice vačky', match: ['camSprocket'], text: 'Zubatá řemenice s 36 zuby, dvojnásobkem zubů kliky. Proto vačka vykoná jednu otáčku za dvě otáčky klikového hřídele.' },
  { title: 'Rozvodový řemen', match: ['belt'], text: 'Ozubený řemen synchronizuje klikový hřídel a vačky. Přetržení řemenu u interferenčního motoru znamená ohnuté ventily.' },
  { title: 'Plyn ve válci', match: ['gas'], text: 'Částice znázorňují náplň válce: modré = čerstvá směs při sání, fialové = stlačená směs, žluté čelo plamene a oranžová spálená náplň při hoření, rudé = chladnoucí plyn při expanzi, světle hnědé = spaliny při výfuku. Je to idealizovaný model.' },
  { title: 'Sací potrubí', match: ['intakeManifold'], text: 'Krátké sací kanály na sací straně hlavy; vedou čerstvou směs k sacím ventilům.' },
  { title: 'Výfukové potrubí', match: ['exhaustManifold'], text: 'Krátké výfukové kanály na výfukové straně hlavy; odvádějí spaliny od výfukových ventilů.' },
  { title: 'Jiskra', match: ['spark'], text: 'Krátký záblesk svíčky v okamžiku zážehu, několik desítek stupňů před HÚ (v modelu 10–30° podle zatížení).' },
  { title: 'Víko spojky', match: ['clutchCover', 'cover'], text: 'Plechový kryt přišroubovaný k setrvačníku šesti šrouby. Nese talířovou pružinu a přítlačný kotouč; otáčí se s motorem.' },
  { title: 'Přítlačný kotouč', match: ['pressurePlate'], text: 'Litinový prstenec, který pružina tlačí na lamelu. Při sešlápnutí pedálu se odtahuje od lamely o 1,8 mm.' },
  { title: 'Jazýček talířové pružiny', match: ['finger', 'diaphragm'], text: 'Talířová pružina má radiální jazýčky (v modelu 18 tuhých pák). Ložisko tlačí na jejich konce, pružina se překlopí kolem opěrného kroužku a okraj uvolní přítlačný kotouč.' },
  { title: 'Lamela spojky', match: ['clutchDisc'], text: 'Kotouč s třecími obloženími, drážkovaný na vstupním hřídeli. Není přišroubovaná: je sevřená třením mezi setrvačníkem a přítlačným kotoučem. Torzní pružiny tlumí rázy.' },
  { title: 'Pilotní ložisko', match: ['pilotBearing'], text: 'Malé ložisko v ose klikového hřídele, které podpírá přední čep vstupního hřídele převodovky. Točivý moment nepřenáší – při rozpojené spojce se v něm hřídel volně otáčí vůči motoru.' },
  { title: 'Vypínací ložisko', match: ['releaseBearing'], text: 'Kuličkové ložisko na vodicí trubce. Při sešlápnutí pedálu ho vidlice posune k motoru o 9,8 mm a ono tlačí na jazýčky pružiny.' },
  { title: 'Vypínací vidlice', match: ['releaseFork'], text: 'Páka uložená ve zvonu, kterou ovládá pedál (hydraulicky nebo lankem). Posouvá vypínací ložisko.' },
  { title: 'Zvon spojky', match: ['bellhousing'], text: 'Pevný kryt mezi motorem a převodovkou. Chrání spojku a nese vypínací vidlici.' },
  { title: 'Vstupní hřídel', match: ['inputShaft'], text: 'Drážkovaným koncem nese lamelu a vpředu je vedený v čepu klikového hřídele. Kolo stálého záběru (34 z) je jeho součástí; ve 4. stupni se na něj přímo spojuje objímka.' },
  { title: 'Předlohový hřídel', match: ['counterShaft'], text: 'Leží pod osou a nese pevně všechna kola (46, 41, 33, 23, 51 a 18 zubů). Točí se opačným směrem než vstupní hřídel a v neutrálu se sepnutou spojkou se otáčí také.' },
  { title: 'Výstupní hřídel', match: ['mainShaft'], text: 'Leží v ose vstupního, nese volná kola, náboje synchronizérů, pevné kolo zpátečky (50 z) a vzadu výstupní přírubu. V neutrálu stojí.' },
  { title: 'Volné kolo stupně', match: ['gear1', 'gear2', 'gear3', 'gear5'], text: 'Kolo (57, 47, 39, 29 zubů pro 1., 2., 3., 5. stupeň) otočné na výstupním hřídeli, stále v záběru s předlohou. Má kužel pro synchronizér a věnec zubů, do kterého zapadne objímka.' },
  { title: 'Vložené kolo zpátečky', match: ['idlerR'], text: 'Kolo s 22 přímými zuby na vlastní ose, které se zasouvá mezi kolo předlohy (18 z) a kolo výstupního hřídele (50 z) a obrací směr otáčení.' },
  { title: 'Přesuvná objímka', match: ['sleeve'], text: 'Má vnitřní zuby, kterými po náboji klouže. Posunem spojí zvolené volné kolo s nábojem. Vnější drážka pro vidlici.' },
  { title: 'Blokovací (synchronizační) kroužek', match: ['ring'], text: 'Mosazný kroužek s kuželovou třecí plochou. Třením srovná otáčky a svými zuby zablokuje objímku, dokud se otáčky liší.' },
  { title: 'Řadicí vidlice', match: ['fork'], text: 'Prsty vidlice zapadají do drážky objímky. Vidlice sedí na řadicí tyči, kterou posouvá řadicí páka.' },
  { title: 'Řadicí páka', match: ['shiftLever'], text: 'Vahadlo s kolénkem. Pohybem do stran vybírá řadicí tyč, pohybem vpřed a vzad ji posouvá. Schéma H: 1 3 5 nahoře, 2 4 R dole.' },
  { title: 'Skříň převodovky', match: ['gearCase'], text: 'Nese ložiska hřídelů, vedení řadicích tyčí a hřídel mezikola zpátečky. Je naplněna olejem (v modelu nezobrazen).' },
  { title: 'Kolo stálého záběru (34 z)', match: ['inputGear'], text: 'Šikmé kolo pevné na vstupním hřídeli. Je trvale v záběru s kolem předlohy (46 z) a nese i zuby a kužel pro přímý 4. stupeň.' },
  { title: 'Kolo zpátečky (50 z)', match: ['revGear'], text: 'Přímé kolo pevně drážkované na výstupním hřídeli. Při zařazení zpátečky do něj zabere vložené kolo.' },
  { title: 'Výstupní příruba', match: ['outputFlange'], text: 'Konec výstupního hřídele, odkud by pokračoval kardan k zadní nápravě (v modelu nepokračuje).' },
  { title: 'Čep vloženého kola', match: ['idlerShaft'], text: 'Pevný čep ve skříni, po kterém se vložené kolo zpátečky posouvá a na kterém se otáčí.' },
  { title: 'Vodicí trubka vypínacího ložiska', match: ['quill'], text: 'Pevná trubka na přední stěně převodovky; vstupním hřídelem prochází středem a po jejím povrchu klouže vypínací ložisko.' },
  { title: 'Náboj synchronizéru', match: ['hub'], text: 'Drážkovaný na výstupním hřídeli; otáčí se s ním. Objímka po něm klouže.' },
];

/* ------------------------------------------------------------------ simplifications (source: MODEL/EST tags in spec.js) */
export const simplifications = [
  'Vůle jsou zvětšené: radiální vůle pístu 0,25 mm (skutečně asi 0,02–0,04 mm) a 0,2 mm v ložiskách ojnice, aby se součásti nikdy neprotínaly.',
  'Talířová pružina je nakreslena jako 18 tuhých jazýčků; neprohýbá se.',
  'Hlavy ventilů jsou menší než skutečné (sací 33,0 mm, výfukový 28,5 mm místo 34,5 / 29,5 mm) a spalovací prostor je zjednodušený střechovitý; úhel ventilů je zvolen tak, aby plochý píst dal kompresní poměr ≈ 11 : 1.',
  'Tlak a teplota plynu jsou idealizovaný model (průběh hoření podle Wiebeho, polytropa 1,30); plyn je jen vizualizace a nemá vliv na pohyb.',
  'Vložené kolo zpátečky zabírá jen 8 z 10 mm šířky zubů. Zpátečka není synchronizovaná, mezikolo vjede do záběru, jen když stojí vůz i vstupní hřídel.',
  'Synchronizér je zjednodušen: kuželový moment je ekvivalentních 5 N·m na vstupním hřídeli (synchronizace asi 0,2 s), počet zubů 36; přítlačné kolíky s pružinkou (3 ks), které ve skutečnosti kroužek přitlačují, nejsou modelovány.',
  'Převodovka není doplněna o rozvodovku a diferenciál; rychlost vozu se počítá z rozvodovky 4,1, poloměru kola 0,30 m a hmotnosti 1100 kg.',
  'Jeden zubatý řemen obepíná řemenice obou vaček, takže se obě vačky točí stejným směrem jako klikový hřídel; u některých skutečných motorů se sací vačka otáčí opačně.',
  'Počty zubů jsou odhadnuty (jen dvojice 34 / 46 pochází z Toyoty W58); převody se od W58 liší nejvýše o asi 2 %. Vpřed jsou šikmá kola (úhel 23°), zpátečka má přímé zuby.',
  'Průběh momentu motoru je zjednodušený (190 N·m ve špičce, volnoběh 800, omezovač 7500 ot/min), torzní tlumič lamely není simulován a setrvačnosti jsou sloučeny do tří těles.',
  'Časování ventilů je odhadnuto kolem sourcované délky 248° (10° / 58° / 58° / 10°); vůle ventilu 0,2 mm, zdvih lamely a vypínacího ložiska jsou odhady.',
  'Chybí olej, jehlová ložiska, těsnění, pojistné kroužky, aretace a blokování řadicích tyčí je nahrazeno logikou (v daný okamžik je mimo neutrál nejvýše jedna tyč).',
  'Zapalovací cívka je externí (některé verze motoru mají cívky integrované); přerušovač ani zapalovací modul nejsou zobrazeny, předstih zážehu se počítá (není to mechanický regulátor předstihu) a vysokonapěťové kabely jsou ilustrativní.',
  'Rozměry jsou odvozeny z motoru Toyota 3S-GE (86 × 86 mm) a převodovky Toyota W58; mnohé skutečné rozměry nejsou veřejně dostupné a jsou odhadnuty.',
];
