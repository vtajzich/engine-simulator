// INTEGRATION 3/3: a full drive replayed from the simulator — start, 1→2→3→4→5, stop, reverse.
// Every sampled frame is posed on the 3D model and checked for collisions of the shifting parts
// (sleeves, blocker rings, forks, lever, reverse idler) against everything.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { poseFromState } from '../../src/kin/pose.js';
import { createSim } from '../../src/sim/sim.js';
import { createDriver } from '../../src/sim/driver.js';
import { createRig, SHIFTING, GEARBOX } from './_assembly.js';

let rig;
beforeAll(() => { rig = createRig('drive'); });
afterAll(() => rig.save());

describe('full drive replayed from the simulator', () => {
  it('every sampled frame of the drive is collision-free', () => {
    const sim = createSim();
    const driver = createDriver(sim);
    const dt = 1 / 480;
    const moving = [], cruising = [], events = [];
    let lastSample = -1, prevRails = 0;
    const run = (seconds, user, until) => {
      const n = Math.round(seconds / dt);
      for (let i = 0; i < n; i++) {
        sim.step(dt, driver.update(dt, { throttle: 0, brake: 0, clutchPedal: 0, ignition: true, ...user }));
        for (const e of sim.drainEvents()) events.push(`${e.t.toFixed(2)} ${e.type}${e.detail ? ':' + e.detail : ''}`);
        const s = sim.state;
        const rails = s.rails.s12 + 2 * s.rails.s34 + 4 * s.rails.s5 + 8 * s.lever.col;
        const railMoving = Math.abs(rails - prevRails) > 1e-9;
        prevRails = rails;
        const every = railMoving ? 1 / 120 : 1 / 4;
        if (s.t - lastSample >= every - 1e-9) {
          lastSample = s.t;
          (railMoving ? moving : cruising).push({ label: `t=${s.t.toFixed(3)} gear=${s.gear} lever=${s.lever.target} rails=${s.rails.s12.toFixed(2)}/${s.rails.s34.toFixed(2)}/${s.rails.s5.toFixed(2)}`, pose: poseFromState(s) });
        }
        if (until && until(s)) return true;
      }
      return !until;
    };
    const shift = (g, user = {}) => { driver.request(g); expect(run(10, user, s => !driver.busy && s.gear === g), `shift to ${g}`).toBe(true); };

    run(1.0, {});
    shift('1', { throttle: 0.45 });
    for (const g of ['2', '3', '4', '5']) {
      expect(run(20, { throttle: 0.8 }, s => s.rpm.engine > 5200), `revs before ${g}`).toBe(true);
      shift(g, { throttle: 0.8 });
    }
    run(1.0, { throttle: 0.5 });
    shift('N');
    expect(run(60, { brake: 1 }, s => Math.abs(s.speedKmh) < 0.01), 'brake to standstill').toBe(true);
    run(0.5, { brake: 1 });
    shift('R', { throttle: 0.3 });
    run(2.0, { throttle: 0.3 });
    expect(sim.state.omegaMain).toBeLessThan(0);
    shift('N');

    rig.report.drive = { movingFrames: moving.length, cruisingFrames: cruising.length, events };
    const a = rig.run('drive: frames while shifting', moving, { only: (x, y) => SHIFTING.test(x) || SHIFTING.test(y) });
    const b = rig.run('drive: frames while cruising', cruising, { only: (x, y) => GEARBOX.test(x) || GEARBOX.test(y) });
    expect(a.res.collisions.size, a.message).toBe(0);
    expect(b.res.collisions.size, b.message).toBe(0);
  });
});
