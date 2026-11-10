# Engine and gearbox – interactive 3D model

An interactive 3D explanation of a four-stroke inline four-cylinder engine (DOHC 16V, 86 × 86 mm), a dry single-plate
clutch and a longitudinal three-shaft five-speed synchronized gearbox with reverse.
All geometry is procedural (Three.js) and derived from a single file of dimensions, `src/spec.js`.

**Live demo:** <https://vtajzich.github.io/engine-simulator/> (Czech by default; add `?lang=en` or use the CZ / EN switch)

## Running

```bash
npm install
npm run dev        # development server (Vite)
npm run build      # production build into dist/
```

Every push to `main` is tested, built and published to GitHub Pages by `.github/workflows/pages.yml`.

## Controls

| Action | Control |
|---|---|
| Throttle / brake / clutch | sliders, or hold `W`/`↑`, `S`/`↓`, `Space` |
| Shifting | the gate in the bottom bar, or keys `1`–`5`, `R`, `N` |
| Clutch assistant | on: an automatic driver operates the clutch (pulling away even without throttle, declutching when braking to a stop, starting with a gear selected); off: you shift yourself and the model shows what goes wrong |
| Slow motion | 1× to 1/500. **"rotation only"** (default): the mechanism turns slowly, but the pedals, starter and shifting respond in real time. **"full time"**: everything is really slowed down (chapters Synchronization and Reverse) |
| View | mouse (orbit, pan, zoom), housing modes: Transparent / Section / Solid / Hidden |
| Language | **CZ / EN** switch in the header of the right panel (or `?lang=en` in the address); the choice is remembered |

The chapter "The Four Strokes" shows, in a transverse section through the cylinder, the intake of the mixture, ignition
with a spreading flame front, and the exhaust of the burnt gases. The chapter "Flywheel and Clutch" colours the engine
side and the gearbox side differently, shows a detail of the friction faces and a yellow trace of the torque (where the
force goes from the crankshaft into the input shaft and where it is interrupted when the pedal is pressed; the front
pilot of the input shaft only spins freely in the pilot bearing).

Ignition (chapter "Firing Order 1–3–4–2", view "Distributor and spark plugs"): the distributor rotor on the intake
camshaft delivers the spark to the four cap terminals in the order 1-3-4-2. The spark is always visible – at the plug,
on the lead and between the rotor and the terminal – even with the housings hidden and without the "Gas" layer; at real
speed the flash at the plug and on the lead is held for 70 ms so that it does not fall between frames. The distributor
cap is transparent in every housing mode except "Solid", so the rotor can be seen.

Eleven chapters in the right panel walk through the crank mechanism, the four strokes, the valve train, the firing
order, the clutch, the gearbox layout, the power flow, synchronization, reverse and free driving.

## Verification pipeline

```bash
npm run verify           # everything: tests + build + visual check (several minutes)
npm test                 # vitest only (kinematics, simulation, collisions)
npm run verify:visual    # headless Chrome over dist/ only (requires npm run build)
```

1. **Kinematics** (`test/kin`) – crank mechanism, stroke table for the 1-3-4-2 order, valve timing, convexity and
   envelope consistency of the cams, gear ratios, gear-mesh phasing, clutch and synchronizer geometry.
2. **Simulation** (`test/sim`) – idle, pulling away, shifting, shifting without the clutch, stalling, reverse; after
   every step the invariants are checked (rail interlock, tooth alignment, the sleeve-tooth chamfer rule).
3. **3D collisions** (`test/collision`, `verify/collide.js`) – every rigid body is merged into one mesh with a BVH
   (`three-mesh-bvh`) and triangle intersection is tested for all pairs of bodies:
   - modules separately (block and crank, head and valve train, clutch, gear train and synchronizers, shift mechanism
     and case),
   - the whole assembly: working cycle 0–720°, clutch pedal travel, every gear, and **a whole drive replayed from the
     simulator** (pulling away, 1→2→3→4→5, stopping, reverse),
   - two-sided contact tests (cam–tappet, valve–seat, disc–flywheel, tooth flanks): no intersection in the nominal
     position, intersection after moving closer by ≈ 0.3 mm,
   - negative checks proving that the detector works (e.g. valve timing shifted by 114° → a valve hits the piston).
   Results and measured clearances: `verify/out/collision-*.json`.
4. **Build** of the app and **visual check** (`verify/visual.mjs`) – headless Chrome goes through all chapters, watches
   for console errors and an empty canvas, tries shifting, stalling the engine and selecting a part. The controls are
   verified with **real clicks and key presses in real time** (the engine stops and starts within 2.5 s, first gear
   without throttle pulls away without stalling, braking to a stop does not stall the engine). Ignition: the plug-lead
   boots are visible from above with hidden and sectioned housings; the distributor cap is transparent (also in a
   chapter with a part focus) and opaque in "Solid" mode; the flash matches the crank angle (paused), arrives in the
   order 1-3-4-2 while running, is seen on all cylinders at real speed and goes out after the engine is switched off.
   Screenshots in `verify/out/`.

## Structure

```
src/spec.js      all dimensions (single source of truth; tags SRC / EST / MODEL)
src/kin/         kinematics (pure maths, no Three.js)
src/sim/         drivetrain simulation + automatic "driver"
src/geo/         geometry generators (involute gears, synchronizer teeth, …)
src/model/       3D modules: bottomEnd, topEnd, clutch, gearbox, shift, assembly
src/app/         browser app and the explanatory text (content/cs.js, content/en.js)
verify/          collision framework, visual check, outputs
docs/            research.md (research with sources), design.md (contract), plan/ (module briefs)
```

## Model simplifications

The model is mechanically consistent, but it is not a drawing of a particular engine. The main deliberate
simplifications (tagged `MODEL` in `src/spec.js`): enlarged running clearances (≥ 0.2 mm, so that they can be verified
on meshes), the diaphragm spring drawn as 18 rigid levers, reduced valve heads, an idealized cylinder pressure curve,
the reverse idler meshes over 8 of 10 mm of width, no final drive or differential (road speed is computed from a final
ratio of 4.1 and a wheel radius of 0.30 m). Reference values: Toyota 3S-GE engine, gear ratios after the Toyota W58 –
see `docs/research.md`, where every number is marked as sourced or estimated.

## License

[MIT](LICENSE)
