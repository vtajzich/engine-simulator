# Rešerše klikových hřídelů: je klika v modelu správně a kterému motoru odpovídá?

English version: [crankshaft-research.en.md](crankshaft-research.en.md)

Datum rešerše: listopad 2026. Položená otázka: nemá mít kliková hřídel jiný úhel pro každý válec? Jak vypadaly
klikové hřídele aut v letech 1960–1990, je model v pořádku a kterému skutečnému motoru odpovídá?

**Stručná odpověď.** Model je správně. Řadový čtyřdobý čtyřválec má klikové čepy jen ve dvou úhlech, 0° a 180°.
Jiný úhel pro každý válec mají jiná uspořádání (tříválce, pětiválce, šestiválce, V8). Rozměry modelu vycházejí
z motoru Toyota 3S-GE a převody z převodovky Toyota W58; žádné sériové auto je nemělo obojí.

Značky spolehlivosti: **[SRC]** uvádí citovaný zdroj, **[WEAK]** příspěvek na fóru nebo stránka bez odkazů,
**[KNOW]** obecná znalost, kterou zdroje stažené pro tuto rešerši nepotvrdily.

## 1. Proč čtyřem válcům stačí dva úhly

Čtyřdobý cyklus trvá 720° otočení kliky (dvě otáčky). Čtyři válce mají zapalovat po 180°, a to splní hřídel s čepy
1 a 4 nahoře a 2 a 3 dole. Písty 1 a 4 se pohybují spolu, ale v cyklu jsou od sebe o celou otáčku: když jeden
zapaluje, druhý končí výfuk.

Hodnoty v modelu (`src/spec.js`, `throwPhaseDeg` a `firingAngleDeg`):

| Válec | Úhel čepu | Zážeh při úhlu kliky |
|---|---|---|
| 1 | 0° | 0° |
| 2 | 180° | 540° |
| 3 | 180° | 180° |
| 4 | 0° | 360° |

Čtyři různé úhly po 90° má až rozdělovač, protože se točí poloviční rychlostí. Tam se rozdíl mezi válci 1 a 4
ukáže, na klice ne.

## 2. Proč 180° a ne čepy postupně po 90°

- **Pravidelný chod.** S čepy po 90° by čtyřdobý čtyřválec zapaloval nepravidelně (270°, 180°, 90°, 180°) [KNOW],
  s nerovnoměrným tahem a nerovnoměrnými pulzy ve výfuku. Hřídel 180° zapaluje každých 180° [SRC: cowdery.org.uk].
- **Vyvážení sil.** Dva písty jdou vždy nahoru a dva dolů, takže se síly prvního řádu ruší: „perfect primary
  balance“ [SRC: Wikipedia, Straight-four engine; Engine balance].
- **Žádné kývání.** Pořadí nahoře–dole–dole–nahoře je zrcadlově souměrné kolem středu motoru, takže vnější dvojice
  (1, 4) a vnitřní dvojice (2, 3) motor nenaklápějí dopředu a dozadu [KNOW]. Hřídel po 90° by potřebovala
  vyvažovací hřídel.
- **Jednoduchá výroba.** Všechny čepy leží v jedné rovině, takže se hřídel dá vykovat naplocho bez zkrucování
  [KNOW].
- **Sání a výfuk.** Pravidelné pulzy po 180° dovolují jednoduché sběrné potrubí a rozdělovač se čtyřmi kontakty
  po 90°.

Jedinou nevýhodou jsou zbylé vibrace s dvojnásobnou frekvencí otáčení (nevyváženost druhého řádu): píst se kolem
horní úvrati pohybuje rychleji než kolem dolní, takže se síly obou dvojic nevyruší úplně. Rostou s druhou mocninou
otáček. Větší čtyřválce proto mívají dvě vyvažovací hřídele s dvojnásobnými otáčkami; systém byl vynalezen roku
1911 a Mitsubishi ho v 70. letech prodávalo pod názvem „Silent Shaft“ [SRC: Wikipedia, Straight-four engine].

Čepy postupně po 90° dávají smysl u dvoudobého čtyřválce, kde každý válec zapaluje každou otáčku [KNOW]. U
čtyřdobého řadového čtyřválce je použil až motocykl Yamaha R1 z roku 2009 (křížová hřídel, nepravidelné zážehy)
[SRC: Wikipedia, Straight-four engine].

## 3. Klikové hřídele automobilových motorů 1960–1990

| Uspořádání | Úhly čepů | Příklady z té doby |
|---|---|---|
| Řadový čtyřválec | 180° (nahoře–dole–dole–nahoře) | prakticky všechny: BMC A (Mini), Ford Kent, BMW M10, Škoda 1000 MB |
| Řadový tříválec | 120° | — |
| Řadový pětiválec | 72° | diesel Mercedes-Benz OM617 (1974), Audi 100 2.1 (1977) |
| Řadový šestiválec | 120°, čepy po dvojicích | — |
| Plochý čtyřválec (boxer) | 180° (vlevo–vpravo–vpravo–vlevo), zážeh každých 180° | VW Brouk, Porsche 356 a 912 |
| V6 | tři společné čepy po 120°, později dělené čepy | Buick V6 z roku 1962 zapaloval nepravidelně (90°/150°); dělené čepy od 1977 |
| V8 | čtyři čepy po 90° (křížová hřídel) | většina sériových V8; plochá hřídel 180° u sportovních motorů |

Všechny řádky [SRC: Wikipedia, Engine balance; Straight-five engine; Flat-four engine; V6 engine; Crankshaft].

U řadových čtyřválců té doby se úhly neměnily. Měnilo se uložení a vyvážení:

- **Tři hlavní ložiska** – starší a levnější motory:
  - BMC A po celou dobu výroby 1951–2000 (studie pětiložiskové hřídele byla opuštěna, protože se tříložisková
    osvědčila) [SRC: Wikipedia, BMC A-series engine];
  - Škoda 1000 MB (1964) a její následovníci až do roku 2003 [SRC: auto.cz];
  - první Ford Kent 1340 cm³ [SRC: gomog.com];
  - motory MGB 18G/18GA, 1962–1964 [SRC: mgocspares.co.uk];
  - Fiat řady 100 (850, 127, Panda 45, Uno 45) [SRC: Wikipedia, Fiat 100 series engine].
- **Pět hlavních ložisek** – během 60. let se stalo standardem:
  - Ford Kent 1498 cm³ [SRC: gomog.com];
  - MGB 18GB od října 1964 [SRC: mgocspares.co.uk];
  - BMW M10, 1962–1988, kovaná hřídel s protizávažími [SRC: Wikipedia, BMW M10];
  - Toyota 3S, od roku 1984 [SRC: viz oddíl 4].
- **Protizávaží** – čtyři nebo osm. Osm víc odlehčí ložiskům, čtyři šetří hmotnost (1,42 kg u motoru 2,2 l ve
  studii SAE z roku 2008) [SRC: SAE 2008-01-0088].

## 4. Čemu model odpovídá

Motor vychází z **Toyoty 3S-GE** (vyráběna od května 1984):

| Údaj | Model | Toyota 3S | Zdroj |
|---|---|---|---|
| Vrtání × zdvih | 86 × 86 mm | 86 × 86 mm | [SRC] Wikipedia, Toyota S engine |
| Hlavní ložiska | 5 | 5 | [SRC] tamtéž |
| Protizávaží | 8 | 8 | [SRC] tamtéž |
| Materiál | — | kovaná (3S-GE); litina (3S-FE) | [SRC] Wikipedia; toyota-club.net |
| Hlavní čep / ojniční čep | 55 / 48 mm | 55 / 48 mm (3S-FE z roku 1986) | [SRC] toyota-club.net |
| Šířka hlavních ložisek | všechna 22 mm | střední širší (19 / 23 mm) | [SRC] toyota-club.net |
| Pořadí zapalování | 1-3-4-2 | 1-3-4-2 | [KNOW] |
| Pohon vaček | ozubený řemen | jeden řemen pohání obě vačky | [SRC] Wikipedia |

Zjištění:

- **Jediná odchylka na hřídeli:** skutečná hřídel má střední hlavní ložisko širší; model kreslí všech pět stejných.
- **Nejistý průměr čepu:** u verze 3S-FE z roku 1990 zdroj uvádí zvětšení „ze 48 na 52 mm“, aniž říká kterého
  čepu. Čep 48 mm tedy platí pro starší provedení.
- **Nově doloženo:** počet hlavních ložisek a protizávaží byl v `src/spec.js` a `docs/research.md` vedený jako
  odhad; obojí je potvrzené.
- **Údaje o ventilech jsou pozdější:** zdvihy a úhly ventilů v `docs/research.md` pocházejí ze čtvrté generace
  3S-GE (po roce 1997).

Převodovka má převody **Toyoty W58** (3,285 / 1,894 / 1,275 / 1,000 / 0,783, zpátečka 3,768), montované do Supry
A60/A70/A80, Celiky pro USA 1982–1985, Cressidy X70, Soareru Z20, Lotusu Excel a Lexusu SC300 [SRC: Wikipedia,
Toyota W transmission]. Žádné auto není na seznamu použití 3S-GE i W58 zároveň, takže model je složenina a
neodpovídá jednomu sériovému vozu.

Nepotvrzeno: pokud je známo, byl 3S-GE v Celice a MR2 uložen napříč a podélně s pohonem zadních kol až v Altezze
z roku 1998 [KNOW]. Jeden nalezený zdroj tvrdí, že v MR2 byl podélně, takže to zůstává otevřené.

## 5. Srovnání: Fiat 850 Sport Coupé

Fiat má stejné uspořádání kliky po 180°, ale jinak je to úplně jiný motor.

| | Fiat 850 Sport Coupé | Model |
|---|---|---|
| Motor | řadový čtyřválec 903 cm³, řada Fiat 100 (kód 100GBC.000) | řadový čtyřválec 1998 cm³ |
| Vrtání × zdvih | 65 × 68 mm | 86 × 86 mm |
| Hlavní ložiska kliky | 3 | 5 |
| Rozvod | OHV, vačka v bloku poháněná řetězem, 2 ventily na válec | DOHC 16V, ozubený řemen |
| Výkon | 52 k (38 kW) | — |
| Uložení | motor vzadu, pohon zadních kol | vpředu podélně |
| Převodovka | čtyřstupňová | pětistupňová tříhřídelová |

[SRC: Wikipedia, Fiat 850; Fiat 100 series engine; carbaze.com]

- **Směr otáčení:** motor Fiatu 850 se točí opačně než většina motorů, při pohledu od rozvodového řetězu proti
  směru hodinových ručiček; model se při pohledu zepředu točí po směru [WEAK: příspěvek na fiatforum.com; seznam
  motorů, který u osmsetpadesátky uvádí „inverted rotation“]. Dílenská příručka se nenašla.
- **Rok:** výroba kupé skončila v roce 1971 a Sport Coupé s motorem 903 cm³ se vyrábělo od roku 1968 [SRC:
  Wikipedia, Fiat 850]. Vůz s rokem 1972 je nejspíš později přihlášený kus.
- **Nedohledáno:** počet protizávaží a pořadí zapalování (u hřídele 180° přichází v úvahu jen 1-3-4-2 nebo 1-2-4-3
  [SRC: cowdery.org.uk]).

## Zdroje

- [Engine balance (Wikipedia)](https://en.wikipedia.org/wiki/Engine_balance)
- [Straight-four engine (Wikipedia)](https://en.wikipedia.org/wiki/Straight-four_engine)
- [Straight-five engine (Wikipedia)](https://en.wikipedia.org/wiki/Straight-five_engine)
- [Flat-four engine (Wikipedia)](https://en.wikipedia.org/wiki/Flat-four_engine)
- [V6 engine (Wikipedia)](https://en.wikipedia.org/wiki/V6_engine)
- [Crankshaft (Wikipedia)](https://en.wikipedia.org/wiki/Crankshaft)
- [Crankshaft configurations (cowdery.org.uk)](https://cowdery.org.uk/cranks.php)
- [The Evolution of Crankshaft Design (enginehistory.org)](https://enginehistory.org/members/articles/CrankDesignEvol.shtml)
- [4 Versus 8 Counterweights for an I4 Gasoline Engine Crankshaft (SAE 2008-01-0088)](https://saemobilus.sae.org/content/2008-01-0088)
- [Toyota S engine (Wikipedia)](https://en.wikipedia.org/wiki/Toyota_S_engine)
- [Toyota engines – 3S-FE (toyota-club.net)](https://www.toyota-club.net/files/faq/21-07-10_faq_s-engine_en.htm)
- [Toyota W transmission (Wikipedia)](https://en.wikipedia.org/wiki/Toyota_W_transmission)
- [BMC A-series engine (Wikipedia)](https://en.wikipedia.org/wiki/BMC_A-series_engine)
- [BMW M10 (Wikipedia)](https://en.wikipedia.org/wiki/BMW_M10)
- [History of the English Ford Engine (gomog.com)](https://www.gomog.com/BLAIR2/History/kenteng.html)
- [MGB lower engine components (mgocspares.co.uk)](https://www.mgocspares.co.uk/parts/mg/mgb/engine/lower-engine-components)
- [Legendární hliníkový motor Škoda (auto.cz)](https://www.auto.cz/legendarni-hlinikovy-motor-skoda-drzak-ktery-ve-vyrobe-vydrzel-skoro-40-let-128686)
- [Fiat 850 (Wikipedia)](https://en.wikipedia.org/wiki/Fiat_850)
- [Fiat 100 series engine (Wikipedia)](https://en.wikipedia.org/wiki/Fiat_100_series_engine)
- [Fiat 850 Sport Coupé – specifikace (carbaze.com)](https://carbaze.com/car-4284/fiat-850-sport-coup%C3%A9)
- [Engine swap 903cc in a 600D (fiatforum.com)](https://www.fiatforum.com/threads/engine-swap-903cc-in-a-600d.194341/latest)
