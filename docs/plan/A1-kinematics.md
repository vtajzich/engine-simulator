# Task A1 — kinematics library (`src/kin/*`) + tests (`test/kin/*`)

Read first: `docs/design.md` (contract), `src/spec.js` (all numbers), `docs/research.md` §1.2, §2, §7 (facts to test).
Pure JavaScript maths, no Three.js, no DOM. Every function takes values from `SPEC` via `derive()`; do not hard-code
dimensions. Write tests first (vitest, `test/kin/*.test.js`), then implement until `npx vitest run test/kin` is green.
Do not touch files outside `src/kin/` and `test/kin/`. If the spec makes a required test impossible, do NOT change
`src/spec.js` — report it in your final message with the numbers.

Helpers you will need everywhere: `const rad = d => d*Math.PI/180`, `mod(a, n) = ((a % n) + n) % n`,
`wrapPi(a)` → (−π, π], `wrapTo(a, period)` → (−period/2, period/2].

## 1. `src/kin/derive.js`

`export function derive(spec = SPEC)` → frozen object `D`, memoised per spec object (WeakMap). Fields:

```
R = bore/2, r = stroke/2, L = rodLength
cylX[i] = i * boreSpacing                         (i = 0..3)
throwPhase[i] = rad(throwPhaseDeg[i]),  firingAngleDeg[i]
headFaceY = deckHeight + headGasket
gamma = rad(head.roofAngleDeg)
roofApexY = headFaceY + R * tan(gamma)            // apex line of the pent roof, above the cylinder axis
tdcCrownY = r + L + compressionHeight
pistonArea = π R²
displacement = pistonArea * stroke                 // mm³ per cylinder
clearanceVolume = R³ * tan(gamma) * (π − 4/3) + pistonArea * (headFaceY − tdcCrownY)   // pent-roof wedge + crevice
compressionRatio = 1 + displacement / clearanceVolume

valve[kind]  (kind = 'in' | 'ex';  side = +1 for 'in', −1 for 'ex';  v = spec.engine.valves.intake | .exhaust)
  side, headRadius = v.headDiameter/2, maxLift = v.maxLift
  axis = [0, cos γ, side * sin γ]                 // unit vector from the valve head up the stem
  seat(cyl, which) = [ cylX[cyl] + (which === 0 ? −1 : +1) * v.dx,
                       roofApexY − v.slope * sin γ,
                       side * v.slope * cos γ ]    // centre of the valve head face = point of the roof plane
  camOffset = valves.length + vt.bucketTopThickness − valves.seatGap + vt.lash + vt.contactGap + vt.baseCircleRadius
  camAxis = { y: seat.y + camOffset * cos γ, z: seat.z + side * camOffset * sin γ }   // same for all cylinders
  followerAngle = (kind === 'in') ? π + γ : π − γ // angle (from +Y toward +Z) of the direction cam centre → bucket
  openDeg, closeDeg, peakDeg  in the cylinder's CYCLE angle ψ (ψ = 0 at firing TDC, 0..720):
      'in': open = 360 − intakeOpensBTDC,  close = 540 + intakeClosesABDC
      'ex': open = 180 − exhaustOpensBBDC, close = 360 + exhaustClosesATDC
      peak = (open + close)/2
  halfDurationCam = (close − open) * π / 720      // rad of CAM rotation from opening to peak

gearbox
  beta = rad(helixAngleDeg), mn = normalModule, mt = mn / cos β
  alphaT = atan(tan(rad(normalPressureAngleDeg)) / cos β)
  centreDistance = mt * toothSum / 2
  counterAxis = { y: −centreDistance, z: 0 },  mainAxis = { y: 0, z: 0 }
  gears: object keyed by id. Helical ids:  'input.main','input.counter','g1.main','g1.counter', … 'g5.counter'.
    each = { id, shaft: 'main'|'counter', z, r = mt*z/2, rb = r*cos(alphaT), ra = r + mn, rf = r − 1.25*mn,
             mt, alphaT, beta, hand: +1 for shaft 'main', −1 for 'counter', backlash,
             x: [x0, x1] from pairs[..].x, mid = (x0+x1)/2, width = x1 − x0 }
    Reverse spur ids: 'rev.counter' (x = reverse.counterX), 'rev.idler' (x = reverse.idlerNeutralX), 'rev.main'
    (x = reverse.mainX): same fields with m = reverse.module: mt = m, alphaT = rad(reverse.pressureAngleDeg), beta = 0,
    hand = 0, r = m*z/2, rb = r cos α, ra = r + m, rf = r − 1.25 m.
  idlerAxis = { y, z }: the point with |idler − counterAxis| = r(rev.counter) + r(rev.idler),
              |idler − mainAxis| = r(rev.main) + r(rev.idler), and sign(z) = reverse.idlerSide.
  ratios = { 1: zc_in/zm_in * zm_g1/zc_g1, 2: …, 3: …, 4: 1, 5: …, R: −(zc_in/zm_in) * (z_rev.main / z_rev.counter) }
           (zm_in = pairs.input.main = 34, zc_in = pairs.input.counter = 46; ratio = input speed / output speed)

synchro
  n = teeth, pitchAngle = 2π/n, P = pitchRadius * pitchAngle (mm), w = toothWidthFraction * P,
  c = P/2 − w (side clearance per flank), chamferLen = (w/2) / tan(rad(chamferAngleDeg))
```

## 2. `src/kin/engine.js`

All crank angles in radians unless `Deg`. `cyl` 0-based.

- `throwAngle(crank, cyl)` = `crank + throwPhase[cyl]`.
- `pistonPinY(alpha)` = `r cos α + sqrt(L² − r² sin² α)`; `pistonCrownY(alpha)` = pin + compressionHeight.
- `crankPin(alpha)` → `{ y: r cos α, z: r sin α }`.
- `rodAngle(alpha)` = `−asin(r sin α / L)` — the `rotation.x` of a rod modelled with its small end at the local origin
  and its big end at local (0, −L, 0). (Check: rotating (y,z)=(−L,0) by this angle lands on crankPin − pin.)
- `pistonVelocityPerRad(alpha)` = d(pinY)/dα (analytic).
- `cycleAngleDeg(crankDeg, cyl)` = `mod(crankDeg − firingAngleDeg[cyl], 720)`.
- `strokeOf(psiDeg)`: `[0,180) 'power'`, `[180,360) 'exhaust'`, `[360,540) 'intake'`, `[540,720) 'compression'`.
- `cylinderVolume(alpha)` = `clearanceVolume + pistonArea * (tdcCrownY − pistonCrownY(alpha))` (mm³).
- `gasState(psiDeg, throttle)` → `{ stroke, phase, burn, pBar, tempK, spark }` — idealised indicator model:
  - `Vbdc = clearanceVolume + displacement`, `V = cylinderVolume(rad(psiDeg))` (ψ and α coincide modulo 360 for volume).
  - manifold pressure `pm = 0.35 + 0.60 * throttle` bar.
  - spark advance `adv = idle + (load − idle) * throttle` (deg BTDC), spark at ψs = 720 − adv (i.e. before ψ = 0/720).
  - burn fraction (Wiebe): with `x = (ψrel)/55` where ψrel = degrees since spark (ψ continuous across the 720→0 wrap,
    evaluated for ψ ∈ [ψs, 720) ∪ [0, 180)): `burn = 1 − exp(−5 x³)` clamped to [0,1]; 0 elsewhere.
  - compression + combustion + expansion (ψ ∈ [540, 720) ∪ [0, EVO)), EVO = 180 − exhaustOpensBBDC:
    `p = pm * (Vbdc / V)^1.30 * (1 + 2.6 * burn)`, `T = 330 * (Vbdc / V)^0.30 * (1 + 2.3 * burn)`.
  - exhaust blow-down (ψ ∈ [EVO, 180)): blend from the expansion value at EVO to 1.05 bar exponentially
    (`e = exp(−(ψ − EVO)/15)`), T blends to 1000 K. Exhaust stroke [180, 360): 1.05 bar, 950 K.
  - intake stroke [360, 540): p = pm, T = 320 K (smoothly blend from exhaust values over the first 20° to avoid a jump).
  - `phase`: 'intake' | 'compression' | 'combustion' (burn in (0.02, 0.98)) | 'expansion' | 'exhaust'.
  - `spark`: true when ψ is within 4° after ψs.
  Requirements tested: peak pressure at full throttle lies 5–25° after firing TDC and is 40–80 bar; p never changes by
  more than 15 % between consecutive 1° samples; p > 0 everywhere.

## 3. `src/kin/cam.js`

Flat-faced bucket follower ⇒ the lobe is the exact envelope of the follower plane.

- `liftLaw(tau, H, Lmax, f1, f3)` → `{ s, ds, d2s }` for tau ∈ [0, H] (cam radians after opening; H = halfDurationCam):
  `t1 = f1*H, t3 = f3*H, t2 = H − t1 − t3, v = Lmax / (H − (t1 + t3)/2)`
  - tau ≤ t1: `s = ½ (v/t1) tau²`, `ds = (v/t1) tau`, `d2s = v/t1`
  - tau ≤ t1+t2: `s = v t1/2 + v (tau − t1)`, `ds = v`, `d2s = 0`
  - else: `u = H − tau`; `s = Lmax − ½ (v/t3) u²`, `ds = (v/t3) u`, `d2s = −v/t3`
  Outside [0, H] return zeros (tau < 0) — the closing flank is the mirror image.
- `camAngle(crank)` = `crank / 2` (both camshafts, same sense as the crank).
- `lobeCentreAngle(kind, cyl)` = `followerAngle[kind] − rad((firingAngleDeg[cyl] + peakDeg[kind]) / 2)` — the direction,
  in the camshaft's LOCAL frame (angle from local +Y toward local +Z), of the lobe nose for that cylinder.
- `lobeLift(kind, cyl, phi)` → `{ s, ds }`: lift as a function of the local direction angle φ:
  `d = wrapPi(phi − lobeCentreAngle)`; if `|d| ≥ H` → 0; else `liftLaw(H − |d|)` and `ds/dφ = −sign(d) * ds/dtau`.
- `camLift(kind, cyl, crank)` = `lobeLift(kind, cyl, followerAngle[kind] − camAngle(crank)).s`.
- `valveLift(kind, cyl, crank)` = `max(0, camLift − lash)` (both valves of a cylinder/kind move identically).
- `lobeOutline(kind, cyl, n = 240)` → array of n `[y, z]` points in the camshaft local frame, for φ_k = 2πk/n:
  `p = (rb + s) * [cos φ, sin φ] + (ds/dφ) * [−sin φ, cos φ]` with rb = baseCircleRadius. (Closed convex curve, ordered
  by increasing φ = counter-clockwise when looking from +X toward −X… the geometry agent only needs the order.)
- `lobeChecks(kind)` → `{ minCurvatureRadius, maxContactOffset }` where curvature radius = `rb + s + d2s` sampled over
  the flank (use liftLaw's d2s) and contact offset = `|ds|`.

## 4. `src/kin/gears.js`

- `inv(a) = tan(a) − a`.
- `toothHalfAngle(g, rho)` (g from `derive().gearbox.gears[id]`): transverse tooth thickness on the pitch circle
  `s = π*g.mt/2 − g.backlash/2`; for `rho ≥ rb`: `s/(2r) + inv(alphaT) − inv(acos(rb/rho))`; for `rho < rb`: value at rb.
- `meshPhase(zA, thetaA, zB, delta)`: gear A (zA teeth, angle thetaA) drives gear B whose axis lies in direction `delta`
  (angle from +Y toward +Z of the vector axisA → axisB). Convention: tooth 0 of every gear is centred on its local angle
  0 (local +Y) at the gear's mid-plane. Returns an angle for B such that a tooth of A meets a gap of B on the line of
  centres: `frac(v) = v − floor(v)`; `pA = frac((delta − thetaA) * zA / 2π)`; `pB = frac(0.5 − pA)`;
  `return delta + π − pB * 2π / zB`.
- `shaftAngles({ input, main })` → `{ counter, g1, g2, g3, g5, idler, revMainRequired }` using CONTINUOUS linear laws
  (never call meshPhase with a moving angle — it jumps by a tooth pitch):
  - `counter = c0 − (34/46) * input` with `c0 = meshPhase(34, 0, 46, π)` (counter axis is below: direction −Y = π)
  - `g_k = k0 − (zc_k / zm_k) * counter` with `k0 = meshPhase(zc_k, 0, zm_k, 0)` (main axis is above the counter: 0)
  - `idler = i0 − (z_rc / z_ri) * counter`, `i0 = meshPhase(z_rc, 0, z_ri, δci)`, δci = atan2(idler.z − counter.z, idler.y − counter.y)
  - `revMainRequired = m0 − (z_ri / z_rm) * idler`, `m0 = meshPhase(z_ri, 0, z_rm, δim)`, δim = atan2(−idler.z, −idler.y)
    = the angle (mod the 50 T gear's tooth pitch) the mainshaft must have for the idler to mesh with the fixed reverse
    gear (reverse gear tooth 0 at mainshaft local angle 0; all countershaft gears tooth 0 at countershaft local angle 0;
    34 T input gear tooth 0 at input-shaft local angle 0).
  (use tooth counts from SPEC, not the literals above)
- `gearLinear(name)` → `{ A, B }` such that `angle = A * input + B` for name ∈ 'input' (A=1,B=0), 'g1','g2','g3','g5',
  'counter','idler','revMain'.
- `gearForSleeve`: map `{ s12: { '-1': 'g2', '1': 'g1' }, s34: { '-1': 'input', '1': 'g3' }, s5: { '1': 'g5' } }` and
  `gearNumber`: g1→'1', g2→'2', g3→'3', input→'4', g5→'5'. Ring names: g1→ring1, g2→ring2, g3→ring3, input→ring4, g5→ring5.

## 5. `src/kin/synchro.js`

Tangential quantities in mm on the pitch radius (angle = mm / pitchRadius). `eps = 0.05`.

- Tooth phase convention (design contract for the geometry agents):
  - sleeve INTERNAL teeth are centred on mainshaft-local angles `k * pitchAngle`;
  - hub EXTERNAL teeth on mainshaft-local `(k + ½) * pitchAngle`;
  - blocker-ring external teeth on ring-local `k * pitchAngle`; a ring is aligned (sleeve can pass) when
    `ringAngle = main + pitchAngle/2`; indexed (blocking) at `main + pitchAngle/2 ± ringIndexFraction * pitchAngle`;
  - gear dog teeth on gear-local `k * pitchAngle`; a gear is aligned when `gearAngle ≡ main + pitchAngle/2 (mod pitchAngle)`.
- `misalign(gearOrRingAngle, main)` = `|wrapTo(angle − main − pitchAngle/2, pitchAngle)| * pitchRadius` (mm, 0 … P/2).
- `maxAdvance(d)`: how far (mm) a sleeve tooth tip may travel past the tip plane of the opposing pointed teeth when
  misaligned by d: `d < c − eps ? Infinity : P/2 − d − eps`.
- `maxMisalign(a)`: inverse: `a ≤ 0 ? P/2 : Math.max(c/2, P/2 − a − eps)`.
  (45° chamfers: faces meet when advance = P/2 − d.)
- Sleeve positions (mm of travel, always positive toward the gear being engaged):
  `xRingTip = ringTeethX[0] − sleeveHalfWidth` (0.5), `xBlock = xRingTip + maxAdvance(ringIndexFraction * P)`,
  `xDogTip = dogTeethX[0] − sleeveHalfWidth` (6), `xEngaged = travel`.
- `advanceRing(x) = x − xRingTip`, `advanceDog(x) = x − xDogTip`.

## 6. `src/kin/clutch.js`

Geometry in the (ρ = radius, x = axial) half-plane; a diaphragm finger is a rigid straight lever.

- `clutchStack(spec)` (engaged, pedal 0): `discFrontX = flywheel.x[1] + faceGap`, `discRearX = discFrontX + disc.thickness`,
  `plateFrontX = discRearX + faceGap`, `plateRearX = plateFrontX + pressurePlate.thickness`,
  `ridgeX = plateRearX + ridgeHeight` (top of the annular ridge the fingers press on),
  finger outer point `O = (ρ: outerRadius, x: ridgeX + contactGapC + thickness/2)` with `contactGapC = 0.05`,
  slope `k = coneRise / (outerRadius − tipRadius)`; point on the finger centreline at radius ρ: `x = O.x + (outerRadius − ρ) * k`,
  fulcrum `F = centreline point at ρ = fulcrumRadius`, tip `T = centreline point at ρ = tipRadius`.
- `fingerPoint(point, phi)`: rigid rotation by φ about the tangential axis through F:
  `ρ' = F.ρ + (ρ − F.ρ) cos φ − (x − F.x) sin φ`, `x' = F.x + (ρ − F.ρ) sin φ + (x − F.x) cos φ` (φ > 0 ⇒ tip moves −X, outer end +X).
- `releaseKin(pedal)` → `{ bearingTravel, tipTravel, fingerAngle, plateLift, discShift, capacity }`:
  - φmax solves `fingerPoint(O, φmax).x − O.x = plateLift` (bisection); `tipTravelMax = T.x − fingerPoint(T, φmax).x`
  - `bearingTravel = pedal * (freePlay + tipTravelMax)` (mm toward −X), `tipTravel = max(0, bearingTravel − freePlay)`
  - `fingerAngle` φ solves `T.x − fingerPoint(T, φ).x = tipTravel` (bisection, 0 … φmax)
  - `plateLift = fingerPoint(O, φ).x − O.x` (pressure plate moves +X by this), `discShift = plateLift / 2`
  - `capacity = clamp(1 − plateLift / cushionTravel, 0, 1)` (fraction of clutch.maxTorqueNm that can be transmitted)
- Release bearing: its front face rests at `T.x + thickness/2 + freePlay` (pedal 0) and is at
  `rest − bearingTravel` otherwise (export `bearingFaceX(pedal)`).

## 7. `src/kin/pose.js`

- `poseAt(o = {})`: complete consistent pose (see design.md §5) from optional
  `{ crank = 0, input = crank, main = 0, clutchPedal = 0, sleeves = {}, idlerX = 0, rings = {}, lever = {col:0,row:0}, throttle = 0.3, flow }`.
  `camIn = camEx = crank/2`; `counter, gears.*` from `shaftAngles`; rings default `{ angle: main + pitchAngle/2, push: 0 }`;
  `cylinders[i] = { psiDeg, ...gasState(psiDeg, throttle) }` with `psiDeg = cycleAngleDeg(deg(crank), i)`.
- `poseForGear(gear, o = {})`, gear ∈ 'N','1'…'5','R': like poseAt but with the right sleeve fully engaged
  (`±travel`), lever at its gate position, and `input` solved so the teeth align exactly:
  for a forward gear g: `input = (main + pitchAngle/2 − B_g) / A_g` (gearLinear); for 'R': `idlerX = idlerTravel`,
  `sleeves.s5 = −travel`, `input = (main − B_rev) / A_rev`; for 'N': `input = crank`. Unless `o.crank` is given,
  `crank = input` (clutch engaged).
- `poseFromState(state)`: see task A2 (leave a clearly marked TODO export that throws; A2 implements it).

## 8. Tests to write (`test/kin/*.test.js`) — all must pass

Engine: pin height 181.0 at TDC / 95.0 at BDC; `|crankPin − pin| = 138` for 720 samples; rodAngle check above;
piston 49.9 ± 0.1 mm below TDC at 90°; max |velocity| between 70° and 74° ATDC; the 4×4 stroke table of research §2.4
(sample mid-stroke angles 90, 270, 450, 630 for all cylinders); pistons 1&4 equal height, 2&3 equal, always;
displacement 4 cyl = 1998 ± 2 cc; compression ratio within 10.8 … 11.2.
Cam: `camAngle = crank/2`; for every cylinder intake cam lift > 0 only for ψ ∈ (350, 598) and exhaust only for
ψ ∈ (122, 370) (sample every 1°); peak lifts 8.56 / 8.31 at ψ = 474 / 246; both valves open for exactly ψ ∈ (350, 370)
(20° overlap, in cam-lift terms); all valves of a cylinder have zero lift for ψ ∈ [600, 720] ∪ [0, 120];
`lobeChecks`: minCurvatureRadius > 1.5 and maxContactOffset < bucketDiameter/2 − 0.5 for both kinds;
envelope consistency: for 360 directions φ, `max over outline points of (p · [cos φ, sin φ]) − rb` equals
`lobeLift(…, φ).s` within 0.01 mm (use n = 2000 outline points); outline is convex (cross products of consecutive
edges never change sign).
Gears: centreDistance = 76.04 ± 0.01; r_main + r_counter = centreDistance for all 5 helical pairs; idler distances;
`ra(rev.counter) + ra(rev.main) < centreDistance − 1`; meshPhase: for random inputs the returned θB gives
pA + pB ≡ 0.5 (mod 1) with pB computed as `frac((delta + π − θB) * zB / 2π)`; shaftAngles is linear and
d(counter)/d(input) = −34/46 etc.; ratios 3.353, 1.927, 1.287, 1, 0.769, −3.758 (± 0.002); forward gears turn with the
input, counter and reverse output against it; helical tooth counts ≥ ceil(2 cos β / sin² αt), spur ≥ 17.
Synchro: 1 < xBlock < 3; `maxAdvance(maxMisalign(a)) ≥ a` for a ∈ (0, P/2 − c); c > 0.15.
Clutch: pedal 0 → all zeros and capacity 1; pedal 1 → plateLift = 1.8 ± 0.01, capacity 0; bearing travel between 8 and
11 mm; plateLift = 0 while bearingTravel ≤ freePlay; monotonic in pedal; tip moves −X and outer end +X.
Pose: `poseForGear(g)` for all gears gives `misalign(gearAngle, main) < 1e-6` mm for the engaged gear, and for 'R'
`wrapTo(main − revMainRequired, 2π/50) ≈ 0`.

Final message: list the files, the test count/result, and any numbers that surprised you (e.g. actual compression
ratio, xBlock, tipTravelMax, idler axis position, cam axis positions).
