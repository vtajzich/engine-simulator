// Automatic "driver": declutch -> (wait for the input shaft to stop) -> move the lever -> release the clutch.
const SHIFT_TIMEOUT_S = 6;

export function createDriver(sim) {
  const st = sim.state;
  let target = null, stage = 'idle', stageT = 0, releaseDur = 0.6, launch = false;
  let leverCmd = st.lever.target, pedalCmd = 0;

  const enter = s => { stage = s; stageT = 0; };
  const shifting = () => stage === 'declutch' || stage === 'wait-stop' || stage === 'shift';

  const driver = {
    get busy() { return stage !== 'idle'; },
    get stage() { return stage; },
    request(gear) {
      target = String(gear);
      launch = (target === '1' || target === 'R') && Math.abs(st.omegaMain) < 0.5;
      releaseDur = launch ? 1.5 : 0.6;
      if (st.gear === target && (target !== 'N')) { stage = 'idle'; leverCmd = target; return; }
      enter('declutch');
    },
    update(dt, user = {}) {
      stageT += dt;
      let throttle = user.throttle ?? 0;
      const needsStop = launch;
      switch (stage) {
        case 'declutch':
          pedalCmd = 1;
          if (st.clutch.capacityNm <= 1e-9) enter(needsStop ? 'wait-stop' : 'shift');
          break;
        case 'wait-stop':
          pedalCmd = 1;
          if (Math.abs(st.omegaInput) < 1) enter('shift');
          break;
        case 'shift': {
          pedalCmd = 1; leverCmd = target;
          const l = st.lever, r = st.rails;
          const done = target === 'N'
            ? r.s12 === 0 && r.s34 === 0 && r.s5 === 0 && l.col === 0
            : st.gear === target;
          if (done || stageT > SHIFT_TIMEOUT_S) enter('release');
          break;
        }
        case 'release': {
          pedalCmd = 1 - Math.min(1, stageT / releaseDur);
          if (launch) throttle = Math.max(throttle, 0.15);
          if (stageT >= releaseDur) { enter('idle'); pedalCmd = 0; }
          break;
        }
        default:
          pedalCmd = user.clutchPedal ?? 0;
          if (user.lever !== undefined && user.lever !== leverCmd && user.lever !== null) leverCmd = user.lever;
      }
      // lift off the throttle while the clutch is open for a shift
      if (shifting()) throttle = 0;
      return {
        throttle, brake: user.brake ?? 0, ignition: user.ignition ?? true,
        clutchPedal: pedalCmd, lever: leverCmd,
      };
    },
  };
  return driver;
}

export default createDriver;
