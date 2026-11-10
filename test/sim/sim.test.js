import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { gearLinear } from '../../src/kin/gears.js';
import { poseFromState } from '../../src/kin/pose.js';
import { createSim } from '../../src/sim/sim.js';
import { makeRig, ratios, kmh } from './rig.js';

const RPM = 30 / Math.PI;
const counterK = gearLinear('counter').A;      // -34/46

function finitePose(p, path = 'pose') {
  if (typeof p === 'number') { expect(Number.isFinite(p), path).toBe(true); return; }
  if (p instanceof Set || typeof p === 'string' || typeof p === 'boolean') return;
  for (const [k, v] of Object.entries(p)) finitePose(v, `${path}.${k}`);
}

function launch(rig, thr = 0.4) {
  rig.driver.request('1');
  rig.until(() => !rig.driver.busy, 10, { throttle: thr });
}
/** shift up through the gears like scenario 4; returns the per-shift sync durations */
function climb(rig, to, thr = 0.7) {
  launch(rig, thr);
  const out = {};
  for (let g = 2; g <= to; g++) {
    expect(rig.until(s => s.rpm.engine > 5500, 30, { throttle: thr, lever: String(g - 1) }), `rev up in ${g - 1}`).toBe(true);
    const n0 = rig.events.length;
    rig.driver.request(String(g));
    expect(rig.until(() => !rig.driver.busy, 10, { throttle: thr }), `shift to ${g}`).toBe(true);
    expect(rig.s.gear).toBe(String(g));
    const ev = rig.events.slice(n0);
    const a = ev.find(e => e.type === 'syncStart'), b = ev.find(e => e.type === 'syncDone');
    out[g] = a && b ? b.t - a.t : null;
  }
  return out;
}

describe('A2 simulation', () => {
  it('1. idles at 700–900 rpm in neutral with the clutch engaged', () => {
    const rig = makeRig();
    rig.run(3, {}, false);
    const s = rig.s;
    expect(s.rpm.engine).toBeGreaterThan(700); expect(s.rpm.engine).toBeLessThan(900);
    expect(s.rpm.input).toBeCloseTo(s.rpm.engine, 6);
    expect(s.rpm.counter).toBeCloseTo(counterK * s.rpm.input, 6);
    expect(s.rpm.main).toBe(0);
    expect(s.clutch.locked).toBe(true);
    expect(s.engine.running).toBe(true);
  });

  it('2. clutch pressed in neutral: input shaft stops by drag, engine idles', () => {
    const rig = makeRig();
    rig.run(0.5, {}, false);
    rig.run(4, { clutchPedal: 1 }, false);
    expect(Math.abs(rig.s.rpm.input)).toBeLessThan(30);
    expect(rig.s.rpm.engine).toBeGreaterThan(700); expect(rig.s.rpm.engine).toBeLessThan(900);
    expect(rig.s.clutch.locked).toBe(false);
  });

  it('3. launch in 1st: no stall, >20 km/h within 6 s, locked ratio exact', () => {
    const rig = makeRig();
    let t20 = null, minRpm = 1e9, lockedChecked = 0;
    rig.driver.request('1');
    for (let i = 0; i < 6 * 240; i++) {
      rig.step({ throttle: 0.4 });
      const s = rig.s;
      minRpm = Math.min(minRpm, s.rpm.engine);
      if (t20 === null && s.speedKmh > 20) t20 = s.t;
      if (s.gear === '1' && s.clutch.locked && s.omegaMain > 1) {
        expect(Math.abs(s.omegaCrank / s.omegaMain - ratios[1])).toBeLessThan(1e-6); lockedChecked++;
      }
    }
    expect(rig.ev('stall')).toHaveLength(0);
    expect(minRpm).toBeGreaterThan(400);
    expect(t20).not.toBeNull();
    expect(lockedChecked).toBeGreaterThan(10);
    const pose = poseFromState(rig.s);
    expect(pose.flow.has('gear1')).toBe(true); expect(pose.flow.has('counterShaft')).toBe(true);
    finitePose(pose);
  });

  it('4. upshifts 1→5 with the driver; sync durations, ratios, 4th direct drive', () => {
    const rig = makeRig();
    const dur = climb(rig, 5);
    for (const g of [2, 3, 4, 5]) {
      expect(dur[g], `sync ${g}`).not.toBeNull();
      expect(dur[g]).toBeGreaterThanOrEqual(0.03); expect(dur[g]).toBeLessThanOrEqual(0.8);
    }
    expect(rig.ev('gearEngaged').map(e => e.detail)).toEqual(['1', '2', '3', '4', '5']);
    // ratio after each shift: wait for lock and compare
    rig.until(s => s.clutch.locked, 3, { throttle: 0.7 });
    expect(Math.abs(rig.s.omegaCrank / rig.s.omegaMain - ratios[5])).toBeLessThan(1e-6);
    const v0 = rig.s.speedKmh;
    rig.run(3, { throttle: 0.7 });
    expect(rig.s.speedKmh).toBeGreaterThan(v0);
  });

  it('4b. 4th gear: input shaft turns with mainshaft, countershaft still at -34/46', () => {
    const rig = makeRig();
    climb(rig, 4);
    rig.run(1, { throttle: 0.5 });
    const s = rig.s;
    expect(s.gear).toBe('4');
    expect(s.omegaInput).toBeCloseTo(s.omegaMain, 9);
    expect(s.rpm.counter / s.rpm.input).toBeCloseTo(counterK, 9);
    const pose = poseFromState(s);
    expect(pose.flow.has('sleeve34')).toBe(true); expect(pose.flow.has('counterShaft')).toBe(false);
    finitePose(pose);
  });

  it('5. shift without clutch grinds; pressing the clutch lets it engage', () => {
    const rig = makeRig();
    launch(rig, 0.6);
    rig.until(s => s.rpm.engine > 5000, 20, { throttle: 0.7 });
    rig.shiftTo('2', { throttle: 0.7 });
    rig.until(s => s.rpm.engine > 3000, 20, { throttle: 0.5 });
    expect(rig.s.gear).toBe('2');
    const t0 = rig.s.t, n0 = rig.events.length;
    const n = Math.round(1.5 / rig.dt);
    for (let i = 0; i < n; i++) { rig.step({ throttle: 0.3, clutchPedal: 0, lever: '3' }, false); expect(rig.s.gear).not.toBe('3'); }
    const grinds = rig.events.slice(n0).filter(e => e.type === 'grind');
    expect(grinds.length).toBeGreaterThan(0);
    expect(grinds[0].detail).toBe('clutch');
    expect(rig.s.t - t0).toBeGreaterThan(1.4);
    expect(rig.until(s => s.gear === '3', 3, { throttle: 0, clutchPedal: 1, lever: '3' }, false)).toBe(true);
  });

  it('6. braking to a stop in gear stalls; ignition restarts in neutral', () => {
    const rig = makeRig();
    launch(rig, 0.5);
    rig.until(s => s.speedKmh > 15, 10, { throttle: 0.5 });
    rig.until(() => rig.ev('stall').length > 0, 10, { throttle: 0, brake: 1, clutchPedal: 0, lever: '1' }, false);
    expect(rig.ev('stall')).toHaveLength(1);
    expect(rig.s.engine.stalled).toBe(true); expect(rig.s.engine.running).toBe(false);
    rig.run(3, { throttle: 0, brake: 1, clutchPedal: 0, lever: '1' }, false);
    expect(rig.s.omegaMain).toBe(0);
    rig.run(1, { throttle: 0, brake: 1, clutchPedal: 1, lever: 'N' }, false);
    expect(rig.s.gear).toBe('N');
    expect(rig.ev('start').length).toBeGreaterThan(0);
    expect(rig.s.engine.running).toBe(true);
    expect(rig.s.rpm.engine).toBeGreaterThan(500);
  });

  it('6b. ignition off stops the engine; ignition on restarts it', () => {
    const rig = makeRig();
    rig.run(1, { ignition: false }, false);
    rig.run(8, { ignition: false }, false);
    expect(rig.s.engine.running).toBe(false);
    expect(rig.s.rpm.engine).toBe(0);
    rig.run(2, { ignition: true }, false);
    expect(rig.s.engine.running).toBe(true);
  });

  it('7. reverse from standstill: engages, drives backwards with ratio R', () => {
    const rig = makeRig();
    rig.run(0.5);
    rig.driver.request('R');
    expect(rig.until(() => rig.s.gear === 'R', 6, { throttle: 0 })).toBe(true);
    rig.until(() => !rig.driver.busy, 5, { throttle: 0 });
    rig.run(3, { throttle: 0.3 });
    const s = rig.s;
    expect(s.gear).toBe('R');
    expect(s.omegaMain).toBeLessThan(0);
    rig.until(s2 => s2.clutch.locked, 3, { throttle: 0.3 });
    expect(Math.abs(rig.s.omegaInput / rig.s.omegaMain - ratios.R)).toBeLessThan(1e-9);
    expect(ratios.R).toBeLessThan(0);
    const pose = poseFromState(rig.s);
    expect(pose.flow.has('idlerR')).toBe(true);
    finitePose(pose);
  });

  it('8. reverse while rolling forward grinds and does not engage', () => {
    const rig = makeRig();
    launch(rig, 0.5);
    rig.until(s => s.speedKmh > 14, 10, { throttle: 0.5 });
    const n0 = rig.events.length;
    rig.run(3, { throttle: 0, clutchPedal: 1, lever: 'R' }, false);
    expect(rig.s.speedKmh).toBeGreaterThan(8);
    expect(rig.s.gear).not.toBe('R');
    expect(rig.s.rails.s5).toBeGreaterThan(-1.5);
    const g = rig.events.slice(n0).filter(e => e.type === 'grind');
    expect(g).toHaveLength(1); expect(g[0].detail).toBe('reverse');
  });

  it('8b. reverse engages automatically once the car has stopped', () => {
    const rig = makeRig();
    launch(rig, 0.5);
    rig.until(s => s.speedKmh > 10, 10, { throttle: 0.5 });
    rig.run(1, { throttle: 0, clutchPedal: 1, lever: 'R' }, false);
    expect(rig.s.gear).not.toBe('R');
    expect(rig.until(s => s.gear === 'R', 120, { throttle: 0, clutchPedal: 1, brake: 0.05, lever: 'R' }, false)).toBe(true);
  });

  it('9. neutral coasting from 60 km/h slows smoothly to exactly 0 and stays', () => {
    const rig = makeRig({ dt: 1 / 60 });
    rig.s.omegaMain = kmh(60);
    let prev = rig.s.omegaMain;
    for (let i = 0; i < 60 * 400; i++) {
      rig.step({}, false);
      expect(rig.s.omegaMain).toBeLessThanOrEqual(prev + 1e-12);
      expect(rig.s.omegaMain).toBeGreaterThanOrEqual(0);
      prev = rig.s.omegaMain;
    }
    expect(rig.s.omegaMain).toBe(0);
    rig.run(5, {}, false);
    expect(rig.s.omegaMain).toBe(0);
  });

  it('10. rotateCrank in 3rd with clutch engaged drags input and main', () => {
    const rig = makeRig();
    climb(rig, 3);
    rig.run(2, { throttle: 0.3 });
    rig.until(s => s.clutch.locked, 3, { throttle: 0.3 });
    expect(rig.s.gear).toBe('3');
    const s = rig.s, th0 = [s.thetaCrank, s.thetaInput, s.thetaMain];
    rig.sim.rotateCrank(1);
    expect(s.thetaCrank - th0[0]).toBeCloseTo(1, 12);
    expect(s.thetaInput - th0[1]).toBeCloseTo(1, 9);
    expect(s.thetaMain - th0[2]).toBeCloseTo(1 / ratios[3], 9);
    rig.sim.rotateCrank(-3.3);
    rig.run(0.05, { throttle: 0.3 });   // invariants checked on the following steps
    expect(s.gear).toBe('3');
  });

  it('11. top speed in 5th is 170–260 km/h and never exceeds redline + 300 rpm', () => {
    const rig = makeRig();
    climb(rig, 5, 0.9);
    let maxRpm = 0;
    rig.until(() => false, 60, st => { maxRpm = Math.max(maxRpm, st.rpm.engine); return { throttle: 1 }; });
    expect(rig.s.gear).toBe('5');
    expect(rig.s.speedKmh).toBeGreaterThan(170); expect(rig.s.speedKmh).toBeLessThan(260);
    expect(maxRpm).toBeLessThan(SPEC.engine.redlineRpm + 300);
  });

  it('12. poseFromState is finite while idling, shifting and with the engine off', () => {
    const rig = makeRig();
    const check = () => finitePose(poseFromState(rig.s));
    check();
    rig.driver.request('1');
    for (let i = 0; i < 1500; i++) { rig.step({ throttle: 0.4 }); if (i % 25 === 0) check(); }
    rig.run(1, { ignition: false }, false);
    rig.run(8, { ignition: false }, false);
    const p = poseFromState(rig.s);
    finitePose(p);
    for (const cyl of p.cylinders) { expect(cyl.burn).toBe(0); expect(cyl.spark).toBe(false); }
    expect(p.flow).toBeInstanceOf(Set);
    expect(p.idlerX).toBe(rig.s.rails.s5);
  });

  it('downshifts with the driver keep all invariants', () => {
    const rig = makeRig();
    climb(rig, 4);
    for (const g of ['3', '2', '3', '4']) {
      rig.run(0.5, { throttle: 0.3 });
      expect(rig.shiftTo(g, { throttle: 0.3 }), `shift to ${g}`).toBe(true);
      expect(rig.s.gear).toBe(g);
    }
  });

  it('random lever/clutch/throttle abuse (deterministic) never breaks the invariants', () => {
    const rig = makeRig();
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const levers = ['N', '1', '2', '3', '4', '5', 'R'];
    let inp = { throttle: 0.3, clutchPedal: 0, brake: 0, lever: 'N', ignition: true };
    for (let i = 0; i < 240 * 120; i++) {
      if (i % 60 === 0) inp = { throttle: rnd() < 0.5 ? 0 : rnd(), clutchPedal: rnd() < 0.5 ? 1 : rnd(), brake: rnd() < 0.8 ? 0 : rnd(), lever: levers[Math.floor(rnd() * 7)], ignition: rnd() < 0.95 };
      rig.step(inp, false);
    }
  });

  it('is deterministic', () => {
    const a = makeRig(), b = makeRig();
    for (const r of [a, b]) { r.driver.request('1'); r.run(5, { throttle: 0.4 }); }
    expect(a.s.thetaMain).toBe(b.s.thetaMain);
    expect(a.s.omegaCrank).toBe(b.s.omegaCrank);
  });
});

describe('regression: leaving reverse while the car still rolls', () => {
  it('pulling out of reverse never emits a grind event', async () => {
    const { createSim } = await import('../../src/sim/sim.js');
    const { createDriver } = await import('../../src/sim/driver.js');
    const sim = createSim(), driver = createDriver(sim), dt = 1 / 240, events = [];
    const run = (sec, user, until) => {
      for (let i = 0; i < sec / dt; i++) {
        sim.step(dt, driver.update(dt, { throttle: 0, brake: 0, clutchPedal: 0, ignition: true, ...user }));
        events.push(...sim.drainEvents());
        if (until && until(sim.state)) return true;
      }
      return !until;
    };
    driver.request('R');
    expect(run(10, { throttle: 0.3 }, s => !driver.busy && s.gear === 'R')).toBe(true);
    run(2, { throttle: 0.3 });
    expect(sim.state.speedKmh).toBeLessThan(-2);
    events.length = 0;
    driver.request('N');
    expect(run(5, {}, s => !driver.busy && s.gear === 'N' && s.rails.s5 === 0)).toBe(true);
    expect(events.filter(e => e.type === 'grind')).toEqual([]);
  });
});
