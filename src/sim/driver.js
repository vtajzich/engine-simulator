// Automatic "driver": declutch -> (wait for the input shaft to stop) -> move the lever -> release the clutch.
// Stages: idle, slip, declutch, wait-stop, shift, release, hold, start.
//  - Slip guard (see guard.js; evaluated by sim.step in every sub-step, enabled by inputs.clutchGuard which the driver
//    sets whenever a gear is engaged and the engine is running): pedal = max(stagePedal, guard(rpm)), a proportional
//    law on the pedal POSITION. The plant is an integrator in the bite zone, so rate control would oscillate;
//    a position law settles at a steady slip pedal instead (a gear too tall to creep slips smoothly, never stalls).
//  - release: stagePedal ramps linearly to 0 over releaseDur regardless of rpm; the guard alone prevents lugging.
//  - idle: stagePedal = user pedal. When the guard dominates the stage is reported as 'slip' (a label, not a state).
//  - hold (anti-stall): braking, gear engaged, engine running and the locked-clutch engine speed < HOLD_RPM -> pedal 1;
//    leaves when the brake is released or throttle > 0.05 -> release ramp.
//  - start: ignition on, engine not running, gear engaged -> pedal 1 until the engine runs, then hold or release.
const SHIFT_TIMEOUT_S = 6;
const HOLD_RPM = 700, RPM_PER_RADS = 30 / Math.PI;

export function createDriver(sim) {
  const st = sim.state;
  let target = null, stage = 'idle', stageT = 0, releaseDur = 0.6, launch = false;
  let leverCmd = st.lever.target, pedalCmd = 0, relFrom = 1, slipping = false;

  const enter = s => { stage = s; stageT = 0; };
  const shifting = () => stage === 'declutch' || stage === 'wait-stop' || stage === 'shift';
  const followUserLever = user => {
    if (user.lever !== undefined && user.lever !== leverCmd && user.lever !== null) leverCmd = user.lever;
  };

  const driver = {
    get busy() { return stage !== 'idle' && stage !== 'hold'; },
    get stage() { return stage === 'idle' && slipping ? 'slip' : stage; },
    request(gear) {
      target = String(gear);
      launch = (target === '1' || target === 'R') && Math.abs(st.omegaMain) < 0.5;
      releaseDur = launch ? 1.5 : 0.6;
      if (st.gear === target && (target !== 'N')) { stage = 'idle'; leverCmd = target; return; }
      enter('declutch');
    },
    update(dt, user = {}) {
      stageT += dt;
      const throttle = user.throttle ?? 0;
      const brake = user.brake ?? 0, ignition = user.ignition ?? true;
      const running = st.engine.running, geared = st.gear !== 'N';
      let stagePedal = 0;
      switch (stage) {
        case 'declutch':
          stagePedal = 1;
          if (st.clutch.capacityNm <= 1e-9) enter(launch ? 'wait-stop' : 'shift');
          break;
        case 'wait-stop':
          stagePedal = 1;
          if (Math.abs(st.omegaInput) < 1) enter('shift');
          break;
        case 'shift': {
          stagePedal = 1; leverCmd = target;
          const l = st.lever, r = st.rails;
          const done = target === 'N'
            ? r.s12 === 0 && r.s34 === 0 && r.s5 === 0 && l.col === 0
            : st.gear === target;
          if (done || stageT > SHIFT_TIMEOUT_S) { enter('release'); relFrom = 1; }
          break;
        }
        case 'release':
          if (geared && !running && ignition) { enter('start'); stagePedal = 1; break; }   // stalled while releasing
          stagePedal = relFrom * (1 - Math.min(1, stageT / releaseDur));
          if (stageT >= releaseDur) { enter('idle'); stagePedal = 0; }
          break;
        case 'start':
          stagePedal = 1;
          followUserLever(user);
          if (!ignition || !geared) enter('idle');
          else if (running) { if (brake > 0.05) enter('hold'); else { releaseDur = 0.6; relFrom = 1; enter('release'); } }
          break;
        case 'hold':
          stagePedal = 1;
          followUserLever(user);
          if (!geared || !running) enter('idle');
          else if (brake <= 0.05 || throttle > 0.05) { releaseDur = 0.6; relFrom = 1; enter('release'); }
          break;
        default:
          stagePedal = user.clutchPedal ?? 0;
          followUserLever(user);
          if (geared) {
            if (ignition && !running) { releaseDur = 0.6; enter('start'); stagePedal = 1; }
            else if (running && brake > 0.05 && Math.abs(st.omegaInput) * RPM_PER_RADS < HOLD_RPM) { enter('hold'); stagePedal = 1; }
          }
      }
      // the guard itself runs inside sim.step (every sub-step); the driver only switches it on
      pedalCmd = stagePedal;
      slipping = stage === 'idle' && st.clutch.guard > stagePedal + 0.02;
      // lift off the throttle while the clutch is open for a shift
      return {
        throttle: shifting() ? 0 : throttle, brake, ignition,
        clutchPedal: pedalCmd, lever: leverCmd, clutchGuard: geared && running,
      };
    },
  };
  return driver;
}

export default createDriver;
