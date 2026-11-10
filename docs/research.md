# Research: Inline-4 engine + flywheel/clutch + 5-speed manual gearbox (longitudinal, 3-shaft)

Purpose: concrete, sourced numbers and exact sequences for a procedural Three.js model with automated tests.

## 0. How to read this document (provenance tags)

Many web pages were fetched, but most specific mechanical dimensions (rod length, journals, clutch travel, tooth counts) are NOT published on open web pages; they live in factory service manuals. Every fact is therefore tagged:

- **[SRC]** = seen in a fetched/searched web source (URL given).
- **[SRC-WEAK]** = seen only on a forum, aftermarket-parts listing or aggregator; treat as +/- few %.
- **[KNOW]** = standard engineering knowledge, NOT re-verified on a fetched page in this session (textbook-level; reliable in form, numbers are typical).
- **ESTIMATE** = my own choice/derivation for the model. Use as a design value, not as a "real" spec.

Honest summary of verification gaps is in section 10.

Key URLs used:
- Wikipedia Toyota S engine: https://en.wikipedia.org/wiki/Toyota_S_engine
- Motorreviewer 3S-GE: https://www.motorreviewer.com/engine.php?engine_id=151
- Motorreviewer K20A: https://motorreviewer.com/engine.php?engine_id=163
- Wikipedia Honda K engine: https://en.wikipedia.org/wiki/Honda_K_engine
- Toyota 3S-GE repair manual (manualslib, journal figures): https://www.manualslib.com/manual/1310366/Toyota-3s-Ge.html?page=160
- JE piston kit for 3S-GE BEAMS (compression height 1.331 in): https://atomic-shop.ua/en/products/je-361465-piston-kit-86-00-mm-bore-1-331-in-ch-1-50-cc-for-toyota-3s-ge-beams-engine
- JE piston set 3S-GTE (1.378 in CD, 0.866 in pin): https://www.jegs.com/i/je-pistons-532-298703-298703-piston-set-toyota-3s-gte-inv-dome-dish-3-425-bore-1-378-cd-0-866-pin-set-of-4
- Manley 3S-GTE rod 5.428 in: https://www.manleyperformance.com/?p=233776
- Wikipedia Piston motion equations: https://en.wikipedia.org/wiki/Piston_motion_equations
- Wikipedia Four-stroke engine: https://en.wikipedia.org/wiki/Four-stroke_engine
- Wikipedia Toyota W transmission: https://en.wikipedia.org/wiki/Toyota_W_transmission
- Toymods W58 tooth counts thread: https://www.toymods.org.au/forums/threads/1148-Verifying-a-w58-gearbox
- Getrag 265 ratios (forum): https://e9coupe.com/forum/threads/getrag-265-ratios.8986
- Wikipedia Manual transmission: https://en.wikipedia.org/wiki/Manual_transmission
- Wikipedia Synchromesh: https://en.wikipedia.org/wiki/Synchromesh
- Synchro cone half-angle, 150-400 ms: https://www.firgelliauto.com/blogs/mechanisms/synchromesh
- SAE 2004-01-1230 "Synchronizer Design: A Mathematical and Dimensional Treatise": https://saemobilus.sae.org/papers/synchronizer-design-a-mathematical-dimensional-treatise-2004-01-1230
- Saab 9-5 clutch data (driven plate OD 240/250 mm): https://saabwisonline.com/9-5-9650/2010/4-transmission/clutch-system/technical-data/general-specifications
- Diaphragm clutch patents (release travel / 2 mm plate displacement reference): https://patents.google.com/patent/US4326611 , https://patents.google.com/patent/US5074395A/esLanguage
- Undercut / min teeth 17: https://tec-science.com/?p=6265
- Wikipedia Clutch: https://en.wikipedia.org/wiki/Clutch

---

## 1. ENGINE GEOMETRY (reference engine)

### 1.1 Choice of reference engine: Toyota 3S-GE "Gen 4 / Red Top" (1998 cc, DOHC 16V, 86 x 86 mm)

Why not Honda K20A: K20A uses roller rocker arms (not bucket tappets) and i-VTEC with three-lobe cams, which complicates the model; the task asks for bucket tappets. Toyota 3S-GE uses direct-acting bucket tappets with outer shims (Wikipedia: "Outer Shim Type System", https://en.wikipedia.org/wiki/Toyota_S_engine). K20A numbers are listed in 1.4 as a cross-check.

Reality check: no single open source gives the complete list asked for. Numbers below are tagged. A geometric consistency check is included (deck height).

| Parameter | Value | Tag / source |
|---|---|---|
| Bore | 86.0 mm | [SRC] Wikipedia Toyota S engine; Motorreviewer 3S-GE |
| Stroke | 86.0 mm (square) | [SRC] same |
| Displacement | 1998 cc | [SRC] same |
| Compression ratio | Gen1 9.2, Gen2 10.0, Gen3 10.3, Gen4 11.0, Gen5 11.5 : 1. Use 11.0 | [SRC] Wikipedia Toyota S engine |
| Connecting rod c-c length | about 138 mm (5.43 in). Aftermarket 3S-GTE rods 5.428 in = 137.9 mm; forum says OEM 138 mm | [SRC-WEAK] Manley listing; forum summary. Rod/stroke = 138/86 = 1.60 |
| Piston compression height (pin centre to crown) | 33.8 mm (1.331 in) for 3S-GE BEAMS; 35.0 mm (1.378 in) for 3S-GTE | [SRC-WEAK] JE listings (aftermarket) |
| Block deck height (crank axis to deck) | about 215-216 mm. Geometric check: 43 + 138 + 33.8 = 214.8 (GE); 43 + 137.9 + 35 = 215.9 (GTE; Wiseco lists 216 mm block height for 3S-GTE) | derived from [SRC-WEAK]; ESTIMATE for GE (piston sits ~0 mm to -0.5 mm below deck at TDC) |
| Piston pin diameter | 22.0 mm (0.866 in) | [SRC-WEAK] JE/Eagle 3S-GTE listings |
| Main journal diameter | 55.0 mm (54.985-55.000) | [SRC-WEAK] Toyota 3S-GE repair manual snippet (manualslib p.160-175). Conflict: a stroker-crank listing shows the numbers swapped (48/55) |
| Crankpin (rod journal) diameter | 48.0 mm (47.985-48.000) | [SRC-WEAK] same |
| Bore spacing (cylinder centre distance) | about 94-96 mm | ESTIMATE. Not found. 96 mm gives 10 mm between bores (typical siamesed block). Geometry check: 4 x 96 = 384 mm block length |
| Main bearings | 5 | [KNOW] (3S-GE has 5 mains; not re-verified) |
| Counterweights | 8 (one each side of every throw, forming 4 "pairs") | [KNOW]/ESTIMATE; some inline-4s have 4 only. Model value 8 |
| Intake valve head diameter | 34.5 mm (Gen2-4; Gen1 33.5; Gen5 MT 35) | [SRC] Wikipedia Toyota S engine; Motorreviewer |
| Exhaust valve head diameter | 29.5 mm (Gen1 29.0) | [SRC] same |
| Valve stem diameter | 5.5-6.0 mm (not found). Use 5.5 mm | ESTIMATE (K20A stem = 5.5 mm [SRC-WEAK] Motorreviewer K20A) |
| Included valve angle | Gen4 22.5 deg; Gen1 25 deg | [SRC] Motorreviewer 3S-GE. (One site lists "44.5 deg" - different convention, probably angle between valve axis and... unclear; ignore) |
| Max valve lift Intake / Exhaust | Gen4 8.56 mm / 8.31 mm (Gen2 8.5/8.5; Gen3 manual 9.8/8.2) | [SRC] Motorreviewer 3S-GE |
| Cam duration (adv.) | Gen4 248 / 248 deg (manufacturer-style advertised) | [SRC] Motorreviewer |
| Bucket tappet (lifter) outer diameter | about 31.0 mm (30.975-30.985) | [SRC-WEAK] one 3S-GTE data sheet; garbled bore range |
| Cam base circle diameter | not published | ESTIMATE 28 mm (lobe nose radius = base radius + 8.56 mm lift for a direct bucket, since no rocker ratio; i.e. nose diameter = 28 + 2 x 8.56 = 45.1 mm). Must stay < tappet OD x ~1.4 or the lobe will not fit over the bucket |
| Cam lobe lift | = valve lift (direct bucket, ratio 1:1) | [KNOW] |
| Spark plug position | Centre of the pent-roof chamber, between the 2 intake and 2 exhaust valves, plug axis near cylinder axis (slightly tilted); plug in a deep well in the cam cover | [KNOW] |
| Valve clearance (cold) | intake about 0.15-0.25 mm, exhaust 0.25-0.35 mm for Toyota shim type (not verified for 3S-GE) | [KNOW]/ESTIMATE |

Derived numbers worth testing: crank radius r = 43.0 mm; rod ratio l/r = 3.209; piston stroke 86.0 mm; clearance volume per cylinder = Vd/(CR-1) = 499.5 cc/10 = 49.95 cc.

Valve layout geometry (ESTIMATE-derived): for a 22.5 deg included angle each valve axis leans 11.25 deg from the cylinder axis; valve stems diverge toward the head chamber (stem tips lean away from each other upward only in the sense that the intake stem tips lean to the intake side, exhaust to the exhaust side). Derive cam axis spacing in code from tilt and valve length (ESTIMATE valve length ~ 100 mm).

### 1.2 Slider-crank exact formulas (SOURCED: Wikipedia Piston motion equations)

Notation: r = crank radius (stroke/2), l = rod centre-to-centre, theta = crank angle measured from TDC (0 at TDC, rotation direction positive), omega = 2*pi*rpm/60, no piston-pin offset. x = distance from crank axis to piston pin axis.

- Position: `x(theta) = r*cos(theta) + sqrt(l^2 - r^2*sin^2(theta))`
- Piston height from TDC (positive down): `s(theta) = (r + l) - x(theta)`
- Velocity: `v = dx/dt = -r*omega*sin(theta) * (1 + r*cos(theta)/sqrt(l^2 - r^2*sin^2(theta)))`
  (derived from x(theta); equals `-r*w*(sin(theta) + (r/2)*sin(2theta)/sqrt(l^2 - r^2 sin^2 theta))`)
- Acceleration: `a = d2x/dt2 = -r*omega^2*(cos(theta) + r*cos(2*theta)/sqrt(l^2 - r^2 sin^2 theta) + r^3*sin^2(theta)*cos^2(theta)/(l^2 - r^2 sin^2 theta)^(3/2))`
  Approximation for l/r > 3: `a ~ -r*omega^2*(cos(theta) + (r/l)*cos(2*theta))`.
- Connecting-rod angle phi: `sin(phi) = (r/l)*sin(theta)`; max rod swing = asin(43/138) = 18.2 deg at theta = 90/270 deg.
- Crank pin position (for animation): `(r*sin(theta), r*cos(theta))` relative to crank axis in the plane of the cylinder axis (cylinder axis = y). Rod small end at (0, x); big end must be exactly l from small end (testable invariant: |pin - bigend| == 138 mm).
- Facts for tests: piston at TDC -> x = r + l = 181.0 mm; at BDC x = l - r = 95.0 mm; max piston speed does NOT occur at theta = 90 deg; for l/r = 3.21 it occurs at about 71-72 deg ATDC (Wikipedia says velocity maxima are not at the perpendicular crank/rod position). Piston at 90 deg is below mid-stroke: s(90) = r + l - sqrt(l^2 - r^2) = 43 + 138 - 131.1 = 49.9 mm (i.e., 58 % of the stroke is covered in the first 90 deg). Mean piston speed = 2*S*N = 2 x 0.086 x N/60; at 7000 rpm = 20.07 m/s.

### 1.3 Reference engine: why 3S-GE
- Square 86 x 86, many published aftermarket parts (JE, Manley, Eagle) allow derivation of rod/piston/deck consistency.
- Bucket tappet with outer shim.
- Conflict between engines: K20A has deck height 212 mm [SRC Wikipedia Honda K engine] and rod 139 mm [SRC-WEAK aftermarket 5.470 in], so both engines sit at deck ~212-216 mm.

### 1.4 Cross-check: Honda K20A (for comparison, not used)
Bore 86.0, stroke 85.9-86.0, intake valve 35 mm, exhaust 30 mm, stem 5.5 mm [SRC Motorreviewer K20A]. Deck height 212 mm [SRC Wikipedia Honda K engine]. Rod about 139 mm (5.47 in) [SRC-WEAK aftermarket; other listings show 5.74 in/145.8 mm and 147 mm - conflict, those may be K24 rods]. CR 9.6-11.7 depending on model. K20A2 cam duration/lift e.g. 238/240 deg and 7.36/7.14 mm low profile; 278/280 deg and 12.42/11.12 mm VTEC (conflicting numbers on Motorreviewer: 244/240, 8.84/8.59 and 280/278, 12.65/12.14 - sources disagree by 0.2-0.5 mm).

---

## 2. FOUR-STROKE CYCLE AND TIMING

### 2.1 Stroke order [SRC Wikipedia Four-stroke engine]
Intake -> compression -> power (combustion/expansion) -> exhaust. One cycle = 720 deg crank = 2 revolutions = 1 camshaft revolution. Valve events below are in crank degrees.

Idealised stroke boundaries: intake 0-180 (TDC -> BDC), compression 180-360 (BDC -> TDC), power 360-540 (TDC -> BDC), exhaust 540-720 (BDC -> TDC), measured in the cylinder's own cycle angle (cycle angle 0 = gas-exchange TDC start of intake). In the table of 2.4 cycle angle is shifted so cylinder 1 fires at 0.

### 2.2 Valve timing for a mild road cam (typical, [KNOW]; the model uses ESTIMATE values consistent with the 3S-GE Gen4 advertised 248 deg duration [SRC Motorreviewer])

Model values (ESTIMATE, symmetric lobes, 248 deg crank duration, 1 mm-lift-ramp ignored):

| Event | Crank angle | Note |
|---|---|---|
| IVO (intake opens) | 10 deg BTDC (gas-exchange TDC) | typical road range 5-20 BTDC |
| IVC (intake closes) | 58 deg ABDC | 10 + 180 + 58 = 248 deg. typical range 40-65 ABDC |
| EVO (exhaust opens) | 58 deg BBDC | typical 40-65 BBDC |
| EVC (exhaust closes) | 10 deg ATDC | typical 3-20 ATDC |
| Overlap (IVO to EVC) | 20 deg crank | typical road 10-40; both valves open at gas-exchange TDC |

Max-lift points (symmetric lobe): intake at 114 deg ATDC (crank) = IVO(-10) + 124, exhaust at 114 deg BTDC. In cam degrees: 57 deg after TDC for intake... use crank degrees consistently in code.

Lobe separation angle (LSA): angle between intake and exhaust lobe centrelines measured in CAM degrees = (intake centreline ATDC + exhaust centreline BTDC)/2 with both in crank degrees = (114 + 114)/2 = 114 deg (cam degrees; the lobes are 114 deg apart on the cam, 228 deg in crank terms). Typical road 108-114, race 104-110.
Relationships: intake centreline (crank deg ATDC) = duration/2 - IVO = 124 - 10 = 114; exhaust centreline (BTDC) = duration/2 - EVC = 124 - 10 = 114; IVO = 124 - ICL, IVC = ICL + 124 - 180... formula check: IVC (ABDC) = ICL - 180 + duration/2... hmm: IVC angle ATDC = ICL + 124 = 238 deg ATDC = 58 deg ABDC. OK.
Advertised duration is measured at a small lift (typ. 0.3-1 mm); duration at 1 mm (0.040 in) lift is typically 20-30 deg shorter (so real "effective" opening is shorter).

Cam lobe angular width on the cam = duration/2 = 124 deg of cam rotation.

### 2.3 Ignition, pressure, temperature, rpm [KNOW]; no single sourced table
- Spark advance (BTDC): idle 8-15 deg (3S-GE idle about 10 BTDC, ESTIMATE); part load 25-40; WOT mid-range 20-30; high rpm WOT 28-38. Wikipedia: advance increases with rpm [SRC Wikipedia Four-stroke engine] but gives no numbers. Spark is NEVER at exactly TDC except by coincidence at start-up cranking.
- Peak cylinder pressure occurs about 10-16 deg ATDC (best-torque combustion phasing: 50 % mass burned ~ 8-10 deg ATDC). Typical NA road engine peak: 40-70 bar at full load (up to ~100 bar boosted).
- Peak gas temperature: 2200-2800 K around 10-20 deg ATDC. Exhaust gas leaving: 700-1000 deg C.
- rpm: idle 700-900 (ESTIMATE 800); redline for 3S-GE Gen 4 about 7600-7800 rpm (ESTIMATE; fuel cut). Use 7500 rpm.
- Compression pressure at cranking about 12-14 bar for CR 11 (ESTIMATE).

### 2.4 Firing order 1-3-4-2 (cylinder 1 at the front/timing-belt end), crank 0 = cyl 1 at TDC firing

Firing interval 180 deg. Cycle angle 0-720 starting at cyl 1 TDC firing.

| Crank angle | Cyl 1 | Cyl 2 | Cyl 3 | Cyl 4 |
|---|---|---|---|---|
| 0 - 180 | Power | Exhaust | Compression | Intake |
| 180 - 360 | Exhaust | Intake | Power | Compression |
| 360 - 540 | Intake | Compression | Exhaust | Power |
| 540 - 720 | Compression | Power | Intake | Exhaust |

Firing events: cyl 1 at 0, cyl 3 at 180, cyl 4 at 360, cyl 2 at 540. Verified by construction: each column cycles Power -> Exhaust -> Intake -> Compression -> Power (in time).
Piston positions at 0: cyl 1 and 4 at TDC (cyl 1 end of compression = firing TDC; cyl 4 at gas-exchange TDC = end of exhaust/start of intake, valves in overlap!), cyl 2 and 3 at BDC (cyl 2 end of exhaust 0->... check: cyl 2 is in exhaust 0-180: begins at BDC (end of power) - correct; cyl 3 in compression starts at BDC - correct). At 180: cyl 2 and 3 at TDC (cyl 3 firing, cyl 2 gas exchange), cyl 1 and 4 at BDC. Always cyl 1+4 together, 2+3 together.

### 2.5 Crankshaft throw arrangement (flat-plane inline-4)
Four throws in one plane: throws 1 and 4 at 0 deg, throws 2 and 3 at 180 deg. Pistons 1 and 4 rise and fall together; 2 and 3 together, opposite to 1/4. Crank order 1-2-3-4 from front; firing order 1-3-4-2. Primary forces balance (sum of reciprocating masses cancels at first order); second-order (2x rpm) vertical shake remains, which balance shafts cancel in some engines (3S-GE has none; ESTIMATE/[KNOW]).

### 2.6 Camshaft drive
- Camshaft speed = 1/2 crank speed; cam sprocket has 2x the teeth of the crank sprocket (2:1). Crank sprocket 20 teeth (ESTIMATE; typical 19-24) -> cam sprocket 40 (typical belt 38-44 per Toyota; ESTIMATE). Both timing-belt (3S-GE) engines: belt teeth count about 100-140 (ESTIMATE, not needed).
- Direction: with a toothed belt/chain wrapped around both sprockets (not crossed), the cams rotate the SAME direction as the crankshaft. Gear-driven or idler-reversed arrangements are the exception. [KNOW] (Wikipedia gives only the 1/2 ratio).
- Engine rotation: SAE standard = counter-clockwise viewed from the flywheel end (so clockwise viewed from the belt/front end) [KNOW]. Use that.
- Twin cams (DOHC): both cams turn at 0.5x crank speed. In the real 3S-GE the belt drives the exhaust cam and a gear drives the intake cam (so they turn in opposite directions) [KNOW, unverified]. Model recommendation: both cams the same direction as the crank (simplest: one belt wrapping both sprockets).
- Cam lobe phasing (for the model): lobe angle on the cam = crank-degree event / 2. Cylinder 1 (crank 0 = firing TDC): gas-exchange TDC is at crank 360. IVO = 350, intake peak = 360 + 114 = 474, IVC = 360 + 238 = 598; EVO = 180 - 58 + ... = 122 (58 BBDC where BDC = 540-... use power-stroke end 180 -> EVO at 122), exhaust peak at 360 - 114 = 246, EVC = 370. General rule: event crank angle = (cylinder gas-exchange TDC) + (event offset), mod 720, with gas-exchange TDC = 360 (cyl 1), 540 (cyl 3), 0 (cyl 4), 180 (cyl 2). Cam angle = crank angle / 2. (ESTIMATE; test: intake and exhaust both open for 20 crank degrees around each cylinder's gas-exchange TDC.)

---

## 3. FLYWHEEL AND CLUTCH

### 3.1 Component stack, front to back (engine -> gearbox)
1. Crankshaft rear flange (6 or 8 bolts, one-way or asymmetric dowel pattern) carries the **flywheel** (bolted).
2. Flywheel front face = friction surface; pressed-on/shrunk **starter ring gear** on its rim (outside, on the engine side).
3. **Pilot bearing / bushing** pressed into the centre of the crank flange or flywheel; supports the tip of the gearbox input shaft (spigot).
4. **Friction disc (driven plate)**: steel centre plate with torsion-damper springs (6-8 coil springs, 4 for small discs) and a pre-damper, splined hub that slides on the input-shaft splines; friction linings riveted on cushion segments (wavy springs) on both sides. NOT bolted to the flywheel.
5. **Pressure plate** (cast iron ring, rotates with the engine) sits behind the disc.
6. **Diaphragm spring** (conical Belleville spring with radial fingers) inside the **clutch cover** (stamped steel); cover bolted to the flywheel (6 bolts + 2 dowels, positioned on the flywheel rim). Pressure plate is connected to the cover by 3 (or 4) tangential strap springs (leaf springs) that carry torque and retract the plate on release. Diaphragm rests on pivot rings (fulcrum rings, riveted studs) in the cover; its outer rim presses on the plate.
7. **Release (throw-out) bearing**: sealed ball bearing on a guide sleeve (bearing retainer tube) at the front of the gearbox; the guide sleeve is part of the transmission front cover. The rotating side contacts the diaphragm finger tips.
8. **Release fork** pivots on a ball stud in the bellhousing; the slave cylinder (hydraulic) or cable pushes the outer end; the inner end pushes the bearing toward the engine. Or concentric slave cylinder (CSC) has the bearing built-in around the input shaft.
9. Gearbox **input shaft** (clutch shaft) with splines carries the disc; front tip rides in the pilot bearing; rear in the gearbox housing.

Rotates with engine: crankshaft, flywheel, ring gear, clutch cover, pressure plate, diaphragm spring, straps, front half of the release-bearing (fingers contact). Rotates with gearbox input shaft: friction disc, input shaft, input gear, and (by constant mesh) the countershaft cluster. Stationary: bellhousing, release fork, guide sleeve, release bearing outer race (non-rotating race touches the fork); bearing inner race rotates only when pushed against the spinning fingers (clutch pedal depressed).

Wikipedia (https://en.wikipedia.org/wiki/Clutch) confirms: friction disc pressed against flywheel by springs, flywheel face is a driving plate, clutch bolts to flywheel face, push-type vs pull-type, and torsion springs on the disc. No dimensions given.

### 3.2 Release sequence for push-type diaphragm (typical car) [KNOW; patents confirm finger travel releases plate]
- Engaged (pedal up): diaphragm cone preloaded flat-ish; outer rim pushes the pressure plate toward the flywheel (axial clamp force typ. 4-8 kN for 2.0 L). Torque capacity = mu x F x Rm x 2 faces, mu about 0.3-0.4.
- Pedal pressed: fork pushes bearing **toward the engine (forward)** by about 8-10 mm [KNOW/ESTIMATE; no hard source found]; bearing pushes diaphragm finger tips toward the flywheel. The diaphragm pivots about its fulcrum ring: finger tips move toward the engine, the outer rim moves **away from the flywheel (toward the gearbox)**; the rim pulls the plate rearward via the tangential straps/lifting tabs. Pressure plate lift = about 1.5-2.0 mm in total [KNOW; patent US5074395A uses 2 mm displacement as reference] giving the disc free clearance (~0.2-0.5 mm per side plus facing spring release).
- Leverage: finger-tip travel / plate lift = lever ratio of about 4-5.5 (distance fulcrum->fingertip vs fulcrum->rim) so 1.5-2.0 mm lift needs 7-10 mm tip travel. Consistent with typical 8-10 mm [ESTIMATE; derived]. Add the free play (1-3 mm at bearing, ~ 10 mm at pedal pad).
- Pull-type is the reverse: release bearing is pulled **toward the gearbox**; the diaphragm pivots on the cover rim ring. Not modeled.
- Clutch disc damper travel: torsion springs allow +/- 10-15 deg of relative rotation between friction rings and hub (ESTIMATE).

### 3.3 Typical dimensions (2.0 L, ~100-140 kW car) - ranges
| Item | Value | Tag |
|---|---|---|
| Friction disc OD | 225-240 mm (Saab 9-5 2.3T FWD 240 mm) | [SRC] Saab WIS above; ESTIMATE 225 for model |
| Friction disc ID (lining) | 150-155 mm (OD/ID ~ 1.45-1.55) | ESTIMATE |
| Disc hub spline | 10-24 splines, 20-26 mm major diameter; 21 splines typical | ESTIMATE |
| Friction lining thickness | 3.5 mm each, disc thickness total about 7.5-8.5 mm new | ESTIMATE |
| Flywheel outer diameter (friction face) | about 235-250 mm; overall incl. ring gear about 300-320 mm | ESTIMATE |
| Flywheel thickness | 25-35 mm; mass 6-9 kg (single mass) | ESTIMATE |
| Ring gear teeth | 123-135 for typical 2.0 L (Japanese 3S: ~132 reported by some parts catalogues, unverified) | ESTIMATE use 132; starter pinion 9-10 teeth |
| Starter ring module | module 2.25 x 132 teeth -> PCD 297 mm (consistent with 300 mm overall) | ESTIMATE |
| Cover bolts | 6 | [KNOW] |
| Pilot bearing | 15 x 32 x 9 mm bushing/ball bearing | ESTIMATE |

---

## 4. GEARBOX LAYOUT

### 4.1 Real gearboxes surveyed
Source quality for tooth counts is poor; only the Toyota W58 has partial tooth data (anecdotal forum). Two real boxes:

**A. Toyota W58 (Supra/Soarer, 5-speed, longitudinal)** - ratios [SRC Wikipedia Toyota W transmission]:
1st 3.285, 2nd 1.894, 3rd 1.275, 4th 1.000, 5th 0.783, Reverse 3.768. (W55: 3.566/2.056/1.384/1.000/0.850, R 4.091; W57: same as W58 except 5th 0.861.) W57/W58 differ from W55 by changing the input-to-countershaft ratio by 7.9 % (Wikipedia). W55-W59 are "externally and internally very similar aside from gear ratios".
Tooth counts [SRC-WEAK, forum post by an individual, 2005, "from personal experience"]: input pair 34 (input shaft) / 46 (countershaft) -> 1.353; 5th pair listed as 57 (mainshaft?) and 33 (layshaft?) with 33/57 = 0.579, 1.353 x 0.579 = 0.783 = W58 5th. **Note**: an overdrive requires the mainshaft gear to be SMALLER than the countershaft gear; the post's labelling is therefore reversed (correct: countershaft 57, mainshaft 33). Sum 90 vs input pair sum 80: different centre-distance equation for each pair is possible only with different module/helix, so this is plausible only because 5th has different helix/profile shift. Flag it.
Derived needed second-stage ratios: 1st 2.428, 2nd 1.400, 3rd 0.942, 5th 0.579, reverse 2.785.

**B. Getrag 265/5 (BMW E30/E28/E24 etc.)** - close-ratio ("CR", dogleg 1st) ratios [SRC-WEAK, e9coupe forum threads]: 1st 3.72, 2nd 2.40, 3rd 1.77, 4th 1.26, 5th 1.00 (direct in 5th, NO overdrive), R 4.23 (the sources report R 4.23 only for CR). Overdrive version "265/6" listed 3.82, 2.2, 1.4, 1.00, 0.81 (4th direct). Getrag 260 listed on Wikipedia (applications BMW E28/E30/E34, Holden, Cadillac CTS) but no ratios (Wikipedia Getrag 260 page).
Tooth counts and centre distances: NOT FOUND for either box.

C. Mazda MX-5 M15M-D: not verifiable here. Ratios commonly quoted 3.136, 1.888, 1.330, 1.000, 0.814, R 3.758 [KNOW, UNVERIFIED]. Search found only a note that the code changed from "M-type" to M15M-D in 1993 and that NB (Y16M-D) shares design with RX-8 box. Don't use as a test reference.
D. Borg-Warner T-5: first gear 2.95 (STD) or 3.35-3.97 (World Class), 3.75-4.10 (small-engine STD) [SRC Wikipedia T-5]; other ratios not fetched. Commonly quoted WC: 3.35/1.93/1.29/1.00/0.80, R 3.15 [KNOW, UNVERIFIED].

### 4.2 Common layout of these boxes (3-shaft, longitudinal, rear-wheel-drive) [KNOW; consistent with Wikipedia Manual transmission 3-shaft description]
Front (engine side) -> rear (output side):
- **Input shaft** (clutch shaft): enters from the front bellhousing, ends in a drive gear (constant-mesh gear, helical, 34 teeth on W58) and **dog teeth + cone** on its rear face for 4th. A pilot bore at its rear end holds the needle bearing that supports the front end of the mainshaft.
- **Countershaft / layshaft**: below (offset) the main axis; a single cluster of fixed gears (cut on or pressed/splined on the countershaft): constant-mesh drive gear (46 T) at the front, then gears for 3rd, 2nd, 1st, reverse, and 5th at the rear.
- **Mainshaft / output shaft**: coaxial with the input shaft, supported front by the needle roller bearing inside the input shaft and rear by a bearing in the rear case/extension housing. It carries free-spinning (on needle bearings) gears for 3rd, 2nd, 1st, 5th and the hubs.

Gear order on the mainshaft, front to rear (typical): [input gear + 4th dog] | **3-4 synchro hub** | 3rd | 2nd | **1-2 synchro hub** | 1st | (reverse gear, often cut as spur teeth on the 1-2 sleeve outer diameter or as a gear on the 1st-gear hub) | centre bearing wall | 5th (overdrive) | **5th synchro hub** (some boxes pair 5th with reverse: 5-R hub; others put 5th gear and synchro on the layshaft's tail). The exact position of 5th: W58 and T-5 have 5th behind the rear intermediate wall in the extension housing [KNOW, not confirmed in fetched pages]. The user's candidate "5-R" hub is a variant (some boxes, e.g., ZS S5-31, have reverse engagement on the 5/R sleeve) - not verified.

Which gears are fixed vs free:
- Countershaft: all gears fixed (rotate together at one speed).
- Mainshaft: 1st, 2nd, 3rd, 5th gears free on needle bearings (rotate at their own speed except when locked); the three synchro hubs are splined (fixed) to the mainshaft, sleeves slide on the hubs.
- Input shaft: its gear is fixed to it.

### 4.3 Power flow per gear (clutch engaged, engine turning; rotation direction E = engine direction)
Gear ratio total = (input gear -> countershaft) x (countershaft gear -> mainshaft gear).
- **Neutral**: no sleeve engaged. Input shaft (E) -> input gear -> drives the countershaft cluster (opposite direction, -E) -> via constant mesh drives ALL free gears on the mainshaft (3rd, 2nd, 1st, 5th rotate in direction +E at engine speed x their individual ratio, e.g. 1st free gear at 1/3.35 of engine speed). The mainshaft itself (output) does not receive torque (only drag via needle bearings), so it stays still with the wheels. Oil splash lubricates; neutral "whine/rattle" arises from these spinning gears.
- **1st**: sleeve of 1-2 hub slides rearward and locks 1st gear to the mainshaft: input -> input gear (34) -> countershaft gear (46) -> 1st countershaft gear -> 1st mainshaft gear -> dogs -> sleeve -> hub -> mainshaft. Output direction = E (two meshes). Ratio 3.285 (W58).
- **2nd**: 1-2 sleeve slides forward, locks 2nd gear. 3rd: 3-4 sleeve slides rearward locks 3rd. 5th: 5th sleeve slides to lock 5th.
- **4th**: 3-4 sleeve slides forward and engages the dog teeth on the input shaft: input shaft locked directly to mainshaft through hub; torque goes straight through (ratio 1.000). The countershaft gear train still spins (idle), no load. No power passes through the countershaft.
- **5th (overdrive)**: as 1st-3rd but ratio less than 1: input -> countershaft -> 5th pair (countershaft gear 57, mainshaft gear 33 on W58) -> mainshaft; speed = 1/1.353 x 57/33... = engine speed x 0.783.
- **Reverse**: reverse idler gear (a small spur on its own fixed shaft parallel to the others, slid by a fork) is moved into mesh between the countershaft reverse gear and the reverse gear on the mainshaft (or on the 1-2 sleeve). Three meshes in total (input pair, countershaft->idler, idler->main): output direction opposite to E. Ratio 3.768 on W58. The reverse gear on the mainshaft is fixed (cut into the sleeve or a gear splined to the hub) in the sliding-idler design; in a synchronised/constant-mesh design it is a free gear with a dog-engaged hub (e.g., on 5-R sleeve) - see 4.4.
Spin check: input shaft E; countershaft -E; mainshaft forward gears +E (two meshes); reverse -E (idler flips direction twice: countershaft -E -> idler +E -> main -E). Right: input +E, counter -E, idler +E, main -E.

### 4.4 Reverse implementations
- **Sliding spur idler** (older/economy boxes, e.g., Toyota W, VW 020, T-5 and many others) [KNOW]: spur (straight-cut) gears; fork slides the idler along a fixed shaft into mesh with a countershaft gear and a gear/sleeve teeth on the mainshaft while stationary; not synchronised (the user must stop). Causes whine, and the engagement can clash if gears are spinning (neutral at rest: countershaft spinning slowly via clutch drag - clutch disc brake is used: this is why one presses the clutch and waits ~1 s or selects 5th to stop the countershaft first).
- **Constant-mesh idler with synchro/dog engagement** (modern, e.g., BMW Getrag 5/6-speed, Mazda, Honda, ZF S5-31): reverse gears are helical and always meshed; reverse mainshaft gear is free and engaged by a dog sleeve (sometimes with a baulk ring). Detail unverified for the surveyed boxes.
Model recommendation: sliding idler variant (visibly instructive, mechanically simplest). Mark spur gears for reverse. Wikipedia Manual transmission confirms "Reverse: idler gear, typically sliding-mesh design with straight-cut spur gears, characteristic whine."

### 4.5 Centre distance and gear type
- Centre distance (mainshaft axis to countershaft axis) for 2.0 L-class boxes: about 65-85 mm (W58 value not found; BMW 260/265 boxes about 70-80 mm... unverified). ESTIMATE 76 mm.
- Forward gears: helical (constant mesh), helix angle typically 20-35 deg (ESTIMATE; no published value found), normal module 1.75-3.0. Reverse: spur (straight cut). [KNOW; Wikipedia Manual transmission mentions helical gears produce friction/gear oil additive context, spur reverse whine].
- Hand: the input gear and countershaft gear meshing: opposite hands; every pair (external parallel axes) has one right-hand and one left-hand gear. Typically one hand for all gears on the mainshaft and the opposite on the countershaft so that axial thrust of the cluster partially cancels.

### 4.6 Model gearbox: ESTIMATE tooth set (internally consistent, all pairs sum to 80, same normal module and helix => common centre distance)

Constant mesh pair (input / countershaft): 34 / 46 (from W58, [SRC-WEAK]) = 1.3529.
Second-stage pairs (countershaft teeth Zc, mainshaft teeth Zm):

| Gear | Zc | Zm | Total ratio | Target (W58) | Error |
|---|---|---|---|---|---|
| 1st | 23 | 57 | 1.3529 x 57/23 = 3.353 | 3.285 | +2.1 % |
| 2nd | 33 | 47 | 1.927 | 1.894 | +1.7 % |
| 3rd | 41 | 39 | 1.287 | 1.275 | +0.9 % |
| 4th | direct | direct | 1.000 | 1.000 | 0 |
| 5th | 51 | 29 | 0.7686 | 0.783 | -1.8 % |
| Reverse (countershaft 17 spur, idler 21 spur, mainshaft 47 spur) | 17 | 47 (idler ratio-neutral) | 1.3529 x 47/17 = 3.74 | 3.768 | -0.7 % |

Reverse idler: any tooth count (e.g. 21); it does not alter ratio, only direction; must be positioned so both meshes fit (its shaft is on a different axis; ESTIMATE the idler shaft sits between the countershaft and mainshaft axes below/aside). Reverse spur teeth module 2.25 (ESTIMATE): PCD countershaft gear 17 x 2.25 = 38.25, mainshaft 47 x 2.25 = 105.75, centre distance would be 72 mm - not equal to 76: because of idler, the sum rule does not apply between countershaft and mainshaft for reverse; the constraint is that idler meshes both: (dc + di)/2 and (di + dm)/2 centre distances must be achievable by placing the idler shaft - check geometrically (triangle inequality on the three axes).

Final drive and wheels are out of scope.

---

## 5. SYNCHRONIZER (Borg-Warner blocker ring type)

Sources: Wikipedia Synchromesh (components, sequence); cone half-angle 6-7.5 deg and 150-400 ms from Firgelli (https://www.firgelliauto.com/blogs/mechanisms/synchromesh); SAE paper 2004-01-1230 (title only). Specific dimensions otherwise [KNOW]/ESTIMATE.

### 5.1 Components (one double-acting synchronizer, e.g. the 3-4 unit)
1. **Hub** (synchro hub / clutch body): splined to the mainshaft (axially located by circlips/snap rings). Outer teeth (external splines) around its circumference; three axial slots in its outer surface carry the keys.
2. **Sleeve** (shift collar): internal splines meshing continuously with hub external splines; external circumferential groove for the shift fork; each tooth end chamfered (typ. included chamfer angle 90-120 deg, ESTIMATE); inner centre groove(s) for the strut detent.
3. **Struts / keys / inserts** (3 at 120 deg): small spring-loaded blocks in the hub slots; each has a central raised bump held in the sleeve's inner groove (detent) by a spring ring (garter spring / "spring clip") pressing each strut outward; struts push the blocker rings.
4. **Blocker (baulk) rings** (two, one each side, usually brass or steel with molybdenum coating): internal conical friction surface, external chamfered teeth (same pitch as sleeve teeth), and three notches into which the strut heads fit; the notches are wider than the strut heads by about half a tooth pitch to allow limited rotation (index).
5. **Gear cone** (synchronizer cone/"clutch body" on the gear): male cone on the side of each free gear, outside of that the **dog (clutch) teeth** (small external teeth, same count as the sleeve teeth), which the sleeve engages after passing through the blocker ring.

### 5.2 Engagement phases (selecting gear on the right side; gear speed != mainshaft speed)
0. **Neutral**: sleeve centred; struts' bumps sit in the sleeve's central groove; both blocker rings spaced off the cones (slight drag); gears free.
1. **Pre-synchronization (pre-sync)**: the fork pushes the sleeve axially (e.g. 3-4 mm). The sleeve drags the struts (through the detent) so the struts push the blocker ring axially until its cone touches the gear cone (cone clutch contact).
2. **Friction torque builds**: speed differences cause the friction cone to drag the blocker ring circumferentially, rotating it relative to the hub/sleeve until the notch in the ring contacts the strut head (the ring's rotation is limited by the notch width): the ring teeth are now **indexed half a tooth pitch** from the sleeve teeth - chamfers of sleeve and ring face each other, i.e. **blocking**.
3. **Blocking (synchronization)**: as the driver continues pushing, the sleeve chamfers press on the blocker ring chamfers; this produces an axial force that presses the cone harder (ring's torque from the cone = cone friction torque T_c = mu x F x R_m / sin(alpha); the index torque from the chamfer opposes the friction torque = F x R_t x tan(chamfer)... the sleeve cannot pass while T_cone > T_index). Speed difference of the gear vs. hub falls to zero. (Wikipedia: "blocker rings hold the dog collar back until speeds match".)
4. **Unblocking**: when speeds are equal, the friction torque on the ring drops to ~0; the sleeve chamfer torque rotates the ring back so its teeth align with the sleeve gaps (the ring "indexes" the other way, rotates through half a tooth pitch).
5. **Sleeve passes ring**: the sleeve teeth slide through the blocker ring teeth (the ring's torque no longer blocks).
6. **Engagement**: the sleeve teeth enter the gear's dog teeth (the gear's small teeth are tapered/chamfered); the sleeve stops against the gear (full travel). The gear is now locked to the hub (mainshaft). Struts remain in their detent, now displaced to the other side. Release: return sleeve to neutral; struts' detent springs recentre.

### 5.3 Numbers
| Item | Value | Tag |
|---|---|---|
| Cone half-angle | 6-7.5 deg (smaller angle gives much higher torque but sticking risk) | [SRC-WEAK] Firgelli; commonly 6.5 deg [KNOW]; use 7 deg |
| Cone mean radius | 30-45 mm (ESTIMATE; use 36 mm for gear synchro) | ESTIMATE |
| Sleeve travel neutral -> full engagement | about 8-10 mm each side (pre-sync about 2-4 mm; blocking about 1-2 mm; engagement about 4-5 mm) | ESTIMATE (no source) |
| Dog tooth / sleeve spline count | about 28-36; ESTIMATE use 32 (for a 56 mm PCD) | ESTIMATE |
| Index angle of blocker ring | half tooth pitch = 360/(2 x 32) = 5.625 deg | [KNOW] definition ("half a tooth pitch"); count ESTIMATE |
| Sleeve/ring chamfer included angle | 90-120 deg | ESTIMATE |
| Sync time | 150-400 ms for passenger car, shorter for 3-4 shifts [SRC-WEAK Firgelli]; some sources say 100-300 ms; use 0.15-0.3 s | [SRC-WEAK] |
| Number of struts | 3 at 120 deg | [KNOW] |
| Axial shift force | 30-100 N at shift knob forces | ESTIMATE |

Sync time formula: t = I x delta_omega / T_cone [SRC Firgelli], with I = effective inertia reduced to the mainshaft and delta_omega the initial speed difference.

---

## 6. SHIFT MECHANISM [KNOW; typical 3-rail design]

- **Rails**: three shift rails (rods) parallel to the shafts above the gears: Rail A (1-2), Rail B (3-4), Rail C (5-R). Each rail carries one shift fork (fork fingers sit in the sleeve groove) and a detent notch set (3 notches: front, neutral, rear), plus one **shift finger notch / lug** where the selector finger engages. A fourth fork/lever for reverse idler (on rail C or its own).
- **H-pattern mapping** (right-hand-drive-independent; standard European): left column: 1 (up/forward) and 2 (down/back) -> Rail 1-2; centre: 3 (forward) and 4 (back) -> Rail 3-4; right column: 5 (forward) and R (back) -> Rail 5-R (reverse is usually back in the right column, or up-left with lockout in dog-leg).
 The shift lever's cross-gate (left-right) motion selects the rail by moving the selector finger/lug to the rail's lug; the in-gate (fore-aft) motion moves that rail ahead or behind by about 8-12 mm (sleeve travel + dog engagement).
- **Detents**: a spring-loaded ball (or plunger) in the housing per rail, pressed into the notches of the rail (three notches; ball radius creates the click, spring about 100-200 N) so the rail snaps to neutral/engaged positions.
- **Interlock**: two balls (or a plate) between neighbouring rails plus a pin through the middle rail: when one rail leaves neutral, a ball is pushed into the neutral-notch of the other rails, locking them; at most one rail can be out of neutral at a time. Also the shift finger itself can only reach one rail.
- **Reverse lockout**: prevents accidental selection of R while changing into 5th: a spring-loaded plunger/gate or a pull-up ring on the lever (or stiffer detent spring on the R side of the 5-R rail); sometimes the reverse stop requires lifting the lever collar (VW, Mazda) or a heavier "reverse gate" spring. Reverse lights switch is on the rail.
- **Typical travel ratio**: knob travel about 60-80 mm fore-aft versus fork travel about 10-12 mm -> lever ratio about 5:1 to 7:1 (ESTIMATE; depends on length above/below the pivot ball).
- Rail relative lock: rails parallel, spacing ~ 20-25 mm.

---

## 7. GEAR GEOMETRY RULES

All [KNOW] unless noted; sources for the 17-tooth limit: tec-science https://tec-science.com/?p=6265 (z_min = 2/sin^2(alpha) = 17 at 20 deg).

- Module m = pitch diameter / teeth. Pitch diameter d = m x z (spur); helical: d = mn x z / cos(beta), where mn is the normal module, beta the helix angle (pitch cylinder), and mt = mn / cos(beta) is the transverse module.
- Standard pressure angle 20 deg (normal). Transverse pressure angle alpha_t = atan(tan(alpha_n)/cos(beta)); car gearboxes often use 17.5-20 deg normal angle (ESTIMATE).
- Standard full-depth rack: addendum = 1.0 mn, dedendum = 1.25 mn, whole depth = 2.25 mn, tip clearance 0.25 mn; tooth thickness at pitch circle = pi x m / 2 minus backlash allowance.
- Tip diameter da = d + 2 mn; root diameter df = d - 2.5 mn; base circle db = d x cos(alpha_t) (for helical in the transverse plane).
- Centre distance of a pair: a = (d1 + d2)/2 = mn (z1 + z2) / (2 cos(beta)). All gear pairs between the same two shafts must satisfy the same a: use same mn and beta with same tooth sum (z1+z2), or compensate through profile shift/other beta (real boxes do this: 5th pair on W58 sum 90 vs 80).
- Minimum teeth without undercut: spur z_min = 2 / sin^2(alpha) = 17 for 20 deg (practical 14 with slight undercut tolerable; below 17 needs positive profile shift x >= (17 - z)/17) [SRC tec-science and others]. Helical: z_min = 2 cos(beta) / sin^2(alpha_t) approx 17 cos^3(beta) [KNOW; not found on fetched page; verify against a gear textbook/ISO 21771]. Example: beta = 23 deg, alpha_n = 20 deg -> alpha_t = 21.57 deg, z_min = 13.6 -> 14.
- Gear ratio i = z2/z1; i total = product over meshes; the direction of rotation flips at each external mesh.
- Mating parallel-axis helical gears: equal normal module, equal normal pressure angle, equal helix angle magnitude, **opposite hand** (one right-hand, one left-hand).
- Backlash: normal-plane backlash about 0.04-0.15 mm for module 2-3 (ESTIMATE; AGMA/ISO guidance roughly 0.04 m ... 0.1 m). Model: 0.08 mm.
- Face widths: forward gears 15-30 mm (ESTIMATE; large 1st gear ~ 22-28 mm, 5th 14-20 mm), reverse spur 12-18 mm; constant-mesh pair ~ 20-25 mm.
- Helical axial thrust: Fa = Ft x tan(beta); handle with tapered roller / ball bearings (not modelled).
- Contact ratio: >= 1.2 for spur, helical 1.5-3+ (face contact ratio).
- Free gears: on needle bearings, bore diameter = mainshaft journal + bearing; gear body overlapping synchro cone/dogs is part of the gear (cone and dog teeth are cut on its side).

---

## 8. COMMON MISCONCEPTIONS AND ERRORS IN ANIMATIONS (>=10)

1. Gears sliding into mesh in a modern synchromesh box. WRONG: in a constant-mesh box, all gear pairs stay permanently meshed (only the reverse idler slides in most boxes). CORRECT: the SLEEVE slides on the hub to lock a free gear to the mainshaft via dog teeth.
2. Layshaft stationary in neutral. WRONG. CORRECT: with the clutch engaged the input gear drives the countershaft cluster; the countershaft and all free gears on the mainshaft rotate in neutral; only the mainshaft (output) is not driven.
3. Cam running at crank speed. WRONG. CORRECT: cam speed = 1/2 crank speed (720 deg crank per 360 deg cam; sprocket 2:1).
4. Valves opening on the wrong stroke. WRONG: intake open during compression/power, or exhaust during intake. CORRECT: intake mostly open during the intake stroke (IVO ~10 BTDC to IVC ~58 ABDC); exhaust during exhaust stroke (EVO ~58 BBDC to EVC ~10 ATDC); both valves closed during compression and power except the ends.
5. Wrong firing order / all four pistons at the same position. CORRECT: pistons 1+4 and 2+3 move together; firing order 1-3-4-2 with 180 deg intervals; cylinders 1 and 4 are never in the same stroke.
6. Spark at exactly TDC. CORRECT: spark advanced 8-15 BTDC at idle, 25-40 at part load/high rpm; peak pressure 10-16 deg ATDC.
7. Clutch disc drawn bolted to the flywheel. WRONG: the disc is clamped (friction) between flywheel and pressure plate and is splined to the input shaft; the clutch COVER is bolted to the flywheel. When engaged, all spin together; when disengaged, the disc stops with the input shaft while the flywheel/cover/pressure plate keep turning.
8. Output shaft rotating the wrong direction in reverse / forward gears. CORRECT: forward gears 1-3,5: two meshes -> same direction as input; reverse via an idler: opposite; 4th: direct, same direction.
9. Pressure plate and release bearing moving in the wrong direction. CORRECT (push-type diaphragm): bearing moves toward the engine, finger tips toward the flywheel, the plate (via rim) moves away from the flywheel by 1.5-2 mm; the disc is released. The pedal does not compress the main springs (the diaphragm is released by pivoting).
10. Piston motion as sinusoid. WRONG: piston is not harmonic; with rod ratio 3.2 the piston spends more time in the lower half; max speed ~71 deg ATDC.
11. Connecting rod length changing / rod passing through the crank. CORRECT: the rod is rigid; |big end - small end| = l always.
12. Both synchronizers (or two rails) engaged at once; interlock violated. CORRECT: only one sleeve moves out of neutral at a time.
13. Synchro sleeve passing through blocker ring while speeds differ; no blocking visible. CORRECT: sleeve is blocked until speeds match; ring indexes half tooth.
14. Exhaust and intake valves shown as the same size. CORRECT: intake larger (34.5 vs 29.5 mm), intake valves usually on the cooler side opposite the exhaust manifold.
15. Flywheel driving the countershaft or gearbox directly. CORRECT: only through the clutch disc -> input shaft.
16. 4th gear shown as passing through the countershaft. CORRECT: direct drive: input shaft locked to mainshaft; the countershaft just idles.
17. Gear teeth as rectangles / non-involute, tooth counts that do not match the ratio. CORRECT: involute teeth; pitch circles tangent; z1/z2 consistent.
18. Starter ring gear on the clutch / gearbox side. CORRECT: on the flywheel rim, in the starter window of the bellhousing.
19. Crankshaft rotating clockwise when viewed from the flywheel end. SAE standard is counter-clockwise from the flywheel end (clockwise from the front).

---

## 9. RECOMMENDED MODEL PARAMETERS (consolidated)

| # | Parameter | Value | Tag |
|---|---|---|---|
| E1 | Bore | 86.0 mm | SOURCED (Wikipedia Toyota S engine) |
| E2 | Stroke / crank radius | 86.0 mm / 43.0 mm | SOURCED |
| E3 | Rod length c-c | 138.0 mm | SOURCED-WEAK (Manley 5.428 in = 137.9; forum 138) |
| E4 | Compression ratio | 11.0 : 1 | SOURCED (Gen 4) |
| E5 | Piston compression height | 33.8 mm | SOURCED-WEAK (JE 3S-GE) |
| E6 | Deck height (axis to deck) | 215 mm (derived 214.8) | ESTIMATE (derived) |
| E7 | Piston pin dia | 22.0 mm | SOURCED-WEAK (JE/Eagle) |
| E8 | Main journal / crankpin | 55.0 / 48.0 mm | SOURCED-WEAK (Toyota manual snippet) |
| E9 | Bore spacing | 96.0 mm | ESTIMATE |
| E10 | Main bearings / counterweights | 5 / 8 | ESTIMATE (KNOW) |
| E11 | Intake / exhaust valve head dia | 34.5 / 29.5 mm | SOURCED |
| E12 | Valve stem dia | 5.5 mm (both) | ESTIMATE (K20A 5.5 sourced-weak) |
| E13 | Included valve angle | 22.5 deg (11.25 deg per valve) | SOURCED |
| E14 | Max lift intake / exhaust | 8.56 / 8.31 mm | SOURCED |
| E15 | Cam duration | 248 deg crank (124 deg cam) intake and exhaust | SOURCED (Motorreviewer) |
| E16 | IVO / IVC / EVO / EVC | 10 BTDC / 58 ABDC / 58 BBDC / 10 ATDC | ESTIMATE (consistent with 248 deg) |
| E17 | LSA | 114 deg cam (intake peak 114 ATDC, exhaust peak 114 BTDC) | ESTIMATE |
| E18 | Bucket tappet OD | 31.0 mm | SOURCED-WEAK |
| E19 | Cam base circle dia / nose | 28.0 mm / 45.1 mm | ESTIMATE |
| E20 | Firing order / spark | 1-3-4-2; 180 deg interval; plug central | SOURCED (Motorreviewer 3S-GE firing order) |
| E21 | Spark advance | idle 10, cruise 30, high rpm 35 deg BTDC | ESTIMATE |
| E22 | Idle / redline | 800 / 7500 rpm | ESTIMATE |
| E23 | Cam:crank ratio / crank sprocket / cam sprocket | 1:2 / 20 T / 40 T | SOURCED (ratio), ESTIMATE (teeth) |
| C1 | Flywheel OD (with ring gear) / friction face OD | 300 / 245 mm; thickness 30 mm | ESTIMATE |
| C2 | Ring gear teeth / module | 132 / 2.25 mm (PCD 297 mm) | ESTIMATE |
| C3 | Clutch disc OD / ID | 225 / 150 mm, 8 mm thick | ESTIMATE (Saab 240 mm sourced for a 2.3T) |
| C4 | Torsion damper springs | 6 | ESTIMATE |
| C5 | Cover bolts | 6 | ESTIMATE (KNOW) |
| C6 | Pressure plate lift on release | 1.8 mm | ESTIMATE (range 1.5-2.0) |
| C7 | Release-bearing travel | 9 mm (toward engine) | ESTIMATE (range 8-10); lever ratio ~5 |
| C8 | Pilot bearing | 15 x 32 x 9 mm | ESTIMATE |
| G1 | Centre distance | 76.0 mm | ESTIMATE |
| G2 | Normal module / helix angle / pressure angle | 1.75 mm / 23 deg / 20 deg | ESTIMATE (a = 1.75 x 80/(2 cos 23) = 76.04) |
| G3 | Constant mesh pair | 34 / 46 | SOURCED-WEAK (W58) |
| G4 | 1st / 2nd / 3rd (cs/main) | 23/57, 33/47, 41/39 | ESTIMATE (tooth sum 80) |
| G5 | 5th (cs/main) | 51/29 (W58 anecdote 57/33, sum 90) | ESTIMATE |
| G6 | Reverse (cs/idler/main), spur | 17 / 21 / 47, module 2.25 | ESTIMATE |
| G7 | Resulting overall ratios | 3.353, 1.927, 1.287, 1.000, 0.769, R 3.74 | ESTIMATE; reference W58: 3.285, 1.894, 1.275, 1.000, 0.783, R 3.768 (SOURCED) |
| G8 | Face widths | 22 (1st), 20 (2nd), 18 (3rd), 16 (5th), 22 (input pair), 14 (reverse) mm | ESTIMATE |
| G9 | Backlash | 0.08 mm | ESTIMATE |
| G10 | Synchro cone half-angle / mean radius | 7 deg / 36 mm | SOURCED-WEAK / ESTIMATE |
| G11 | Dog teeth per synchro | 32 (index = 5.625 deg) | ESTIMATE |
| G12 | Sleeve travel (neutral -> engaged) | 9 mm each side | ESTIMATE |
| G13 | Sync time | 0.20 s | SOURCED-WEAK (range 0.15-0.40) |
| G14 | Rail/lever travel | rail 10 mm each side; knob ~60 mm | ESTIMATE |
| G15 | Rotation: crank SAE CCW viewed from flywheel; input +E, counter -E, main +E (fwd) / -E (reverse) | | KNOW |

Testable invariants: sum of firing events spaced 180 deg; |rod| constant; for every free-gear pair at any time omega_main_gear / omega_counter = -Zc/Zm; in a locked gear, omega_gear == omega_mainshaft; in 4th, omega_main == omega_input; reverse omega_main has opposite sign to omega_input; cam = crank/2; total ratio per gear = product; tooth sum 80 for pairs at 76.04 mm centre distance.

---

## 10. WHAT COULD NOT BE VERIFIED

- Rod length, journals, piston compression height for the 3S-GE: only aftermarket (JE, Manley, Eagle) and one repair-manual snippet found; not the factory spec sheet. Crankpin/main journal reported 48/55 mm (repair manual snippet; one listing had them swapped).
- Bore spacing, deck height, valve stem diameter, cam base circle, counterweight count, bucket tappet bore: not found.
- Valve timing events for the 3S-GE (IVO etc.): not found; I give 248-deg-symmetric ESTIMATES. Advertised duration (248 deg) and lift are sourced.
- Spark advance, pressure and temperature values: typical textbook values only.
- Clutch travel (8-10 mm bearing, 1.5-2 mm plate lift), disc ID, ring gear tooth count: no web source found; patents give only a 2 mm reference displacement; Saab WIS gives disc OD of 240/250 mm.
- Gearbox tooth counts: only W58 input pair (34/46) and 5th pair (33/57) from a single forum post (itself labelled inconsistently). Getrag 265 ratios from forum posts; no tooth counts. Mazda M15M-D ratios not verified. Centre distances not found.
- Synchronizer dimensions (sleeve travel, dog count, cone radius, chamfer): not found; cone half-angle 6-7.5 deg and 150-400 ms are the only external numbers (one aggregator site), SAE paper 2004-01-1230 exists (paywalled).
- Helical min-teeth formula z_min = 2 cos(beta)/sin^2(alpha_t) not located on a fetched page (standard textbook result).

Source conflicts:
- Rod length of K20A: 139 mm vs 145.8 mm vs 147 mm in aftermarket listings.
- Valve angle for 3S-GE: 25 deg (Gen 1) vs 22.5 deg (Gen 4); another site lists 44.5 deg (unclear convention).
- Main journal/crankpin on 3S-GE: 55/48 (manual) vs reversed in a stroker-crank listing.
- K20A cam duration/lift: two different sets from the same aggregator.
- Sync time: 150-400 ms (Firgelli) vs 100-300 ms elsewhere.
- W58 5th gear: tooth sum of 5th pair (90) differs from the input pair (80) in the forum data.
