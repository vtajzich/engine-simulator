# Task A2 — driveline simulation (`src/sim/sim.js`, `src/sim/driver.js`, `poseFromState` in `src/kin/pose.js`, tests `test/sim/*`)

Read first: `docs/design.md` (§5 pose), `src/spec.js`, `docs/plan/A1-kinematics.md` (implemented in `src/kin/*` — read the
source for exact exports: `gearLinear`, `shaftAngles`, `gearForSleeve`, `ringForGear`, `misalign`, `maxAdvance`,
`maxMisalign`, `xRingTip`, `xBlock`, `xDogTip`, `xEngaged`, `releaseKin`, `gasState`, `cycleAngleDeg`, `derive().gearbox.ratios`),
`docs/research.md` §4.3 (power flow), §5.2 (synchronizer phases), §8 (misconceptions the sim must not commit).
Pure JS, no Three.js/DOM, deterministic (no Math.random, no Date). Only touch `src/sim/*`, `test/sim/*` and the
`poseFromState` function (plus needed imports) in `src/kin/pose.js`.

The simulation is a lumped rigid-body model: engine (crank + flywheel + clutch cover/pressure plate), input side
(clutch disc + input shaft + countershaft + free gears, one degree of freedom because they are permanently meshed),
mainshaft + vehicle. It must produce shaft ANGLES that are exactly consistent with the tooth geometry, because the
3D collision tests replay simulator output.

## API

```js
import { createSim } from './sim.js';
const sim = createSim(spec = SPEC);
sim.step(dt, inputs);        // dt in seconds (any size; sub-step internally with h ≤ 0.5 ms)
sim.rotateCrank(dTheta);     // manual scrubbing while paused: kinematic, see below
sim.state;                   // plain object, mutated in place
sim.drainEvents();           // → array of { t, type, detail } since last call
```
`inputs = { throttle: 0..1, clutchPedal: 0..1, brake: 0..1, lever: 'N'|'1'|'2'|'3'|'4'|'5'|'R', ignition: boolean }`
(`ignition` true keeps the engine running/restarts it after a stall; false = engine off, crank coasts down).

```js
state = {
  t,
  thetaCrank, omegaCrank,           // rad, rad/s
  thetaInput, omegaInput,
  thetaMain, omegaMain,
  clutchPedal,                      // as applied (inputs.clutchPedal, rate-limited to full travel in 0.12 s)
  clutch: { capacityNm, locked, torqueNm },
  rails: { s12, s34, s5 },          // mm, + = rear; sleeves follow rails; reverse idler follows s5
  lever: { col, row, target },      // col,row continuous −1…1
  synchro: { active: null | { sleeve, sign, gear, phase }, ringIndex: { ring1..ring5: mm (signed tangential index, 0 = aligned) }, ringPush: { ring1..: 0…1 } },
  gear,                             // 'N' or the gear whose sleeve (or idler) is FULLY engaged
  lock: null | { gear, K },         // angle lock constant while a gear is engaged (see below)
  engine: { running, stalled, torqueNm, throttleEff },
  rpm: { engine, input, counter, main }, speedKmh,
  flow: string[]                    // body names carrying drive torque now (see "Power flow")
}
```

## Dynamics (SI units; ω in rad/s)

Constants: `Je = vehicle.engineInertia`, `Jin = gearbox.inputSideInertia`, `Jv = massKg * tyreRadiusM² / finalDrive²`
(vehicle inertia referred to the mainshaft), ratios `i_g = derive().gearbox.ratios[g]` (input speed / main speed; R negative).

Engine torque: `Tind = throttleEff * maxTorqueNm * shape(ω)`, `shape = 1 − 0.35 * ((rpm − 4800) / 4800)²` (clamped ≥ 0.3);
friction `Tf = 14 + 0.011 * ω` (N·m, opposing rotation, zero at ω = 0). `throttleEff = max(inputs.throttle, idle)` where
`idle` is a PI controller holding `idleRpm` (anti-windup, output 0…0.25). Fuel cut (`Tind = 0`) above `redlineRpm`.
Stall: if `running` and rpm < 300 → `running = false`, `stalled = true`, event `stall`. Not running → `Tind = 0`.
If `inputs.ignition` and not running and rpm < 300: starter torque 60 N·m until rpm > 400, then `running = true`,
`stalled = false`, event `start`. At t = 0 the engine is running at idle speed.

Clutch: `capacity = releaseKin(state.clutchPedal).capacity * clutch.maxTorqueNm`. Karnopp stick–slip between engine
and input side: when slipping, `Tc = capacity * sign(ωe − ωin)`; lock when the sign of the slip would reverse within the
sub-step (or |slip| < 0.05 rad/s) AND the torque needed to keep them together is ≤ capacity; when locked integrate them
as one inertia and unlock when the required torque exceeds capacity. `state.clutch.locked` reflects this.

Input side (not in gear): `Jin * dωin/dt = Tc − Tdrag + Tsync`, `Tdrag = inputDragNm * sign(ωin)` (stop exactly at 0, no
sign chatter), `Tsync` see synchronizer.
In gear g (sleeve fully engaged): `ωin = i_g * ωm` exactly; one equation at the mainshaft:
`(Jv + Jin * i_g²) * dωm/dt = (Tc − Tdrag) * i_g − Troad − Tbrake`.
Not in gear: `Jv * dωm/dt = −Troad − Tbrake − Tsync * i_g` (reaction of the synchro, tiny).
Road load at the mainshaft: `F = massKg * 9.81 * rollingResistance * sign(v) + 0.5 * 1.2 * cdA * v * |v|`,
`Troad = F * tyreRadiusM / finalDrive`, `v = ωm * tyreRadiusM / finalDrive`. Brake: `Tbrake = inputs.brake * 2600 N·m / finalDrive`
opposing motion. Rolling resistance and brake must hold the car at exactly ω = 0 when the driving torque is smaller than
they can resist (static friction logic; no creeping, no sign chatter).

Integrate angles: `theta += omega * h` for crank, input, main; in gear recompute `thetaInput` exactly from the lock (below).

## Lever, rails, interlock
Gate positions `SPEC.gearbox.shift.gate[target] = [col*, row*]`; rail for col −1 → `s12`, 0 → `s34`, +1 → `s5`;
rail displacement for row: `x = row * railTravel` (row +1 = rail toward +X = gears 1, 3, 5; row −1 = 2, 4, R).
The driver moves the lever toward the target: (1) if the current rail is off neutral and the target is elsewhere, pull it
to neutral at `shiftSpeed` mm/s; (2) with all rails at 0, move `col` toward col* (`selectTime` s per column); (3) push the
selected rail toward row* at `shiftSpeed`, **limited by the synchronizer/idler constraint below**. `lever.row = x_rail /
railTravel` of the selected rail. Interlock invariant: at most one rail has |x| > 1e-9 at any time.
Disengaging is always possible (no constraint when moving a rail toward neutral).

## Synchronizer (rail moving toward a gear with a dog ring: s12 ±, s34 ±, s5 +)
Let x = travel toward the gear (≥ 0), `gear` = gearForSleeve[sleeve][sign], `{A, B} = gearLinear(gear)`,
gear angle `θg = A * thetaInput + B`, gear speed `ωg = A * ωin`, ring = ringForGear[gear]. Phases (`synchro.active.phase`):
- `'free'` x < 0.3: ring is pushed onto the cone: `ringPush = clamp(x / 0.3, 0, 1)`.
- `'blocking'`: while `|ωg − ωm| > 0.3 rad/s` the ring is indexed: `ringIndex = sign(ωg − ωm) * ringIndexFraction * P`
  (reached smoothly from 0 over x ∈ [0.3, xRingTip]) and the rail cannot pass `xBlock`. While x is at xBlock (within
  0.05) the cone applies `Tsync = synchroTorqueNm * sign(ωm − ωg)` on the input side, expressed at the input shaft
  (`Tsync_input = synchroTorqueNm * sign(i_g * ωm − ωin)`); event `syncStart` once. If the clutch is locked or its capacity
  exceeds 20 N·m while blocking, emit event `grind` (detail: 'clutch') at most once per attempt — the engine fights the synchro
  (the equations already produce that; do not special-case the result).
- when `|ωg − ωm| ≤ 0.3`: set `ωin` so `ωg = ωm` exactly, event `syncDone`; phase `'indexing'`: Tsync holds the speeds
  equal (treat input side as kinematically tied to the mainshaft from here on: `ωin = i_g * ωm`); the rail may advance;
  the ring index is reduced as the sleeve passes: `|ringIndex| ≤ maxMisalign(advanceRing(x))` (rotate the ring back),
  and for x ≥ xDogTip the gear itself is turned (by adjusting `thetaInput`) so that
  `misalign(θg, thetaMain) ≤ maxMisalign(advanceDog(x))` — move toward the nearest aligned position; this is the sleeve
  chamfer indexing the gear.
- `x = xEngaged`: phase `'engaged'`, `state.gear = number`, event `gearEngaged`. Store the angle lock
  `K = θg − thetaMain` (after indexing, so |misalign| ≤ c/2); afterwards every sub-step, after integrating `thetaMain`:
  `thetaInput = (thetaMain + K − B) / A` and `ωin = i_g * ωm`. Ring index 0, `ringPush` relaxes to 0.
Leaving a gear: `state.gear = 'N'` as soon as x < xDogTip; lock released.
If speeds diverge again before the dogs are entered (x < xDogTip), fall back to `'blocking'` at xBlock.

## Reverse (rail s5 toward −X) — unsynchronised sliding idler
Idler position = rail position. The idler teeth enter the 50 T gear when travel `x > reverse.entryGap` (1.5).
Mesh residual: `e = wrapTo(thetaMain − (A_r * thetaInput + B_r), 2π / z_revMain)` with `{A_r, B_r} = gearLinear('revMain')`.
- Entry allowed only if `|ωin| < 3 rad/s` and `|ωm| < 0.5 rad/s`. Then, during x ∈ [0.5, entryGap), rotate the input
  side (adjust `thetaInput`) so e → 0, set ωin = 0; continue to full travel; at x = travel: `state.gear = 'R'`, lock as
  above with the linear law of 'revMain' (`thetaInput = (thetaMain + K − B_r) / A_r`, K ≈ 0), `ωin = i_R * ωm`.
- Otherwise the rail stops at `entryGap − 0.1` and event `grind` (detail: 'reverse') is emitted once per attempt; it
  proceeds automatically once the condition is met while the driver keeps pushing.
When the s5 rail moves +X (5th) the idler simply moves with it (no constraint).

## Power flow (`state.flow`)
Bodies transmitting drive torque, for UI highlighting, when |clutch torque| > 1 N·m or a gear is engaged and moving:
always `crank` if the engine runs; if the clutch transmits: `clutchDisc`, `inputShaft`; in gear 1/2/3/5:
`counterShaft`, `gearN`, `sleeveXX`, `mainShaft`; in 4: `sleeve34`, `mainShaft` (NOT the countershaft); in R:
`counterShaft`, `idlerR`, `mainShaft`.

## rotateCrank(dTheta)
For paused scrubbing: `thetaCrank += dTheta`; if the clutch is locked (or capacity > 0 and both sides at rest)
`thetaInput += dTheta`; if a gear is engaged `thetaMain += dTheta / i_g` and re-apply the lock. No velocities change.

## `src/sim/driver.js` — `createDriver(sim)`
An automatic "driver" used by the UI's assisted mode and by tests:
`driver.request(gear)`; `driver.update(dt, userInputs)` → returns the inputs object to pass to `sim.step`
(throttle/brake from `userInputs`, clutch pedal and lever managed by the driver while a shift is in progress):
press clutch fully (wait until capacity = 0) → move lever to target (wait for `state.gear === target`, or for 'N'
until all rails are at 0) → release the clutch progressively over ≈ 0.6 s (≈ 1.5 s and throttle ≥ 0.15 when starting from
standstill in 1 or R) → done. For 'R' and for 1st at standstill wait with the clutch pressed until the input shaft has
stopped. `driver.busy` boolean, `driver.stage` string for the UI.

## `poseFromState(state)` (in `src/kin/pose.js`)
Builds the pose of design.md §5: `crank/input/main` from the thetas, `counter` and `gears.*` from `shaftAngles({ input })`,
`sleeves = rails`, `idlerX = rails.s5`, rings: `angle = thetaMain + pitchAngle/2 + ringIndex/pitchRadius`, `push`,
`lever`, `clutchPedal`, `cylinders[i]` from `gasState(cycleAngleDeg(deg(thetaCrank), i), state.engine.throttleEff)`
(when the engine is not running use throttle 0 and force `burn = 0`, `spark = false`, phase by stroke only),
`flow = new Set(state.flow)`.

## Tests (`test/sim/*.test.js`) — all must pass. Use a helper that runs the sim with a script of inputs at dt = 1/240 s and
asserts the INVARIANTS after every step:
- I1 interlock: at most one rail off neutral.
- I2 engaged-gear alignment: if `state.gear` is a forward gear, `misalign(θg, thetaMain) ≤ c` (c = derive().synchro.c)
  and `|ωin − i_g ωm| < 1e-6`; if 'R', `|e| * r_revMain < 0.05 mm`.
- I3 chamfer rule for the active sleeve: `misalign(θg, thetaMain) ≤ maxMisalign(advanceDog(x)) + 1e-6` and
  `|ringIndex| ≤ maxMisalign(advanceRing(x)) + 1e-6`; x ≤ xBlock + 1e-6 while phase is 'blocking'.
- I4 no NaN/Infinity anywhere in state; angles continuous (|Δθ| per step ≤ |ω| dt + 0.2 rad).
- I5 reverse: idler teeth entered (x > entryGap) only with `|e| * r_revMain < 0.05 mm`.
Scenarios:
1. Idle: 3 s in neutral, clutch engaged → engine 700–900 rpm; input rpm = engine rpm; counter rpm = −34/46 × input;
   main = 0; clutch locked.
2. Clutch pressed in neutral at idle → input shaft below 30 rpm within 4 s (drag), engine keeps idling.
3. Launch with the driver in 1st, throttle 0.4 → no stall, > 20 km/h within 6 s; once locked `ωe / ωm = ratios[1]` (1e-6).
4. Upshifts 1→2→3→4→5 with the driver (throttle 0.7, shift when engine > 5500 rpm): every shift completes; each
   synchronisation (syncStart→syncDone) lasts 0.03–0.8 s; ratios after each shift match; in 4th the input shaft turns
   exactly with the mainshaft while the countershaft still turns at −34/46 of it; speed in 5th keeps rising.
5. Shift without clutch: in 2nd at ~3000 rpm, set lever '3' with clutchPedal 0 for 1.5 s → `state.gear` ≠ '3' during that
   time and a `grind` event was emitted; then pressing the clutch lets it engage.
6. Braking to a stop in gear with the clutch engaged → `stall` event; ignition restarts after selecting neutral.
7. Reverse from standstill with the driver → `state.gear === 'R'`, then throttle 0.3: mainshaft turns negative,
   `ωin / ωm = ratios.R` (negative).
8. Reverse while rolling forward at > 8 km/h (clutch pressed, lever 'R') → not engaged, `grind` event (detail 'reverse').
9. Neutral coasting: from 60 km/h in neutral the car slows smoothly to exactly 0 and stays 0 (no creep, no sign flip).
10. rotateCrank: paused in 3rd with clutch engaged: rotating the crank by 1 rad advances input by 1 and main by 1/ratios[3];
    invariants hold.
11. Top speed sanity: full throttle in 5th from 4000 rpm for 60 s → 170–260 km/h, never above redline + 300 rpm.
12. poseFromState produces finite numbers for every field in all scenarios, and `poseFromState` after scenario 3 has
    `flow` containing 'gear1' and 'counterShaft'; in 4th contains 'sleeve34' but not 'counterShaft'.

Final message (≤ 300 words): files, test result, measured numbers (idle rpm, 0–100 km/h time, sync durations per
shift, top speed), and any place where you had to deviate from this document (exactly what and why).
