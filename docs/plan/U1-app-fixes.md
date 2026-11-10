# Task U1 — app fixes after first user test (`src/app/**`, `verify/visual.mjs`)

The user tried the app and reported (Czech): the engine keeps turning after "Vypnout motor"; "Nastartovat" does not
work; shifting does not work; the inside of the clutch and its disengagement cannot be seen; and they want animations
of mixture intake, ignition and exhaust.

Root causes found by reproduction in headless Chrome:
1. The playback-speed control multiplied the simulation time step. Most chapters default to 1/20, so pedals, starter
   and shift lever were 20× slower too: engine stop took 20 s, restart 10 s, selecting 1st gear > 60 s.
2. With the assistant on, pressing `1` at standstill with zero throttle stalled the engine (driver bug).
3. The clutch cover hides the clutch except in "Řez" mode, and even in section the 0.9 mm release gap is ≈ 2 px.
4. Gas exchange was only a tinted volume.
5. The visual pipeline passed anyway because it drove the app in simulation time (`fastForward`), never in wall-clock
   time with real clicks.

Two other agents are fixing, in parallel with you (their work lands during yours; code against these contracts and
verify against the real code before you finish):
- `docs/plan/S1-sim-fixes.md` — `sim.angleScale` (rotation-only slow motion: shaft ANGLES advance `angleScale` times
  slower, everything else — rpm values, pedals, starter, lever, vehicle — in real time), `state.angleScale`; the driver
  never stalls on launch, holds the clutch when braking to a stop (`stage: 'hold'`), starts in gear (`stage: 'start'`).
- `docs/plan/G1-gas-flow.md` — charge particles, port streams, spark and flame glow inside the existing `gas{n}` /
  `spark{n}` parts; new static parts `intakeManifold`, `exhaustManifold` (housing).
Read both documents, `docs/plan/E-app.md` (the original app spec) and the current `src/app/**`.
You own only `index.html`, `src/app/**`, `verify/visual.mjs`, `vite.config.js`. The repo is under git: do NOT commit,
stage, stash or reset. Do not edit sim/model/kin/spec/test files; if you find a bug there, report it precisely.

## A. Time model (fixes "nothing works")
- Two independent factors: `app.rotScale` → `sim.angleScale` (how much slower rotation is DISPLAYED) and
  `app.timeScale` (true slow motion: `sim.step(dt * timeScale)`), with `sim.angleScale = rotScale` only when
  timeScale = 1, and = 1 when true slow motion is on (never both slowed).
- UI in the transport bar: one segmented control "Zpomalení" with 1×, ¼, 1/20, 1/100, 1/500, and next to it a
  two-state switch: **"jen otáčení"** (default: controls respond in real time) / **"celý čas"** (true slow motion).
  When "celý čas" is active with a factor < 1 show a persistent, clearly visible badge over the 3D view:
  "Čas zpomalen 20× – pedály, startér a řazení reagují stejně pomalu". The readout keeps showing the REAL rpm and the
  displayed rpm.
- Chapter defaults: every chapter uses "jen otáčení" (suggest 1/20; chapters 3–5 may use a slower factor so that one
  720° cycle takes ≈ 8–12 s at idle) EXCEPT `synchron` and `zpatecka`, which use "celý čas" (their scripted slow-motion
  shifts are the point) — and say so in the chapter text. `jizda` uses "jen otáčení" 1/20.
- Remove/replace every text that describes the old behaviour (e.g. in `jizda` "Rychlost přehrávání je 1×…").
- Engine button and status: show three states — "Motor běží", "Motor dobíhá" (ignition off, rpm > 0), "Motor stojí";
  button label "Vypnout motor" / "Nastartovat". Stall banner as before. With the assistant on, starting in gear is
  handled by the driver; with it off, show a hint toast when the user starts in gear with the clutch engaged
  ("Startér táhne celé auto – sešlápněte spojku nebo vyřaďte").
- Show the driver's new stages in the assistant badge: hold → "Asistent: drží spojku", start → "Asistent: startuje".

## B. Clutch must be visible and its release legible
- The clutch cover (`clutchCover`) and `bellhousing` behave like shells in every housing mode: ghost → translucent,
  cut → sectioned (as now), hidden → hidden, solid → opaque. (The cover shares a material with other steel parts: give
  its meshes their own material instance at app start.) In ghost mode the pressure plate, fingers, disc and release
  bearing must be clearly visible through it.
- Chapter `spojka`: add camera buttons "Celek" and "Detail třecích ploch". The detail view is a close, nearly side-on
  look at the section (cut plane z = 0) at the top of the friction ring, framing roughly x 365…455, y 60…140, so that
  1 mm ≥ 8 px at 1440×900: the 0.05 mm clamped faces look closed, and at full pedal the two 0.9 mm gaps
  (flywheel–disc, disc–pressure plate) and the 1.8 mm plate lift are plainly visible, as are the finger pivoting on
  the fulcrum ring and the bearing travel. Verify with screenshots at pedal 0 and pedal 1 and iterate on framing.
- Side colouring in this chapter (per-chapter tint map body-prefix → colour, implemented in `highlight.js`):
  engine side (`crank` parts flywheel + cover, `pressurePlate`, `finger*`) warm amber; gearbox side (`clutchDisc`,
  `inputShaft`) cool blue; release mechanism (`releaseBearing`, `releaseFork`) neutral light. Legend in the panel.
  This replaces the power-flow glow in this chapter.
- Live values in the chapter diagram area: pedal %, bearing travel mm, plate lift mm, gap per side mm, torque
  capacity %, slip = engine rpm − input-shaft rpm, state (sepnutá / prokluzuje / rozepnutá).
- The decisive visual: with the pedal down in neutral the disc and input shaft slow down and stop while the flywheel
  and cover keep turning. Make sure this reads (the disc's damper springs and hub are the non-axisymmetric features;
  add nothing to the model) — and say it in the "Všimněte si" list. Add an action "Sešlápnout a sledovat lamelu".

## C. Gas-exchange chapter views
- Add a generic per-chapter "section" facility: a global clipping plane applied to ALL materials (set
  `renderer.clippingPlanes`), with every material rendered `DoubleSide` while it is active, restored afterwards.
- Chapter `ctyri-doby`: default view = transverse section through cylinder 1 ("Příčný řez válcem 1"): clip away
  everything in front of the cylinder-1 centre plane (x < cylX[0], i.e. keep x ≥ 0 … choose the offset so the spark
  plug, one intake and one exhaust valve with their ports, the piston, rod and crank throw are all visible), camera
  in front of the engine looking rearward (+X) so the intake side (+Z) is on the right. Second button "Podélný
  pohled" = the previous view. The gas particles, port streams, spark and flame must be clearly visible in the
  section; check screenshots at cycle angle ψ ≈ 450° (intake), 630° (compression), 715° (spark), 15° (flame),
  100° (expansion), 150° (blow-down), 270° (exhaust), 365° (overlap) — pause and use `sim.rotateCrank` to reach them
  (cylinder 1: crank angle = ψ).
- Rewrite the chapter text for what is now shown: blue particles = fresh mixture drawn in through the intake port past
  the open valve; cloud compresses; spark before TDC (advance), flame front spreads from the plug (yellow → orange);
  grey particles leave through the exhaust port; blow-down at EVO; valve overlap. Legend of colours.
- Apply the same section option to `rozvod` (valve timing) as an alternative view, and add `intakeManifold` /
  `exhaustManifold` to labels and glossary ("Sací potrubí", "Výfukové potrubí").
- "Plyn" toggle keeps working (it hides `gas*`/`spark*` parts).

## D. Verification (`verify/visual.mjs`) — close the blind spot
Add wall-clock interaction checks that use REAL input (Playwright clicks on the actual buttons and `keyboard.press`
/ `down`/`up`), with `page.waitForTimeout`, never `fastForward`, starting from the DEFAULT state of chapter `prehled`
and again from `jizda`:
1. click "Vypnout motor" → engine rpm = 0 within 2.5 s;
2. click "Nastartovat" → `engine.running` within 2.5 s;
3. press `1` with zero throttle → `sim.state.gear === '1'`, no `stall`, speed > 3 km/h within 7 s;
4. hold `W` 3 s → speed rises; press `2` → gear '2' within 3 s;
5. hold `S` until standstill (≤ 10 s) → no stall, engine still running;
6. press `R` → gear 'R' within 6 s and speed becomes negative within 5 s more;
7. in chapter `synchron` (true slow motion) the "celý čas" badge is visible.
Also add screenshots: clutch detail at pedal 0 and pedal 1 (`30-clutch-detail-0.png`, `31-clutch-detail-1.png`), clutch
in ghost mode, and the eight cycle angles of §C (`40-cycle-450.png` …). Fail on console errors as before.
Run `npx vite build && node verify/visual.mjs` at 1440×900 and with `VIEWPORT=1280x720`; look at the screenshots
yourself (Read the PNGs) and iterate.

## E. Acceptance
All of §D passes; no regression in the existing 31 checks; no console errors; Czech text correct (diacritics,
mechanics). Final message (≤ 350 words): what changed, verification results with screenshot paths, anything in the
sim/model contracts that did not behave as documented (exact reproduction), and remaining gaps.
