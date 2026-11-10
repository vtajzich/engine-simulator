# Task E — interactive browser app (`index.html`, `src/app/**`, `verify/visual.mjs`)

Read first: `docs/design.md`, `src/spec.js`, `docs/research.md` (all of it — the Czech explanations must be mechanically
correct; §8 lists misconceptions to avoid and to call out), `docs/plan/A2-simulation.md` (simulation + driver API),
`src/kin/pose.js`, `src/model/assembly.js`, `src/geo/materials.js`, `src/geo/parts.js`.
If your Skill tool lists `frontend-design:frontend-design`, invoke it before designing the UI.

You build the user-facing product: a single-page Vite app (vanilla JS + Three.js, no framework, no new dependencies)
that shows the 3D model, lets the user drive it, and explains — in Czech, with full diacritics — how a four-stroke
engine, a clutch and a manual gearbox work. The model modules (`src/model/*`) and the simulator (`src/sim/*`) are being
written by other agents right now: some `buildXxx` may still be stubs returning empty groups and `src/sim/sim.js` may
not exist yet when you start. Code strictly against the documented interfaces, guard for missing pieces (e.g. a part
id that does not exist yet must not crash the app), and re-test near the end with whatever has landed.
Do not edit anything outside `index.html`, `src/app/**`, `verify/visual.mjs`, `vite.config.js`, `public/**`.

## 1. Runtime architecture (`src/app/`)
- `main.js` — boot: loading screen → `buildAssembly()` (takes a few seconds: yield to the browser first so the loading
  screen paints) → scene → UI → loop. Exposes `window.__app` (see §6).
- `scene.js` — WebGLRenderer (antialias, sRGB output, ACES filmic tone mapping, `localClippingEnabled = true`),
  environment from `RoomEnvironment` + PMREM (metals need reflections), a key light and soft fill, dark neutral
  background, `OrbitControls` with damping, camera presets with smooth tweens (position + target), resize handling,
  devicePixelRatio capped at 2. Scene units are millimetres: the whole assembly spans X ≈ −115…860, Y ≈ −140…420;
  near/far ≈ 5 / 8000.
- `loop.js` — owns `sim` (`createSim`), `driver` (`createDriver`), the input state, time scale and pause;
  each frame: `inputs = assisted ? driver.update(dt, userInputs) : userInputs`; `sim.step(dt * timeScale, inputs)`;
  `pose = poseFromState(sim.state)`; `assembly.update(pose)`; render. Clamp frame dt to 50 ms.
  When paused, dragging the crank scrubber calls `sim.rotateCrank(dθ)`.
- `housing.js` — display modes for meshes with `userData.housing`: `ghost` (transparent ≈ 0.14, `depthWrite: false`),
  `cut` (a clipping plane removes the +Z… pick the half facing the default camera; `DoubleSide`), `solid`, `hidden`.
  All housing meshes share `mat('housing')`; restyle that material (and restore it).
- `highlight.js` — per-body emphasis without touching shared materials permanently: power-flow glow for bodies in
  `pose.flow` (warm emissive), selection highlight, and "focus" (everything outside the chapter's focus group dimmed).
  Give each mesh a lazily created highlighted clone of its material and swap `mesh.material`.
- `picking.js` — hover/click raycast → nearest ancestor with `userData.part` → tooltip with the Czech `label`; click
  selects the part and opens its glossary card. Ignore `noCollide` gas meshes for picking.
- `labels.js` — optional floating labels (DOM elements projected from part bounding-box centres) for the parts a chapter lists.
- `ui/*.js` — DOM panels (see §3). `content/cs.js` — all Czech text (chapters, glossary, UI strings).
- `diagrams.js` — 2D canvases: timing strip, p–V diagram, tachometer/speedometer.

## 2. Interaction model
One continuous simulation; "chapters" are presets on top of it (camera, focus, housing mode, time scale, a scripted
situation) with explanatory text. The user can always orbit, pause, scrub, and change every control.
- Time scale presets: 1×, 1/4, 1/20, 1/100, 1/500 (label them "Rychlost přehrávání"); show the real engine rpm next
  to it so slow motion is not mistaken for low revs.
- Engine: throttle (slider; hold `W`/`↑`), ignition/start button, stall message.
- Clutch pedal (slider; hold `Space`), brake (slider; hold `S`/`↓`).
- Gear lever: clickable H-pattern (1 3 5 / 2 4 R) with N in the middle; keys `1`–`5`, `R`, `N` or `0`.
  Toggle "Asistent spojky" (default ON): when on, a gear request goes to `driver.request(gear)` which operates the clutch
  correctly; when off, the lever goes straight to `inputs.lever` and the user must use the clutch — the app then shows
  what goes wrong (events `grind`, `stall`).
- Events from `sim.drainEvents()` → short Czech toasts: stall "Motor zhasl – spojka sepnula při stojícím voze",
  grind/clutch "Synchron blokuje: bez vyšlápnuté spojky se otáčky nesrovnají", grind/reverse "Zpátečka není
  synchronizovaná – zastavte a počkejte, až se hřídele dotočí", gearEngaged, syncStart/syncDone (as a small phase
  indicator rather than a toast).
- Readouts (always visible, compact): tachometer, speed km/h, engaged gear + overall ratio, rpm of crank / input shaft /
  countershaft / output shaft (signed; countershaft and reverse are negative = opposite direction — say so), clutch state
  (sepnutá / prokluzuje / rozepnutá) with transmitted torque, synchronizer phase when a shift is in progress.
- View toggles: housing mode, visibility of groups (Motor / Spojka / Převodovka), gas visualisation, power-flow
  highlight, labels.

## 3. Layout and visual design
Full-window 3D canvas; a right-hand panel (≈ 380 px, collapsible) with the chapter list, the chapter text and its
diagram; a bottom dock with driving controls and gauges; a small top-left toolbar for view toggles. Must stay usable at
1280×720. Aim for a distinctive "technical workshop manual" look — dark graphite surfaces, fine hairlines, one warm
accent (amber/orange, also used for power-flow glow) and one cool accent (intake blue), tabular monospaced numerals for
readouts, restrained motion. No generic dashboard look, no purple gradients, no emoji icons (inline SVG icons).
Fonts: system stacks only (no network access can be assumed).

## 4. Chapters (`content/cs.js`) — write real, accurate teaching text (≈ 80–160 words each, plus 3–5 bullet "Všimněte si")
Each chapter: `{ id, title, html, notice[], camera: {position, target}, focus: [body-name prefixes], housing,
timeScale, setup(app), diagram }`. `setup` puts the simulation into the right situation (it may fast-forward the sim
without rendering, e.g. accelerate in 1st to 3500 rpm, then slow time and request a shift) and offers a
"Přehrát znovu" button.
1. `prehled` Přehled ústrojí — path of power: klikový hřídel → setrvačník → spojka → vstupní hřídel → předlohový hřídel
   → kolo zvoleného stupně → výstupní hřídel. Idle in neutral, ghost housings.
2. `klika` Klikový mechanismus — piston/rod/crank; stroke = 2 × crank radius; piston motion is not sinusoidal (max speed
   ≈ 74° after TDC, not at 90°); pistons 1+4 and 2+3 move together; counterweights. Housing cut, slow motion.
3. `ctyri-doby` Čtyři doby — sání, komprese, expanze, výfuk on cylinder 1 with the gas colours; spark before TDC
   (předstih), peak pressure ≈ 10–16° after TDC; compression ratio 11:1. Diagram: p–V loop with a moving point.
4. `rozvod` Rozvod — camshafts turn at half crank speed (belt 18:36 teeth), bucket tappets, valve lift 8.56/8.31 mm,
   events (SO 10° před HÚ, SZ 58° za DÚ, VO 58° před DÚ, VZ 10° za HÚ), overlap (střih ventilů) 20°, valve lash,
   why an interference engine destroys valves when the belt breaks. Diagram: timing strip.
5. `poradi` Pořadí zapalování 1–3–4–2 — one power stroke every 180°; table of what each cylinder does now.
   Diagram: 4-row timing strip (strokes, valve-open bars, spark marks, moving cursor).
6. `spojka` Setrvačník a spojka — what is bolted/splined to what, what turns with the engine vs. with the gearbox, the
   diaphragm spring as a lever (bearing travel ≈ 9.8 mm → plate lift 1.8 mm), slip zone. Let the user move the pedal.
7. `prevodovka` Uspořádání převodovky — three shafts, constant mesh, free gears on the output shaft, hubs fixed to it;
   in neutral with the clutch engaged the countershaft and all free gears spin, only the output shaft stands still.
8. `tok-vykonu` Řazení a tok výkonu — per-gear power path with glow, ratio table (teeth and resulting ratio from
   `derive().gearbox`), 4th = direct drive (countershaft idles), 5th = overdrive.
9. `synchron` Synchronizace — slow-motion 1→2 shift: sleeve, blocker (clonicí/synchronizační) ring, cone friction,
   blocking until speeds match, indexing by the pointed teeth, engagement; why the clutch must be disengaged.
10. `zpatecka` Zpátečka — sliding straight-cut idler reverses rotation; not synchronised (why it grinds when the car
    or the input shaft still moves); ratio.
11. `jizda` Jízda — free driving with all controls and gauges; hints for trying a launch, a missed shift, a stall.
Glossary (`glossary` keyed by part id prefix → `{ title, text }`), ≥ 30 entries covering every body family in design.md §3.
Also a short "Zjednodušení modelu" (model simplifications) section reachable from the panel: enlarged clearances,
diaphragm spring drawn as 18 rigid levers, valve head sizes reduced, idealised gas/pressure model, reverse idler
engages 8 of 10 mm, no differential/final drive (speed computed with final drive 4.1 and tyre radius 0.30 m), etc.
(source: comments tagged MODEL/EST in `src/spec.js`).

## 5. Diagrams
- Timing strip: horizontal axis 0–720° crank; for each cylinder a row with the four strokes (colour bands), intake
  and exhaust valve-open bars (from `D.valve.*.openDeg/closeDeg` shifted by `firingAngleDeg`), spark mark; vertical cursor
  at the current crank angle (mod 720).
- p–V: precompute the loop with `gasState` + `cylinderVolume` at the current throttle; moving dot for cylinder 1.
- Tachometer + speedometer: canvas arcs with tabular numerals; redline zone from SPEC.

## 6. Test hook and visual verification
`window.__app = { ready: Promise, sim, driver, assembly, camera, renderer, getPose(), setChapter(id), setPaused(b),
setTimeScale(x), setInputs({throttle, clutchPedal, brake, lever}), requestGear(g), fastForward(seconds, inputs),
setHousing(mode), renderOnce(), stats: { frameMs, triangles } }`.
`verify/visual.mjs` (Node, `playwright-core`, system Chrome via `chromium.launch({ channel: 'chrome', headless: true })`;
serve `dist/` with a tiny built-in `http` static server on a free port):
1. load the page at 1440×900, wait for `__app.ready` (timeout 120 s);
2. fail on any `pageerror` or console error;
3. for every chapter: `setChapter(id)`, let it run ≈ 1.5 s, `renderOnce()`, save `verify/out/<nn>-<id>.png`; check the
   WebGL canvas is not blank (read pixels inside the page right after `renderOnce()`: ≥ 3 % of pixels differ from the
   background colour);
4. interaction smoke test through `__app`: start in neutral, `requestGear('1')`, `fastForward(4, { throttle: 0.5 })` →
   `sim.state.gear === '1'` and speed > 5 km/h; `requestGear('2')`, fast-forward → gear '2'; pedal sweep changes
   `getPose().clutchPedal`; screenshots of the gearbox in 2nd and of the clutch at full pedal;
5. write `verify/out/report.json` (chapters, checks, frame time, triangle count, console messages) and exit non-zero on failure.
`npm run build` must succeed (`vite build`); add `vite.config.js` only if needed (e.g. `base: './'`).

## 7. Acceptance
- `npm run build` succeeds; `node verify/visual.mjs` passes and you have looked at the screenshots yourself (Read the
  PNGs) and fixed what looks wrong (framing, unreadable text, parts hidden, flicker, z-fighting of ghost housings).
- No console errors/warnings from the app itself during a 60 s run including every chapter.
- Frame time on the test machine reported; if > 25 ms, reduce cost (no shadows, cap pixel ratio, avoid per-frame allocations).
- Keyboard and pointer controls all work; text is Czech with correct diacritics and correct mechanics.

Final message (≤ 350 words): what exists, how to run it, verification results (paths of screenshots), known gaps,
and every assumption you made about the model/sim interfaces that should be double-checked.
