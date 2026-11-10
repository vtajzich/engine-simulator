# Motor a převodovka – interaktivní 3D model

Interaktivní 3D výklad čtyřdobého řadového čtyřválce (DOHC 16V, 86 × 86 mm), suché jednokotoučové spojky
a podélné tříhřídelové pětistupňové synchronizované převodovky se zpátečkou.
Veškerá geometrie je procedurální (Three.js) a vychází z jediného souboru rozměrů `src/spec.js`.

## Spuštění

```bash
npm install
npm run dev        # vývojový server (Vite)
npm run build      # produkční build do dist/
```

## Ovládání

| Akce | Ovládání |
|---|---|
| Plyn / brzda / spojka | posuvníky, nebo držet `W`/`↑`, `S`/`↓`, `mezerník` |
| Řazení | kulisa v dolní liště, nebo klávesy `1`–`5`, `R`, `N` |
| Asistent spojky | zapnuto: spojku obsluhuje automat (rozjezd i bez plynu, vyšlápnutí při brzdění do zastavení, start se zařazeným stupněm); vypnuto: řadíte sami a model ukáže, co se pokazí |
| Zpomalení | 1× až 1/500. **„jen otáčení“** (výchozí): mechanismus se točí pomalu, ale pedály, startér a řazení reagují ve skutečném čase. **„celý čas“**: skutečné zpomalení všeho (kapitoly Synchronizace a Zpátečka) |
| Pohled | myš (otáčení, posun, zoom), režimy skříní: průhledné / řez / plné / skryté |
| Jazyk | přepínač **CZ / EN** v záhlaví pravého panelu (nebo `?lang=en` v adrese); volba se pamatuje |

Kapitola „Čtyři doby“ ukazuje v příčném řezu válcem nasávání směsi, zážeh s šířícím se čelem plamene a výfuk
spalin; kapitola „Setrvačník a spojka“ má barevně odlišenou stranu motoru a převodovky, detail třecích ploch a žlutou
stopu točivého momentu (kudy síla jde z klikového hřídele do vstupního hřídele a kde se při sešlápnutí pedálu přeruší;
přední čep vstupního hřídele se v pilotním ložisku jen volně otáčí).

Zapalování (kapitola „Pořadí zapalování“, pohled „Rozdělovač a svíčky“): palec rozdělovače na sací vačce přivádí
jiskru ke čtyřem kontaktům víka v pořadí 1-3-4-2. Jiskra je vidět vždy – na svíčce, na kabelu i mezi palcem a kontaktem –
i při skrytých skříních a bez vrstvy „Plyn“; při reálné rychlosti ji záblesk drží 120 ms, aby byl při snímkování vidět.
Víko rozdělovače je průhledné ve všech režimech skříní kromě „Plné“, takže je vidět palec.

Jedenáct kapitol v pravém panelu provede klikovým mechanismem, čtyřmi dobami, rozvodem, pořadím zapalování,
spojkou, uspořádáním převodovky, tokem výkonu, synchronizací, zpátečkou a volnou jízdou.

## Ověřovací pipeline

```bash
npm run verify           # všechno: testy + build + vizuální kontrola (několik minut)
npm test                 # jen vitest (kinematika, simulace, kolize)
npm run verify:visual    # jen headless Chrome nad dist/ (vyžaduje npm run build)
```

1. **Kinematika** (`test/kin`) – klikový mechanismus, tabulka dob pro pořadí 1-3-4-2, časování ventilů, konvexnost
   a obálková konzistence vaček, převodové poměry, fázování ozubení, geometrie spojky a synchronizace.
2. **Simulace** (`test/sim`) – volnoběh, rozjezd, řazení, řazení bez spojky, zhasnutí motoru, zpátečka; po každém
   kroku se kontrolují invarianty (blokování tyčí, zarovnání zubů, pravidlo zkosení zubů objímky).
3. **Kolize ve 3D** (`test/collision`, `verify/collide.js`) – každé tuhé těleso je sloučeno do jedné sítě s BVH
   (`three-mesh-bvh`) a testuje se průnik trojúhelníků všech dvojic těles:
   - moduly zvlášť (blok a klika, hlava a rozvod, spojka, soukolí a synchrony, řazení a skříň),
   - celá sestava: pracovní cyklus 0–720°, sešlápnutí spojky, každý rychlostní stupeň, a **celá jízda přehraná ze
     simulátoru** (rozjezd, 1→2→3→4→5, zastavení, zpátečka),
   - dvoustranné testy dotyku (vačka–zdvihátko, ventil–sedlo, lamela–setrvačník, boky zubů): v nominální poloze
     bez průniku, po přisunutí o ≈ 0,3 mm průnik,
   - negativní kontroly dokazující, že detektor zabírá (např. rozvod posunutý o 114° → ventil narazí do pístu).
   Výsledky a naměřené vůle: `verify/out/collision-*.json`.
4. **Build** aplikace a **vizuální kontrola** (`verify/visual.mjs`) – headless Chrome projde všechny kapitoly,
   hlídá chyby v konzoli a prázdné plátno, vyzkouší řazení, zhasnutí motoru a výběr dílu. Ovládání se ověřuje
   **skutečnými kliknutími a klávesami v reálném čase** (motor zhasne i nastartuje do 2,5 s, jednička bez plynu se
   rozjede bez zhasnutí, brzdění do zastavení motor neudusí). Zapalování: koncovky kabelů svíček jsou ze shora vidět
   při skrytých i řezaných skříních; víko rozdělovače je průhledné (i v kapitole s výběrem dílů) a v režimu „Plné“
   neprůhledné; záblesk odpovídá úhlu kliky (pozastaveno), za chodu přichází v pořadí 1-3-4-2, při reálné rychlosti ho
   vidí všechny válce a po vypnutí motoru zhasne. Snímky v `verify/out/`.

## Struktura

```
src/spec.js      všechny rozměry (jediný zdroj pravdy; značky SRC / EST / MODEL)
src/kin/         kinematika (čistá matematika, bez Three.js)
src/sim/         simulace pohonu + automatický „řidič“
src/geo/         generátory geometrie (evolventní kola, zuby synchronů, …)
src/model/       3D moduly: bottomEnd, topEnd, clutch, gearbox, shift, assembly
src/app/         prohlížečová aplikace a český výklad (content/cs.js)
verify/          kolizní framework, vizuální kontrola, výstupy
docs/            research.md (rešerše se zdroji), design.md (kontrakt), plan/ (zadání modulů)
```

## Zjednodušení modelu

Model je mechanicky konzistentní, ale není to výkres konkrétního motoru. Hlavní vědomá zjednodušení
(v `src/spec.js` označena `MODEL`): zvětšené provozní vůle (≥ 0,2 mm, aby byly ověřitelné na sítích),
talířová pružina kreslená jako 18 tuhých páček, zmenšené talířky ventilů, idealizovaný průběh tlaku ve válci,
vložené kolo zpátečky zabírá 8 z 10 mm šířky, bez rozvodovky a diferenciálu (rychlost se počítá ze stálého
převodu 4,1 a poloměru kola 0,30 m). Referenční hodnoty: motor Toyota 3S-GE, převody podle Toyota W58 –
viz `docs/research.md`, kde je u každého čísla uvedeno, zda je doložené, nebo odhad.
