# Crankshaft research: is the model's crank correct, and which engine does it match?

Česká verze: [crankshaft-research.cs.md](crankshaft-research.cs.md)

Research date: November 2026. Question asked: should the crankshaft not have a different angle for every
cylinder? How did car crankshafts look between 1960 and 1990, is the model correct, and which real engine does
it correspond to?

**Short answer.** The model is correct. An inline four-cylinder four-stroke engine has its crankpins at only two
angles, 0° and 180°. A different angle for every cylinder belongs to other layouts (three-, five- and six-cylinder
engines, V8s). The model's dimensions follow the Toyota 3S-GE engine and the gearbox ratios follow the Toyota W58;
no production car combined the two.

Confidence tags: **[SRC]** stated by a cited source, **[WEAK]** forum post or unreferenced page, **[KNOW]** general
knowledge not confirmed by the sources fetched for this research.

## 1. Why two angles are enough for four cylinders

The four-stroke cycle takes 720° of crank rotation (two revolutions). Four cylinders should fire 180° apart, and a
crank with pins 1 and 4 up and pins 2 and 3 down does exactly that. Pistons 1 and 4 move together, but they are a
whole revolution apart in the cycle: when one fires, the other finishes its exhaust stroke.

Values in the model (`src/spec.js`, `throwPhaseDeg` and `firingAngleDeg`):

| Cylinder | Crankpin angle | Firing TDC at crank angle |
|---|---|---|
| 1 | 0° | 0° |
| 2 | 180° | 540° |
| 3 | 180° | 180° |
| 4 | 0° | 360° |

Four different angles 90° apart appear only on the distributor, because it turns at half crank speed. That is where
the difference between cylinders 1 and 4 shows; on the crank it does not.

## 2. Why 180° and not pins stepped by 90°

- **Even firing.** With pins stepped by 90° a four-stroke four would fire unevenly (270°, 180°, 90°, 180°) [KNOW],
  giving uneven torque and uneven exhaust pulses. The 180° crank fires every 180° [SRC: cowdery.org.uk].
- **Balanced forces.** Two pistons always go up while two go down, so the primary forces cancel: "perfect primary
  balance" [SRC: Wikipedia, Straight-four engine; Engine balance].
- **No rocking.** The order up–down–down–up is mirror-symmetric about the middle of the engine, so the outer pair
  (1, 4) and the inner pair (2, 3) do not rock the engine end to end [KNOW]. A 90° crank would need a balance shaft.
- **Simple to make.** All pins lie in one plane, so the crank can be forged flat without twisting [KNOW].
- **Intake and exhaust.** Even 180° pulses allow a simple manifold and a distributor with four terminals 90° apart.

The one drawback is a remaining vibration at twice crank speed (secondary imbalance): a piston moves faster near top
dead centre than near bottom dead centre, so the forces of the two pairs do not cancel completely. It grows with the
square of engine speed. Larger fours therefore use two balance shafts turning at twice crank speed; the system was
invented in 1911 and Mitsubishi marketed it as "Silent Shaft" in the 1970s [SRC: Wikipedia, Straight-four engine].

Pins stepped by 90° make sense for a two-stroke four, where every cylinder fires every revolution [KNOW]. In a
four-stroke inline four they were used only by the 2009 Yamaha R1 motorcycle (crossplane crank, uneven firing)
[SRC: Wikipedia, Straight-four engine].

## 3. Crankshafts of car engines, 1960–1990

| Layout | Crankpin angles | Examples from the period |
|---|---|---|
| Inline four | 180° (up–down–down–up) | practically all: BMC A-series (Mini), Ford Kent, BMW M10, Škoda 1000 MB |
| Inline three | 120° | — |
| Inline five | 72° | Mercedes-Benz OM617 diesel (1974), Audi 100 2.1 (1977) |
| Inline six | 120°, pins in pairs | — |
| Flat four (boxer) | 180° (left–right–right–left), fires every 180° | VW Beetle, Porsche 356 and 912 |
| V6 | three shared pins 120° apart, later split pins | Buick V6 of 1962 fired unevenly (90°/150°); split-pin "even-fire" from 1977 |
| V8 | four pins 90° apart (cross-plane) | most production V8s; flat-plane 180° cranks in high-performance engines |

All rows [SRC: Wikipedia, Engine balance; Straight-five engine; Flat-four engine; V6 engine; Crankshaft].

Among inline fours of the period the angles never changed. What changed was the support and the balancing:

- **Three main bearings** — older and cheaper engines:
  - BMC A-series for its whole life, 1951–2000 (a five-bearing study was dropped because the three-bearing crank had
    proven reliable) [SRC: Wikipedia, BMC A-series engine];
  - Škoda 1000 MB (1964) and its successors until 2003 [SRC: auto.cz];
  - the first Ford Kent of 1340 cc [SRC: gomog.com];
  - MGB engines 18G/18GA, 1962–1964 [SRC: mgocspares.co.uk];
  - Fiat 100-series (850, 127, Panda 45, Uno 45) [SRC: Wikipedia, Fiat 100 series engine].
- **Five main bearings** — became the standard during the 1960s:
  - Ford Kent 1498 cc [SRC: gomog.com];
  - MGB 18GB from October 1964 [SRC: mgocspares.co.uk];
  - BMW M10, 1962–1988, forged crank with counterweights [SRC: Wikipedia, BMW M10];
  - Toyota 3S, from 1984 [SRC: see section 4].
- **Counterweights** — four or eight. Eight relieve the bearings more; four save mass (1.42 kg in a 2.2 l engine
  studied by SAE in 2008) [SRC: SAE 2008-01-0088].

## 4. What the model corresponds to

The engine follows the **Toyota 3S-GE** (produced from May 1984):

| Item | Model | Toyota 3S | Source |
|---|---|---|---|
| Bore × stroke | 86 × 86 mm | 86 × 86 mm | [SRC] Wikipedia, Toyota S engine |
| Main bearings | 5 | 5 | [SRC] same |
| Counterweights | 8 | 8 | [SRC] same |
| Material | — | forged (3S-GE); cast iron (3S-FE) | [SRC] Wikipedia; toyota-club.net |
| Main journal / crankpin | 55 / 48 mm | 55 / 48 mm (3S-FE of 1986) | [SRC] toyota-club.net |
| Width of main bearings | all 22 mm | middle one wider (19 / 23 mm) | [SRC] toyota-club.net |
| Firing order | 1-3-4-2 | 1-3-4-2 | [KNOW] |
| Cam drive | toothed belt | one belt drives both camshafts | [SRC] Wikipedia |

Findings:

- **One deviation on the crank:** the real crank has a wider middle main bearing; the model draws all five alike.
- **Uncertain pin diameter:** for the 1990 version of the 3S-FE the source reports an increase "from 48 to 52 mm"
  without saying which journal. The 48 mm pin therefore applies to the earlier type.
- **Now sourced:** the number of main bearings and counterweights was tagged as an estimate in `src/spec.js` and
  `docs/research.md`; both are confirmed.
- **Valve data are later:** the valve-lift and valve-angle figures in `docs/research.md` come from the fourth
  generation of the 3S-GE (after 1997).

The gearbox uses the ratios of the **Toyota W58** (3.285 / 1.894 / 1.275 / 1.000 / 0.783, reverse 3.768), fitted to
the Supra A60/A70/A80, US Celica 1982–1985, Cressida X70, Soarer Z20, Lotus Excel and Lexus SC300 [SRC: Wikipedia,
Toyota W transmission]. No car appears on the application lists of both the 3S-GE and the W58, so the model is a
composite and does not reproduce one production car.

Not confirmed: as far as is known the 3S-GE sat transversely in the Celica and MR2 and longitudinally with rear-wheel
drive only in the 1998 Altezza [KNOW]. One source found claims the MR2 was longitudinal, so this stays open.

## 5. Comparison: Fiat 850 Sport Coupé

The Fiat has the same 180° crank layout but is otherwise a completely different engine.

| | Fiat 850 Sport Coupé | Model |
|---|---|---|
| Engine | inline four, 903 cc, Fiat 100 series (code 100GBC.000) | inline four, 1998 cc |
| Bore × stroke | 65 × 68 mm | 86 × 86 mm |
| Crank main bearings | 3 | 5 |
| Valve train | OHV, camshaft in the block driven by chain, 2 valves per cylinder | DOHC 16V, toothed belt |
| Power | 52 PS (38 kW) | — |
| Position | rear engine, rear-wheel drive | front, longitudinal |
| Gearbox | four-speed | five-speed, three-shaft |

[SRC: Wikipedia, Fiat 850; Fiat 100 series engine; carbaze.com]

- **Direction of rotation:** the Fiat 850 engine turns the opposite way to most engines, anticlockwise seen from the
  timing-chain end; the model turns clockwise seen from the front [WEAK: fiatforum.com post; an engine list that
  marks the 850 unit as "inverted rotation"]. No workshop manual was found.
- **Year:** production of the coupés ended in 1971 and the 903 cc Sport Coupé was made from 1968 [SRC: Wikipedia,
  Fiat 850]. A car dated 1972 is most likely a later registration.
- **Not found:** number of counterweights and the firing order (with a 180° crank only 1-3-4-2 or 1-2-4-3 are
  possible [SRC: cowdery.org.uk]).

## Sources

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
- [Fiat 850 Sport Coupé specifications (carbaze.com)](https://carbaze.com/car-4284/fiat-850-sport-coup%C3%A9)
- [Engine swap 903cc in a 600D (fiatforum.com)](https://www.fiatforum.com/threads/engine-swap-903cc-in-a-600d.194341/latest)
