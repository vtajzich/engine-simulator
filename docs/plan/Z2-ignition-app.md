# Z2 — Ignition in the app: always-visible plugs and spark, transparent distributor cap, content, checks

Prerequisite: Z1 (model) is done — parts `ignRotor`, `ignDistributor`, `ignCap` (shell mesh flagged
`userData.capShell = true`), `ignCoil`, `ignBoot1..4`, `ignLead1..4`, `ignLeadCoil`, `ignFlash1..4`, `ignFlashCoil`
exist in `src/model/topEnd.js`; `pose.cylinders[i].flash` (0…1) drives the flash meshes; `src/kin/ignition.js`
exports `sparkAdvanceDeg`, `sparkCrankDeg`, `rotorAngle`, `terminalAngle`, `terminalOrder`, `flashOf`.
K1 (clutch overlay) is done too; do not change its behaviour.

User requirements (Czech original): spark plugs must always be visible, both with housings "Skryté" (hidden) and
"Řez" (cut). The spark must be visible and synchronised with the engine. With housings hidden the distributor cap
becomes transparent and the rotor is seen handing the spark over, in sync with the plug.

Read first: `docs/design.md`, `src/app/main.js`, `src/app/loop.js`, `src/app/housing.js`, `src/app/highlight.js`,
`src/app/modelIndex.js`, `src/app/content/{cs,en,index}.js`, `verify/visual.mjs`, `src/kin/ignition.js`.
Do not commit. Do not start a dev server (`verify/visual.mjs` serves `dist/` itself).

## 1. Distributor cap display (`src/app/modelIndex.js`, `src/app/housing.js`)

- Index the meshes with `userData.capShell` (list `index.capShells` or a flag on the index entries).
- In `createHousing().set(mode)`: for cap-shell materials — `solid` → opaque (`transparent = false`, `opacity = 1`,
  `depthWrite = true`); `ghost`, `cut`, `hidden` → `transparent = true`, `opacity = 0.22`, `depthWrite = false`.
  The cap is never hidden and never clipped by the housing plane. `needsUpdate = true`.
- The highlighter (`highlight.js`) also rewrites materials (focus dimming, tint, flow). Make sure it does not undo the
  cap rule: read how it stores/restores material state and apply the cap opacity **after** it (or teach the
  highlighter to skip `capShell` meshes). Verify in the browser check below, not by reasoning.

## 2. Spark flash persistence (`src/app/loop.js`)

The model shows a flash from the pose alone (`flash` = 1 → 0 over 12 crank degrees after the spark), which is enough
while paused / scrubbing the crank. At real speed that is shorter than one frame, so add a wall-clock hold in the
frame loop (keep `assembly.update(pose)` pure — only the pose is changed):

```js
// in updatePose(), after app.pose = poseFromState(state), only when !app.paused:
//   for each cylinder i: psi = pose.cylinders[i].psiDeg; psiS = 720 − sparkAdvanceDeg(throttle used by poseFromState)
//   d = mod(psi − prevPsi[i], 720); crossed = state.engine.running && d > 0 && d < 360 && mod(psiS − prevPsi[i], 720) < d
//   (also treat "pose flash > 0 now" as crossed) → tSpark[i] = performance.now()
//   hold = max(0, 1 − (now − tSpark[i]) / 120 ms);  pose.cylinders[i].flash = max(pose.cylinders[i].flash ?? 0, hold)
//   prevPsi[i] = psi
```
When the engine is not running no new holds start (a hold in progress just fades). On chapter change / reset clear
`prevPsi`. Check the exact field names in `sim.state` (`engine.running`, throttle) before writing.

## 3. Focus / layers (`src/app/main.js`, `src/app/content/cs.js`)

- The new ids start with `ign`, so the Gas layer regex `/^(gas|spark)\d/` does not catch them — keep it that way
  (the ignition flash is independent of the "Plyn" layer).
- Chapter focus lists dim everything not listed. Add to the engine chapters:
  `ctyri-doby`: `'ignBoot1', 'ignLead1', 'ignFlash1'`; `rozvod`: `'ign'`; `poradi`: `'sparkPlug', 'ign'`.
  In the transverse section view of `ctyri-doby` check that lead 1 does not clutter the picture; if it does, drop
  `ignLead1` there.

## 4. Content — chapter `poradi` (both languages in parity; read `content/index.js` for the overlay mechanism)

- New paragraph (CZ; translate for EN):
  „<b>Kdo rozhoduje, která svíčka dostane jiskru:</b> <b>rozdělovač</b> na zadním konci sací vačkové hřídele. Jeho
  <b>palec</b> se otáčí s vačkou, tedy poloviční rychlostí klikového hřídele – jednu otáčku za celý cyklus 720°.
  Zapalovací cívka pošle vysoké napětí středním kabelem na střed víka, palec ho přivede k jednomu ze čtyř kontaktů a
  jiskra přeskočí malou mezeru (0,8 mm) na kontakt, odkud jde kabelem ke svíčce. Kontakty jsou po obvodu víka po 90°
  v pořadí <b>1 – 3 – 4 – 2</b> ve směru otáčení.“
- New paragraph: „Předstih zážehu (10–30° před HÚ) mění okamžik jiskry o 5–15° otáčení palce; proto má palec široký
  hrot, který kontakt překrývá v celém rozsahu.“
- New view (the chapter gets `views`): `{ id: 'zapalovani', label: 'Rozdělovač a svíčky', housing: 'hidden',
  camera: … }` — camera behind and above the engine on the intake side so that the cap (rear end of the intake cam,
  x ≈ 349…446, y ≈ 339, z ≈ +53), the four boots and the leads are all in frame; choose the numbers by looking at a
  screenshot. Keep the existing camera as the first view (`id: 'pisty'`, label „Písty a zdvihy“).
- Labels in that view: `ignCap`, `ignRotor`, `ignCoil`, `sparkPlug1` (labels are per chapter; if labels cannot be
  per view, pick offsets that work in both).
- Notice bullets: „Přepněte skříně: při „Skryté“, „Průhledné“ a „Řez“ je víko rozdělovače průhledné a je vidět palec;
  při „Plné“ je víko neprůhledné.“ and „Záblesk u svíčky, na kabelu a mezi palcem a kontaktem patří vždy stejnému
  válci. Jiskra je vidět i bez vrstvy „Plyn“.“
- Legend: `['#fff4b0', 'jiskra: palec → kontakt víka → kabel → svíčka']`, `['#d62828', 'vysokonapěťové kabely']`.
- Glossary (CZ + EN): Rozdělovač (`ignDistributor`), Palec rozdělovače (`ignRotor`), Víko rozdělovače (`ignCap`),
  Zapalovací cívka (`ignCoil`), Kabel svíčky (`ignLead`, `ignBoot`). Extend the existing spark-plug entry with one
  sentence that the plug sits in the centre of the chamber between the camshafts.
- EN `partLabels` for every new Czech part label (use the existing per-cylinder loop for the numbered ones):
  Palec rozdělovače → Distributor rotor, Rozdělovač → Distributor, Víko rozdělovače → Distributor cap,
  Zapalovací cívka → Ignition coil, Koncovka kabelu svíčky n → Plug boot n, Kabel svíčky n → Plug lead n,
  Kabel od cívky → Coil lead, Jiskra zapalování n → Ignition spark n, Jiskra – přívod od cívky → Coil lead spark,
  Pilotní ložisko → Pilot bearing (if K1 has not added it).
- "Zjednodušení" tab (both languages): external coil (some versions integrate it), no breaker / igniter shown, the
  advance is computed (not a mechanical advance unit), leads are illustrative.

## 5. Checks in `verify/visual.mjs` (existing `check(name, ok, detail)` pattern)

1. **Plugs visible.** Chapter `prehled`, camera `{ position: [150, 760, 260], target: [150, 300, 0] }`, housing
   `hidden`, then `cut`: for each cylinder cast a `THREE.Raycaster` from the camera to the world centre of
   `ignBoot{n}`; the first hit among visible meshes must belong to a part whose id starts with `ign` or `sparkPlug`.
   8 checks (4 × 2 modes).
2. **Cap by mode.** For `solid`: cap shell material `transparent === false`, `opacity === 1`. For `ghost`, `cut`,
   `hidden`: `transparent === true`, `opacity < 0.5`, `mesh.visible === true`, and the `ignRotor` meshes visible.
   Run it once in chapter `prehled` and once in chapter `poradi` (focus active) to catch the highlighter overriding it.
3. **Sync by angle (paused).** For each cylinder c: put the crank at `sparkCrankDeg(c, thr) + 1°` (use the app's
   crank-rotation hook, e.g. `app.rotateCrank` / the "Úhel kliky" path — see how existing checks set the crank) →
   `ignFlash{c+1}` has a visible mesh, the other three do not.
4. **Sync while running (wall clock).** Engine idling, slow 1/20: sample every animation frame for 4 s; record the
   order in which the four `ignFlash` parts become visible → cyclic order 1-3-4-2 with no other order observed.
   At 1× speed for 2 s: each of the four seen visible at least once (hold works). After "Vypnout motor" and rpm 0:
   within the following 1.5 s no flash visible.
5. **Gas layer independence.** Gas layer off → check 3 still passes for one cylinder.
6. Screenshots `40-ignition-hidden`, `41-ignition-cut`, `42-ignition-solid` in the new view; English scan covers the
   new strings.

## 6. Docs

`README.md`: one row / paragraph on the ignition (distributor, always-visible spark, cap transparency by mode) and
the new pipeline checks; mention the clutch torque-path overlay in the paragraph that describes the clutch chapter
if K1 has not. `docs/design.md`: add `pilotBearing` to the `crank` row if missing.

## Verify and report

`npx vitest run test/kin test/sim test/collision/topEnd.test.js`, `npx vite build`, `node verify/visual.mjs`
(must end with `VISUAL CHECK PASSED`). Look at the three screenshots yourself and describe what is visible
(cap, rotor, leads, boots, flash). Report changed files, summary lines, and every deviation from this brief.
