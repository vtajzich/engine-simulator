# Z1 — Ignition: distributor, HT leads, plug boots, spark flash (model + kinematics + tests)

User request: add a distributor and make the spark plugs obvious. The spark must be visible and synchronised with the
engine; the distributor rotor ("palec") must hand the spark to the right cap terminal at the same instant as the plug
fires. This brief covers **kinematics, geometry, model and tests only**. App integration (housing modes, UI text,
flash persistence in the frame loop) is a later brief (Z2) — do not do it here.

Read first: `docs/design.md` (contract: parts/bodies, `update(pose)` is a pure function of pose, conventions),
`src/model/topEnd.js`, `src/kin/engine.js`, `src/kin/pose.js`, `src/geo/parts.js`, `src/geo/materials.js`,
`test/collision/topEnd.test.js`, `verify/collide.js`.

## Files you own

`src/spec.js` (add `engine.ignition` only), `src/kin/ignition.js` (new), `src/kin/engine.js`, `src/kin/pose.js`,
`src/geo/topIgnition.js` (new), `src/geo/materials.js`, `src/model/topEnd.js`, `test/kin/ignition.test.js` (new),
`test/kin/engine.test.js`, `test/kin/pose.test.js`, `test/collision/topEnd.test.js`, `docs/design.md`,
`docs/research.md`.

Do **not** touch `src/app/**`, `src/model/clutch.js`, `verify/visual.mjs`, `test/collision/clutch.test.js`,
`README.md` (another agent works there in parallel). Do not commit. Do not start a dev server.

## 1. Facts and tags

- 3S-GE generations 1–2 have a distributor. The Toyota repair manual installs it after aligning "the slit of the
  **intake** camshaft" → driven by the intake camshaft (**SRC, weak**). Mounted coaxially on the rear end
  (flywheel side) of that camshaft, 1 : 1 with the cam = half crank speed (**EST**). External ignition coil with a
  centre HT lead (**MODEL** – some versions integrate the coil). Add this to `docs/research.md` (new short section
  "Zapalování / Ignition") with the source
  `https://www.manualslib.com/manual/1310366/Toyota-3s-Ge.html?page=436`.
- Intake cam axis: `derive().valve.in.camAxis` ≈ (y 338.6, z +52.6). The cam shaft currently ends at
  `camX1 = block.rearX − 10 = 339`. Head casting top is `headTopY` (= deck + 60 ≈ 275), i.e. the cam axis is above
  the casting. Plug terminal top ≈ y 317 at (cylX[i], z = 0). Flywheel / bellhousing reach radius ≤ 195 about the
  crank axis, so anything at distance > 200 from the crank axis is clear of them.

## 2. `src/spec.js` — add under `engine`

```js
ignition: {
  drivenBy: 'in',                 // SRC (weak): distributor keyed to the intake camshaft; rear end, coaxial — EST
  midAdvanceDeg: 20,              // cap terminals are centred on the rotor position at mid spark advance (10…30° BTDC)
  shaftDiameter: 12,              // MODEL
  rotor: { tipRadius: 30, tipHalfAngleDeg: 8, x: [393, 405] },      // MODEL; tip arc must cover ±5° cam (advance range) with margin
  airGap: 0.8,                    // MODEL radial gap rotor tip → cap terminal (real ≈ 0.3–0.8 mm)
  base: { x: [349, 387], outerRadius: 38 },                        // MODEL static body bolted behind the head
  cap: { x: [387, 430], outerRadius: 42, wall: 2.5, towerLength: 16 },
  flashDeg: 12,                   // MODEL: visual spark flash lasts this many crank degrees after the spark
},
```
You may adjust the MODEL numbers if geometry requires it (keep the tags), but keep the field names.

## 3. `src/kin/ignition.js` (new, pure maths, no Three.js)

```js
export function sparkAdvanceDeg(throttle = 0.3)          // same formula as gasState: idle + (load − idle) * throttle
export function sparkCrankDeg(cyl, throttle = 0.3)       // crank angle 0…720 of the spark of cylinder `cyl` (0-based): mod(firingAngleDeg[cyl] − advance, 720)
export function rotorAngle(crank)                         // rad; = crank / 2 (rotor is rigid on the intake cam; rotor tip is on local +Y at cam angle 0)
export function terminalAngle(cyl)                        // rad in [0, 2π): mod((firingAngleDeg[cyl] − midAdvanceDeg) / 2, 360°)
export function terminalOrder()                           // cylinder numbers (1-based) in rotor travel order starting at cyl 1 → [1, 3, 4, 2]
export function rotorMisalignDeg(cyl, throttle)           // signed cam degrees between rotor tip and terminal `cyl` at that cylinder's spark
export function flashOf(sinceDeg)                         // 1 → 0 over SPEC.engine.ignition.flashDeg; 0 outside [0, flashDeg)
```
Angle convention is the project's: measured from +Y toward +Z (see design.md §1). `gasState` must use
`sparkAdvanceDeg` instead of its inline formula (no behaviour change) and must additionally return
`flash: flashOf(since)` next to `spark` (keep `spark: since < 4`). In `poseFromState`, the not-running branch must
return `flash: 0` together with `spark: false`.

## 4. Geometry `src/geo/topIgnition.js` and parts in `src/model/topEnd.js`

All ids start with `ign` (the app will use this prefix). Distributor axis = intake cam axis.

| part id | body | label (Czech) | content |
|---|---|---|---|
| `ignRotor` | `camIn` | `Palec rozdělovače` | shaft extension (Ø `shaftDiameter`, from the cam end 339 to the rotor) + rotor: hub + one arm with a brass tip segment at `tipRadius`, tip arc half-angle `tipHalfAngleDeg`, tip on local +Y. Group positioned at the cam axis, `rotation.x = pose.camIn`. Material: shaft `steel`, rotor body new material `rotorPlastic` (0xe9e2cf, metalness 0, roughness 0.6), tip `brass`. |
| `ignDistributor` | `head` (static) | `Rozdělovač` | cup-shaped base `base.x`, with a bore around the shaft (radial clearance ≥ 0.3) and a mounting foot reaching down to the head top (same body as the head, may overlap the head casting). Material `aluminium`. |
| `ignCap` | `head` (static) | `Víko rozdělovače` | shell (closed cup `cap.x`, `wall` thick, open toward the base; 4 outer towers + 1 centre tower pointing +X, each `towerLength` long) as **one mesh with `userData.capShell = true`**, material new `capShell` (0x8a3324, metalness 0.05, roughness 0.55). **Separate meshes (no capShell flag, material `brass`)**: 4 terminal posts inside the cap whose inner faces are at radius `tipRadius + airGap`, centred at `terminalAngle(cyl)`, in the rotor's X range, each running through its tower; and the centre contact on the axis ending 0.3 mm from the rotor hub. Do **not** set `userData.housing` on any of these. |
| `ignCoil` | `head` (static) | `Zapalovací cívka` | canister Ø 44 × 60 with one HT tower, placed behind the head on the exhaust side (e.g. axis along X at y ≈ 320, z ≈ −30, x 355 … 415), with a small bracket to the head. Must be > 200 mm from the crank axis and must not touch the exhaust cam (ends at x = 339) or the distributor. Material `steelDark`. |
| `ignBoot1..4` | `head` (static) | `Koncovka kabelu svíčky n` | rubber boot over the plug terminal and the top of the ceramic (cylinder radius ≈ 8, from ≈ 10 mm below the terminal top to ≈ 18 mm above it). Material new `htLead` (0xd62828, metalness 0, roughness 0.6). Must clear both cams and lobes at every angle (collision sweep). |
| `ignLead1..4`, `ignLeadCoil` | `head` (static) | `Kabel svíčky n`, `Kabel od cívky` | `TubeGeometry` (radius 3.2) along a smooth `CatmullRomCurve3`: boot top → straight up between the cams to y ≥ 392 → a loom running toward the rear at y ≈ 395…400, z between +18 and +34 (leads side by side, 5 mm apart) → down in a U-turn into cap tower *n*. Coil lead: coil tower → cap centre tower. `userData.noCollide = true` (visual). Material `htLead`. Lead *n* must end in the tower of the terminal at `terminalAngle(n − 1)`. |
| `ignFlash1..4` | `head` (static) | `Jiskra zapalování n` | all meshes `noCollide`, `MeshBasicMaterial` (colour 0xfff4b0, `transparent: true`, `depthWrite: false`), hidden by default: (a) **plug glow**: sphere radius 7 at the plug electrode `(cylX, tipY, 0)` (`tipY` as used for the existing spark core) with `depthTest: false` and `renderOrder = 20` so it is visible through other parts; (b) **lead glow**: a tube radius 4.4 along the same curve as lead *n*; (c) **arc**: an elongated blob bridging the 0.8 mm air gap at terminal *n* (centre radius `tipRadius + airGap/2`, at `terminalAngle(n − 1)`, mid of the rotor X range), radius ≈ 3. |
| `ignFlashCoil` | `head` (static) | `Jiskra – přívod od cívky` | glow tube along the coil lead, same material rules. |

`update(pose)` additions (pure function of pose):

```js
const f = cyl => { const c = pose.cylinders?.[cyl]; return c ? (c.flash ?? (c.spark ? 1 : 0)) : 0; };
// ignFlash{n}: every mesh visible = f > 0.02; material.opacity = 0.35 + 0.65 f (plug glow scale = 0.6 + 0.8 f)
// ignFlashCoil: uses max over the four cylinders
// ignRotor.rotation.x = pose.camIn
```
Each `ignFlash` part needs its **own** material instances (opacity differs per cylinder). Follow how the existing
`spark{n}` / `flameGlow{n}` meshes are created so the app's highlighter keeps working with `MeshBasicMaterial`.
Leave the existing `spark{n}` star and the gas visuals unchanged.

Triangle budget for everything in this brief: ≤ 60 k.

## 5. Tests

`test/kin/ignition.test.js`:
- `terminalOrder()` equals `SPEC.engine.firingOrder`; the four `terminalAngle`s are 90° apart.
- For every cylinder and throttle ∈ {0, 0.5, 1} (advance 10 / 20 / 30°): `|rotorMisalignDeg| ≤ 5.01` and
  `≤ rotor.tipHalfAngleDeg − 2` (tip still overlaps the terminal).
- `rotorAngle(crank + 4π) ≡ rotorAngle(crank)` mod 2π (one rotor turn per cycle).
- `flashOf`: 1 at 0, 0 at `flashDeg`, 0 for negative / larger values; `gasState(psi).flash > 0` exactly on
  `[sparkPsi, sparkPsi + flashDeg)`; `spark` unchanged (existing engine tests still pass).
- `poseFromState` with the engine not running gives `flash === 0` for all cylinders.

`test/collision/topEnd.test.js` (follow the existing sweep helpers and style there):
- Parts `ignRotor` (body `camIn`), `ignCap`, `ignDistributor`, `ignCoil`, `ignBoot1..4` exist with the bodies above;
  `ignLead*` / `ignFlash*` meshes are all `noCollide`.
- Sweep crank 0 … 720° in 5° steps: no collisions between any bodies (rotor vs. cap terminals / base, boots vs. cams,
  coil vs. everything).
- Two-sided contact test for every terminal: at the crank angle where the rotor tip faces terminal *n*, nominal = no
  intersection between `camIn` and `head`; with the head body displaced by `airGap + 0.3` mm toward the rotor tip
  (radially, in the y/z direction of that terminal) = intersection. Use `bodiesIntersectDisplaced` the way the
  existing cam–bucket / valve–seat contact tests do.
- Synchronisation: for each cylinder `c`, pose = `poseAt({ crank: rad(sparkCrankDeg(c, 0.3) + 1) })` →
  `ignFlash{c+1}` meshes visible, the other three hidden; the arc mesh's world position, expressed as an angle about
  the distributor axis, is within 1° of `terminalAngle(c)`; the rotor tip's world angle (use a named child
  `rotorTip` and its world bounding-box centre) is within `tipHalfAngleDeg` of `terminalAngle(c)`.
  With `poseAt({ crank: rad(sparkCrankDeg(c, 0.3) − 5) })` all four flashes are hidden.
- Lead routing sanity (leads are noCollide, so check numerically): sample 200 points along each lead curve
  (export the curves or their sample points from `topIgnition.js`): for x within the camshaft range the distance to
  each cam axis is ≥ 32; every point is ≥ 200 from the crank axis; lead *n* ends within 3 mm of tower *n*'s mouth.

Also run `npx vitest run test/collision/assembly-engine.test.js` (whole assembly, several minutes) — it must stay
green with the new bodies (distributor / coil vs. bellhousing, flywheel, gearbox).

## 6. Docs

`docs/design.md`: body table — add rotor to `camIn`, distributor / cap / coil / boots to `head`; visual-only list —
add `ignLead*`, `ignFlash*`; §5 pose — `cylinders[i].flash` (0…1, visual). Mention `mesh.userData.capShell` in §3
(cap shell: the UI makes it transparent instead of hiding it).

## Verify and report

`npx vitest run test/kin test/collision/topEnd.test.js test/collision/assembly-engine.test.js` all green
(paste the summary lines). Report: final SPEC numbers you chose, part ids, exported names from
`src/kin/ignition.js` and `src/geo/topIgnition.js`, triangle count added, and anything in this brief that did not
match the code.
