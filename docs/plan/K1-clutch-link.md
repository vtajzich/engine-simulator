# K1 — Clutch: make "connected / disconnected" visible

## Problem (user report)

Chapter `spojka`, housing mode "Řez" (cut): pressing the clutch changes nothing visible. The true gaps are 0.9 mm
(< 1 px in the "Celek" view), the section hides rotation of axisymmetric parts, in neutral the input shaft keeps
coasting for many seconds (795 → 536 rpm after 4 s), and the blue input-shaft pilot visibly plugs into the orange
crank with nothing between them. The user wants to see **how the shaft is disconnected from the engine and through
which parts the force (torque) passes**.

Do **not** change clutch dimensions or kinematics (`SPEC.clutch`, `src/kin/clutch.js`) — the geometry is correct and
verified. Add state-driven cues.

## Files you own (nobody else edits them now)

`src/model/clutch.js`, `src/app/clutchLink.js` (new), `src/app/main.js`, `src/app/loop.js`, `src/app/style.css`,
`src/app/content/cs.js`, `src/app/content/en.js`, `verify/visual.mjs`, `test/collision/clutch.test.js`.

Do **not** touch: `src/spec.js`, `src/kin/**`, `src/geo/**`, `src/model/topEnd.js`, `src/app/housing.js`,
`test/kin/**`, `test/collision/topEnd.test.js`, `docs/design.md`, `README.md` (another agent is working there in
parallel). Do not commit.

## 1. Model additions (`src/model/clutch.js`)

1. **Pilot bearing** — new part `partGroup('pilotBearing', 'crank', 'Pilotní ložisko')`, rotating with the crank
   (`rotation.x = pose.crank` in `update`). It sits in the free space of the flywheel centre hole
   (hole radius 22, x 361 … 378.5) around the input-shaft pilot (Ø15, x 351 … 378):
   - outer ring: lathe ring radius 11 … 13, x 362 … 372
   - inner ring: radius 7.75 … 9.5, x 362 … 372 (0.25 mm radial clearance to the Ø15 pilot; modelled on the crank
     body — simplification)
   - 8 balls radius 1.55 on radius 10.25 at x = 367 (`SphereGeometry`, real solids, not noCollide)
   - material `mat('polished')`.
   Use `lathePoly` / `merge` like the other parts. Radii/positions go into `LOCAL` (`pilot: {...}`), derived from
   `spec.gearbox.shafts.inputPilotDiameter` for the bore (`inputPilotDiameter / 2 + 0.25`).
2. **Index mark on the disc hub** — a white stripe so the driven side's rotation/standstill is readable:
   `boxAt(20, 1.0, 3.5, xc, hubOD/2 + 0.5, 0)` (20 mm along X, on the hub's outer surface), `MeshBasicMaterial`
   white, `userData.noCollide = true`, added to the `clutchDisc` part (it then follows `disc.rotation.x`).
3. Verify: `npx vitest run test/collision/clutch.test.js test/kin/clutch.test.js` green. Add one test to
   `test/collision/clutch.test.js`: the `pilotBearing` part exists, has body `crank`, and its bounding box lies within
   radius ≤ 13.1 and x ∈ [361.9, 372.1].
   Then check crank ↔ inputShaft in the whole assembly with a throw-away node script (scratch, not committed) using
   `test/collision/_assembly.js` + `verify/collide.js` (`bodiesIntersect`) at crank = 0 and crank = 1 rad with
   input = 0: must not intersect. Report the result.

## 2. Overlay `src/app/clutchLink.js` (new)

An SVG overlay on the stage (same host element and projection approach as `src/app/gapmarks.js`: project 3D points
with `scene.camera`, write pixel coordinates). `pointer-events: none`. It draws, in the section plane z = 0, upper half
(world point = `(x, rho, 0)`):

```js
export function createClutchLink({ app, scene, host }) → { update(dtSeconds), get state() }
```

### Geometry (all from SPEC / `clutchStack(spec)` / `releaseKin(pedal)`; no hard-coded duplicates of SPEC numbers)

Let `st = clutchStack()`, `k = releaseKin(state.clutchPedal)`, `Rm = (disc.outerDiameter + disc.innerDiameter) / 4`
(mean friction radius ≈ 93.75), `fw = SPEC.clutch.flywheel.x`, `xd = st.discFrontX + disc.thickness/2 + k.discShift`
(disc mid plane), `xp0 = st.plateFrontX + k.plateLift`, `xp1 = st.plateRearX + k.plateLift`.

- **E1 (engine → flywheel face):** `(fw[0]-16, 0) → (fw[0]-5, 30) → ((fw[0]+fw[1])/2, 60) → ((fw[0]+fw[1])/2, Rm) → (fw[1], Rm)`
- **E2 (engine → cover → pressure-plate face):** starts where E1 turns: `((fw[0]+fw[1])/2, Rm) → ((fw[0]+fw[1])/2, 131)
  → (fw[1]+3, 136.5) → (428, 136.5) → (428, 118) → (xp1, 118) → ((xp0+xp1)/2, Rm) → (xp0, Rm)`
  (flywheel → cover bolts → cover → drive straps → pressure plate; 131 = bolt circle, 136.5 = middle of the cover
  wall, 118 = strap radius, 428 = inside of the cover rear wall — take these from `LOCAL` in clutch.js by exporting a
  small `CLUTCH_PATH` object from `src/model/clutch.js` rather than retyping them).
- **D (driven side):** two short entries `(st.discFrontX + k.discShift, Rm) → (xd, Rm)` and
  `(st.discRearX + k.discShift, Rm) → (xd, Rm)`, then `(xd, Rm) → (xd, disc.damperRadius) → (xd, disc.hubOD/2)
  → (xd + 8, shafts.inputDiameter/2) → (gearbox.walls.front[0] + 10, shafts.inputDiameter/2)`.
- **Interfaces A and B:** segments along the faces, radius `disc.innerDiameter/2 … disc.outerDiameter/2`:
  A between the flywheel face `fw[1]` and the disc front face; B between the disc rear face and the pressure-plate
  front face. For each compute both face lines in pixels.

### Drawing

- Every path: a dark underlay (`stroke #0b0f14`, width 8) plus a dashed coloured stroke (width 4,
  `stroke-dasharray: 12 9`, round caps). Dashes move toward the gearbox by changing `stroke-dashoffset` in `update(dt)`:
  speed px/s = `clamp(rpm / 800 * 70, 0, 220)`; E1/E2 use the engine rpm (`state.omegaCrank * 30/π`), D uses the
  input-shaft rpm (`state.omegaInput * 30/π`, signed). Not scaled by slow motion.
- Colours: E1/E2 `#ffd23f`; D `#e8f6ff` while |input rpm| ≥ 5, otherwise static grey `#7f8a96` (class `stopped`).
- Interfaces by state (see below):
  - `locked`: one bright line `#fff27a`, width 7 px, on the contact (class `grip`).
  - `slip`: same line, colour `#ff5a36`, width `3 + 4 * capFraction`, CSS flicker animation (class `slip`).
  - `open`: draw the two faces as two thin light lines (`#dfe7ee`, 1.5 px) separated by a **dark band** (`#05070a`)
    whose pixel width is `max(6, projected real gap)`, centred on the real gap (class `gap`). This is the only place
    where the picture is exaggerated; it is an annotation, the 3D parts keep their true 0.9 mm gap.
- Three DOM tags (reuse the `.gapmark` look, new class `.linktag`):
  - near `(fw[0] - 5, 150)` (top of the flywheel): `${ui.clutchLink.engine} ${rpm} ${ui.rpm}`
  - near `(walls.front[0] - 25, shafts.inputDiameter/2 + 14)`: `${ui.clutchLink.shaft} ${rpm} ${ui.rpm}`
  - near `(st.discFrontX + disc.thickness/2, disc.outerDiameter/2 + 14)`: the state text
    `ui.clutchLink.locked | slip | open`, with class `locked | slip | open` (green / orange-red / blue-grey chip).
  rpm rounded to integers; use `num()` from `content/index.js` like gapmarks does.

### State

```js
const cap = state.clutch.capacityNm / SPEC.clutch.maxTorqueNm;       // 0 … 1
state = cap <= 1e-6 ? 'open' : state.clutch.locked ? 'locked' : 'slip';
```
Expose `state` (string), plus `engineRpm`, `inputRpm` on the returned object for tests.

### Visibility

Shown only when `app.chapter?.clutchLink === true` **and** the labels layer is on (`app.labels.on`). Hidden elements
use `display: none`. Add `clutchLink: true` to the `spojka` chapter. Works in both views (`celek`, `detail`).

### Wiring

- `main.js`: `app.clutchLink = createClutchLink({ app, scene, host: stage })` next to `app.gapMarks`.
- `loop.js` `frame()`: call `app.clutchLink.update(rdt)` every frame (also when paused; when paused pass 0 so dashes
  freeze) and `scene.markDirty()` is **not** needed for it (it is DOM/SVG, not WebGL).
- Expose it on the test hook (`window.__app.app.clutchLink` is already reachable through `app`).

## 3. Content (`cs.js` and `en.js` — keep both languages in parity; read `content/index.js` to see how `en.chapterText`
overlays the Czech chapters and how `ui` strings and `partLabels` / glossary are structured)

- `ui.clutchLink = { engine: 'motor', shaft: 'lamela + vstupní hřídel', locked: 'SPOJENO · tření drží', slip: 'PROKLUZUJE', open: 'ROZPOJENO · mezera' }`
  EN: `{ engine: 'engine', shaft: 'disc + input shaft', locked: 'COUPLED · friction grips', slip: 'SLIPPING', open: 'DISCONNECTED · gap' }`
- Chapter `spojka`:
  - add `clutchLink: true`;
  - tint: add `['pilotBearing', '#e6ebf0']` **before** the `['crank', …]` entry (first match wins);
  - labels: add `{ id: 'pilotBearing', a: 't', dx: -90, dy: -90 }` (adjust offsets so it does not overlap others);
  - new first paragraph of `html` (CZ, translate for EN):
    „<b>Kudy jde síla:</b> žlutá čárkovaná stopa ukazuje cestu točivého momentu. Z klikového hřídele jde do
    setrvačníku a dvěma větvemi na <b>dvě třecí plochy</b>: přímo z čela setrvačníku a oklikou přes víko spojky a
    přítlačný kotouč. Přes tření přejde do obložení lamely, tlumicími pružinami do náboje a drážkováním na vstupní
    hřídel. <b>Jiné spojení mezi motorem a převodovkou není</b> – přední čep vstupního hřídele se v klikovém hřídeli
    jen volně otáčí v pilotním ložisku.“
  - new second paragraph:
    „Sešlápnutím pedálu se obě třecí plochy rozestoupí (v obrázku tmavá mezera, zvětšená, aby byla vidět – skutečně
    0,9 mm) a stopa na nich končí: motor běží dál, lamela se vstupním hřídelem doběhne a zastaví se.“
  - notice: replace the first bullet by:
    „Zkuste „Ukázat rozpojení“: zařadí se jednička, auto stojí na brzdě – setrvačník se točí, lamela a vstupní hřídel
    stojí (bílá značka na náboji lamely se nehýbe). Pak „Pustit brzdu“: spojka chvíli prokluzuje a sepne.“
  - legend: add `['#ffd23f', 'cesta točivého momentu (čárky běží rychlostí otáčení)']`;
  - actions: put first
    `{ label: 'Ukázat rozpojení (1. stupeň, stojí)', run: a => { a.setAssist(true); a.setInputs({ throttle: 0, brake: 1, clutchPedal: 0, ignition: true }); a.requestGear('1'); } }`
    and `{ label: 'Pustit brzdu – rozjezd', run: a => a.setInputs({ brake: 0 }) }`; keep the existing three.
    Check the real names of the input fields (`brake`, `clutchPedal`, …) in `src/app/main.js` / `src/sim/driver.js`.
- Glossary (both languages): entry for `pilotBearing` — CZ title „Pilotní ložisko“, text „Malé ložisko v ose
  klikového hřídele, které podpírá přední čep vstupního hřídele převodovky. Točivý moment nepřenáší – při rozpojené
  spojce se v něm hřídel volně otáčí vůči motoru.“; EN `partLabels['Pilotní ložisko'] = 'Pilot bearing'`.
- Part-card/glossary text of `clutchDisc` may stay.

## 4. Checks in `verify/visual.mjs` (follow the existing `check(name, ok, detail)` pattern; wall-clock waits like the
existing `wallClock` section)

1. **Pedal makes a visible difference in the cut view.** `setChapter('spojka')`, view `celek`, housing `cut`,
   paused, pedal 0 → screenshot of the stage clipped to the projected clutch box (project the 8 corners of
   x ∈ [355, 450], y ∈ [−150, 160], z = 0), then pedal 1 (set `sim.state.clutchPedal = 1` and
   `sim.state.clutch.capacityNm = 0`, `locked = false`, or simply un-pause and wait until
   `clutchLink.state === 'open'`, then pause) → second screenshot. Decode both PNGs in the page
   (`createImageBitmap` + canvas) or compare via `page.evaluate`; assert **≥ 1500 changed pixels** (per-channel
   difference > 24) at 1280×720. Save both as `34-clutch-link-0` / `35-clutch-link-1`.
2. **State classes.** Idle in neutral, pedal 0 → `clutchLink.state === 'locked'`; pedal 1, after ≤ 1.5 s →
   `'open'`.
3. **Demo.** Click the real button „Ukázat rozpojení…“ (find by text in the panel), wait up to 6 s wall-clock:
   engine rpm > 600, |input rpm| < 5, state `'open'`, gear 1 engaged. Then click „Pustit brzdu – rozjezd“: within
   8 s state becomes `'locked'`, vehicle speed > 3 km/h, no stall event. Screenshot `36-clutch-demo-open`.
4. English: with `?lang=en` the three tags contain the English strings (extend the existing English scan).

Run: `npx vitest run test/collision/clutch.test.js test/kin/clutch.test.js test/sim`, `npx vite build`,
`node verify/visual.mjs` (the last one must end with `VISUAL CHECK PASSED`). Do not run the whole `npm run verify`
(the collision suite is being changed by another agent in parallel) and do not start a dev server.

## Report back

Changed files, the three verification outputs (test summary lines, build ok, visual summary line), the measured
changed-pixel count, and anything in this brief that did not match the code.
