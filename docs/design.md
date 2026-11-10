# Design contract — 3D engine + manual gearbox

Interactive, mechanically correct 3D model (Three.js, procedural geometry) of a 4-stroke inline-4 DOHC 16V petrol engine,
flywheel + dry single-plate clutch and a longitudinal 3-shaft 5+R synchromesh gearbox, with a verification pipeline
(kinematics tests, 3D mesh collision sweeps, headless visual check). UI text is Czech; code/comments are English.

**Every module must follow this contract exactly — other modules are written against it in parallel.**
Background facts: `docs/research.md`. All numbers: `src/spec.js` (never hard-code a dimension that is in SPEC or derivable from it).

## 1. Conventions

- Scene units = millimetres. Angles in code = radians unless a name ends in `Deg`.
- Axes: +X crank axis front→rear (X=0 = cylinder 1 centre), +Y up (Y=0 = crank axis), +Z intake side.
- Positive rotation = right-handed about +X (takes +Y toward +Z) = running direction of the crank.
- "Angle on a shaft" = measured from +Y toward +Z: point at radius r, angle a → (y, z) = (r cos a, r sin a).
  In Three.js this is `object.rotation.x = a` for an object built with its reference feature on local +Y.
- Cylinders are numbered 1..4 from the front; in code `cyl` is the 0-based index.
- ES modules, no build step needed for Node (plain `.js`, `"type": "module"`). No TypeScript. No new dependencies
  beyond `three`, `three-mesh-bvh`, `three-bvh-csg` (runtime) and `vitest`, `vite`, `playwright-core` (dev).
- Model/kinematics/sim code must run in **Node without a DOM or WebGL** (no `document`, `window`, textures from canvas,
  loaders). Only `src/app/**` may touch the DOM.

## 2. File layout and ownership

```
src/spec.js                 all dimensions (owner: lead)
src/kin/derive.js           derived geometry (valve seats, cam axes, gear radii, positions, compression ratio)
src/kin/engine.js           slider-crank, cycle/stroke, valve lift, gas state
src/kin/cam.js              lift law + exact cam lobe outline (flat follower envelope)
src/kin/gears.js            involute gear dims, mesh phase, gearbox ratios, shaft angle chain
src/kin/clutch.js           release mechanism kinematics
src/kin/synchro.js          sleeve/ring/dog chamfer constraint maths
src/kin/pose.js             poseFromState(simState) → pose ; poseAt({...}) helper for tests
src/sim/sim.js              driveline simulation (engine, clutch, synchros, vehicle)
src/geo/*.js                reusable geometry builders (gear, spline teeth, lathe helpers, materials)
src/model/bottomEnd.js      block, crankshaft, pistons, rods
src/model/topEnd.js         head, valves, buckets, springs, camshafts, timing belt, spark plugs, gas volumes
src/model/clutch.js         flywheel, clutch cover, diaphragm fingers, pressure plate, disc, release bearing/fork, bellhousing
src/model/gearbox.js        shafts, gears, reverse idler, synchronizers (hubs, sleeves, rings)
src/model/shift.js          rails, forks, lever, gear case
src/model/assembly.js       composes the five model modules (owner: lead)
src/app/**                  browser app (renderer, UI, Czech content)
verify/collide.js           collision framework
test/**                     vitest tests (kin, sim, collision sweeps)
verify/visual.mjs           headless Chrome screenshots + console-error check
```

## 3. Parts, bodies, metadata

A **part** is a `THREE.Group` (or Mesh) with `userData.part = { id, body, label, static?, info? }`:
- `id` unique string; `label` = Czech name shown in the UI; `info` = optional key into the Czech glossary.
- `body` = name of the rigid body the part belongs to. Several parts may share a body (e.g. flywheel and crankshaft are
  both body `crank`); parts of one body always move identically. `static: true` for fixed housings.
- Every descendant Mesh of a part belongs to it. `mesh.userData.noCollide = true` marks visual-only meshes that are
  excluded from collision checks (gas, belt, springs, glow, labels). Use it sparingly and never for a real moving solid.
- `mesh.userData.housing = true` marks housing meshes the UI may ghost / cut / hide.
- `mesh.userData.capShell = true` marks the distributor cap shell (`ignCap`): the UI makes it transparent instead of hiding it, so the rotor and terminals stay visible.
- Use `partGroup(id, body, label, extra)` from `src/geo/parts.js` to create parts.

Body names (fixed — the sim's power-flow highlighting and the collision rules use them):

| body | parts (Czech label) |
|---|---|
| `block` (static) | blok motoru, ložiska klikového hřídele |
| `head` (static) | hlava válců, zapalovací svíčky, víka ložisek vaček, rozdělovač (`ignDistributor`), víko rozdělovače (`ignCap`), zapalovací cívka (`ignCoil`), koncovky kabelů svíček (`ignBoot1..4`) |
| `crank` | klikový hřídel, řemenice rozvodu, setrvačník, víko spojky (štít), pilotní ložisko (`pilotBearing`, podpírá přední čep vstupního hřídele) |
| `piston1..4` | píst + pístní čep + kroužky |
| `rod1..4` | ojnice |
| `camIn`, `camEx` | sací / výfuková vačková hřídel + vačky + řemenice (`camIn` also carries the distributor rotor `ignRotor`, palec rozdělovače) |
| `valveIn{1..4}{a,b}`, `valveEx{1..4}{a,b}` | ventil + miska pružiny + hrníčkové zdvihátko |
| `pressurePlate` | přítlačný kotouč |
| `finger01..finger18` | jazýčky talířové pružiny (each a rigid lever) |
| `clutchDisc` | spojková lamela |
| `releaseBearing`, `releaseFork` | vypínací ložisko, vypínací vidlice |
| `bellhousing` (static) | zvon spojky |
| `inputShaft` | vstupní hřídel + ozubené kolo stálého záběru (34 z) + jeho unášecí zuby a kužel |
| `counterShaft` | předlohový hřídel se všemi koly |
| `mainShaft` | výstupní hřídel + náboje synchronů + kolo zpátečky (50 z) + příruba |
| `gear1`, `gear2`, `gear3`, `gear5` | volná kola 1., 2., 3., 5. stupně (rim + dog ring + cone) |
| `idlerR` | vložené kolo zpátečky |
| `sleeve12`, `sleeve34`, `sleeve5` | přesuvné objímky |
| `ring1`, `ring2`, `ring3`, `ring4`, `ring5` | synchronizační (clonicí) kroužky; ring4 = the one facing the input gear |
| `fork12`, `fork34`, `fork5` | řadicí vidlice + tyč (fork5 also carries the reverse-idler fork) |
| `shiftLever` | řadicí páka |
| `gearCase` (static) | skříň převodovky (walls, quill, idler shaft, rail guides) |

Visual-only (noCollide) parts: `belt`, `spring*`, `gas1..4`, `spark1..4`, `ignLead1..4`, `ignLeadCoil`, `ignFlash1..4`, `ignFlashCoil`.

## 4. Module interface

Every `src/model/*.js` exports one builder:

```js
export function buildXxx(spec = SPEC) {
  // create geometry once, return
  return { group /* THREE.Group */, update(pose) /* set transforms only; no geometry rebuild unless noted */ };
}
```
`update(pose)` must be a pure function of `pose` (no dependence on previous calls) and cheap (called every frame).
All dependent motion (piston height, rod angle, valve lift, finger angle, fork position …) is computed inside `update`
from `pose` with the `src/kin/*` functions.

## 5. Pose

```js
pose = {
  crank,                       // rad
  camIn, camEx,                // rad, = crank / 2 (both cams turn in the crank direction)
  clutchPedal,                 // 0 (released, clutch engaged) … 1 (floored)
  input, counter, main,        // shaft angles, rad. clutch disc angle = input
  gears: { g1, g2, g3, g5, idler },      // rad
  idlerX,                      // mm; = sleeves.s5 (idler fork is rigid on the 5th/reverse rail): −9.5 reverse, 0 neutral, +9.5 in 5th (idle)
  sleeves: { s12, s34, s5 },   // mm from hub centre, + = toward rear. rails/forks follow the sleeves 1:1
  rings: { ring1, ring2, ring3, ring4, ring5 },   // each { angle (rad, absolute), push (0 … 1) } push 1 = pressed on the cone
  lever: { col, row },         // each −1 … 1 (continuous); see SPEC.gearbox.shift.gate
  cylinders: [ { psiDeg, stroke, burn, pBar, tempK, spark, flash } ×4 ],   // gas state, visual only; flash 0…1 = spark flash envelope (1 at the spark, 0 after SPEC.engine.ignition.flashDeg crank deg); the app may raise flash for a short wall-clock hold and then sets flashAngle = the angle-only value (drives the rotor arc)
  flow: Set<string>            // bodies currently carrying drive torque (for highlighting), visual only
}
```
`poseAt(overrides)` in `src/kin/pose.js` returns a complete, kinematically consistent neutral pose for a given
`{ crank, input, main, clutchPedal, sleeves, idlerX, ... }` (missing fields default to neutral/consistent values);
tests use it to sweep.

## 6. Tessellation and clearances

- Circular sections: ≥ 48 segments, 64 for radii > 30 mm, 96 for radii > 100 mm.
- Parts in a sliding/rotating fit are modelled with the MODEL clearances in SPEC (≥ 0.2 mm radial) so that polygonal
  approximations never intersect. Never model an interference/press fit between two different bodies — give it the
  clearance, or make both parts the same body.
- Pairs that touch by design (cam–bucket, valve–seat, clamped clutch faces, finger–plate, gear flanks, cone–ring,
  chamfer–chamfer) keep the small MODEL gap given in SPEC (`contactGap`, `seatGap`, `faceGap`, backlash). The collision
  tests verify these with two-sided perturbation: no intersection at nominal, intersection when pushed together by
  ~0.3 mm.
- Each body's meshes should be closed, reasonably clean solids; total triangle budget ≈ 1.2 M for the whole model.

## 7. Verification pipeline (`npm run verify`)

1. `vitest run` — kinematic invariants, simulation scenarios, collision sweeps (engine 0–720°, clutch pedal sweep,
   every gear, every shift played through the simulator), negative controls proving the detector fires.
2. `vite build` — the app bundles.
3. `node verify/visual.mjs` — headless Chrome loads the built app, drives it through `window.__app`, fails on console
   errors or blank canvas, writes screenshots to `verify/out/`.
