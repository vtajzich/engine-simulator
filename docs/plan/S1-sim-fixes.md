# Task S1 — simulator fixes: rotation-only slow motion, launch without stalling, start in gear

Context: `docs/plan/A2-simulation.md` (original spec), `src/sim/sim.js`, `src/sim/driver.js`, `test/sim/sim.test.js`,
`test/sim/rig.js` (invariant harness I1–I5), `test/collision/assembly-drive.test.js` (replays the sim on the 3D model).
Only touch `src/sim/*`, `test/sim/*`, and `test/collision/assembly-drive.test.js` as described in §4. Pure JS, deterministic.

## Why
The app's slow motion multiplied the simulation time step, so pedals, starter and the shift lever also became 20–500×
slower: the engine "would not stop", "would not start" and "would not shift". Reproduced in the browser at 1/20:
engine stop 20 s, restart 10 s, selecting 1st > 60 s. Second bug, reproduced at 1×: with the assistant (driver) on,
pressing `1` at standstill with zero throttle ends in a stall.

## 1. `sim.angleScale` — slow down the displayed ROTATION only
Add a writable property `sim.angleScale` (default 1; valid range 0.0005 … 1). It affects **only the integration of the three
shaft angles**: wherever `thetaCrank`, `thetaInput`, `thetaMain` are advanced from their angular velocities, use
`theta += omega * h * angleScale`. Everything else stays in real time: all angular velocities and torques, rpm, clutch
pedal rate, rails/lever speed, synchro phases, engine start/stall, vehicle speed, `state.t`.
Audit every use of a `theta*` in `sim.js` and make sure each is either (a) that integration, or (b) a constraint
solve on the angles themselves (gear lock `thetaInput = (thetaMain + K − B)/A`, dog indexing, ring index, reverse
alignment), which must keep working unchanged and exactly — the posed 3D model is collision-tested from these angles.
Nothing may infer a velocity from an angle difference. `rotateCrank` is unaffected by the scale.
Also expose `state.angleScale` (copy of the property) so `poseFromState`/the UI can read it.

## 2. Driver: launching never stalls (slip control)
In `src/sim/driver.js`, replace the timed launch release by closed-loop slip control whenever the driver releases the
clutch with a gear engaged and the engine running:
- release the pedal at the nominal rate (full travel in `releaseDur`) while engine rpm ≥ 780;
- hold the pedal while 700 ≤ rpm < 780;
- press it back in (rate: full travel in 0.25 s) while rpm < 700;
- finish (pedal 0, stage 'idle') only when the clutch is locked or the pedal has reached 0 with rpm ≥ 700.
Keep the existing 0.15 throttle floor for launches when the user gives none? No — remove the hidden throttle floor: with
zero user throttle the idle governor alone must pull the car away into idle creep. With user throttle the launch must be
at least as quick as before.
Required behaviour (tests): from standstill, engine idling, zero throttle, `driver.request('1')` → no stall event, gear '1',
clutch locked within 8 s, speed settles at 6.6 ± 0.5 km/h (800 rpm / (3.353 × 4.1) on a 0.30 m tyre) and stays there for
5 s; same for 'R' (≈ −5.9 km/h); with throttle 0.4 the existing launch scenario still reaches > 20 km/h within 6 s.

## 3. Driver: anti-stall and starting in gear
- Anti-stall hold: when the driver is idle, a gear is engaged, the clutch is engaged and engine rpm falls below 650
  (e.g. the user brakes to a stop in gear), the driver presses the clutch (new stage `'hold'`, `driver.busy` stays false
  in this stage so new gear requests are accepted) and keeps it pressed while `user.brake > 0.05` or speed would not
  sustain idle; when the brake is released (or throttle > 0.05) it performs the slip-controlled release of §2.
  Test: accelerate in 2nd to 30 km/h, then full brake to standstill with the assistant → no stall event, engine still
  idling, car stopped; releasing the brake → car creeps in 2nd or the driver holds the clutch… define and document:
  it re-engages with slip control; in a gear too tall to creep (rpm cannot be kept ≥ 700 once locked) it must keep
  slipping/holding rather than stall. Assert: no stall for 10 s after brake release in 2nd and in 5th.
- Start in gear: if `user.ignition` is true, the engine is not running, and a gear is engaged, the driver presses the
  clutch fully (stage `'start'`) so the starter does not drag the car, waits until `state.engine.running`, then releases
  with slip control (subject to the brake rule above). Test: stall the car in 1st deliberately with the raw sim (no
  driver), then hand control to the driver with ignition true → engine starts, speed stays < 0.5 km/h until the engine
  runs, no second stall.
- `driver.stage` values are now: `idle`, `declutch`, `wait-stop`, `shift`, `release`, `hold`, `start`.

## 4. Tests
- Extend `test/sim/sim.test.js` (keep all existing tests green; adjust a test only if this document changes the
  specified behaviour, and say so): new tests for §2 and §3, and re-run the scenario set "launch", "upshifts 1→5",
  "reverse", "random abuse" with `sim.angleScale = 0.05` and `= 0.002` under the full invariant rig I1–I5.
  With angleScale the rig's continuity bound (I4) must use `|ω| dt * angleScale + 0.2`.
- Property test: for the same input script, every non-angle state field (omegas, rails, gear, events sequence and
  times, speed) is identical between angleScale 1 and 0.05 (exact or 1e-9), because angles must not feed back into the
  dynamics — except through tooth-indexing discretisation; if indexing makes them differ slightly, report by how much
  and why, and assert a tight bound instead.
- In `test/collision/assembly-drive.test.js` add a second `it` that runs the same drive script with
  `sim.angleScale = 0.05` and checks the shifting frames for collisions exactly like the first (reuse the code via a
  small local function; the launch in that script uses throttle 0.45 and must keep working with the new driver).
  Run it with `npx vitest run test/collision/assembly-drive.test.js` (takes ~2–3 min).
- Run `npx vitest run test/sim test/kin` and the drive test before finishing.

Final message (≤ 300 words): what changed, test results, measured numbers (time to lock and creep speed in 1st and R at
zero throttle, 0–100 km/h time at full throttle through the driver, sync durations), the answer to the property test,
and any behaviour you had to define that this document left open.
