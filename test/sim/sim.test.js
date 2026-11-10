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

// ───────────── S1: slip-controlled launch, anti-stall, start in gear, angleScale ─────────────
const SPEC_V = SPEC.vehicle;
const idleCreepKmh = SPEC.engine.idleRpm / RPM / Math.abs(ratios[1]) * SPEC_V.tyreRadiusM / SPEC_V.finalDrive * 3.6;

describe('S1 launch at zero throttle never stalls', () => {
  for (const [gear, sign] of [['1', 1], ['R', -1]]) {
    it(`gear ${gear}: locks within 8 s, no stall, creeps at idle speed and holds it`, () => {
      const rig = makeRig();
      rig.run(1, {});
      rig.driver.request(gear);
      expect(rig.until(s => s.gear === gear && s.clutch.locked && !rig.driver.busy, 8, { throttle: 0 })).toBe(true);
      rig.run(2, { throttle: 0 });
      const v = [];
      for (let i = 0; i < 5 * 240; i++) { rig.step({ throttle: 0 }); v.push(rig.s.speedKmh); }
      for (const x of v) expect(Math.abs(x - sign * (gear === 'R' ? 5.9 : 6.6))).toBeLessThan(0.5);
      expect(rig.ev('stall')).toHaveLength(0);
      expect(rig.s.engine.running).toBe(true);
    });
  }
  it('creep speed in 1st matches idle rpm / ratio', () => { expect(idleCreepKmh).toBeCloseTo(6.6, 0); });
});

describe('S1 anti-stall hold and start in gear', () => {
  function brakeToStop(rig) {
    expect(rig.until(s => Math.abs(s.speedKmh) < 0.01, 40, { throttle: 0, brake: 1 })).toBe(true);
  }
  it('braking to a stop in 2nd with the assistant does not stall; creeps/holds after release', () => {
    const rig = makeRig();
    launch(rig, 0.5);
    rig.driver.request('2'); rig.until(() => !rig.driver.busy, 10, { throttle: 0.5 });
    rig.until(s => s.speedKmh > 30, 20, { throttle: 0.6 });
    brakeToStop(rig);
    rig.run(2, { throttle: 0, brake: 1 });
    expect(rig.ev('stall')).toHaveLength(0);
    expect(rig.s.engine.running).toBe(true);
    expect(rig.driver.stage).toBe('hold');
    expect(rig.driver.busy).toBe(false);
    expect(rig.s.rpm.engine).toBeGreaterThan(600);
    rig.run(10, { throttle: 0, brake: 0 });
    expect(rig.ev('stall')).toHaveLength(0);
    expect(rig.s.gear).toBe('2');
  });
  it('no stall for 10 s after brake release in 5th (gear too tall to creep)', () => {
    const rig = makeRig();
    climb(rig, 5, 0.8);
    rig.until(s => s.speedKmh > 60, 30, { throttle: 0.6 });
    brakeToStop(rig);
    rig.run(1, { throttle: 0, brake: 1 });
    expect(rig.ev('stall')).toHaveLength(0);
    rig.run(12, { throttle: 0, brake: 0 });
    expect(rig.ev('stall')).toHaveLength(0);
    expect(rig.s.engine.running).toBe(true);
  });
  it('a new gear request is accepted during the hold', () => {
    const rig = makeRig();
    launch(rig, 0.5);
    rig.until(s => s.speedKmh > 15, 10, { throttle: 0.5 });
    brakeToStop(rig);
    rig.run(1, { throttle: 0, brake: 1 });
    expect(rig.driver.busy).toBe(false);
    expect(rig.shiftTo('N', { brake: 1 })).toBe(true);
    expect(rig.s.gear).toBe('N');
    expect(rig.ev('stall')).toHaveLength(0);
  });
  it('stalled in 1st, driver takes over with ignition on: starts with the clutch pressed, no second stall', () => {
    const rig = makeRig();
    launch(rig, 0.5);
    rig.until(s => s.speedKmh > 15, 10, { throttle: 0.5 });
    rig.until(() => rig.ev('stall').length > 0, 10, { throttle: 0, brake: 1, clutchPedal: 0, lever: '1' }, false);
    rig.run(3, { throttle: 0, brake: 1, clutchPedal: 0, lever: '1', ignition: false }, false);
    expect(rig.s.engine.running).toBe(false); expect(rig.s.gear).toBe('1'); expect(rig.s.omegaMain).toBe(0);
    let vmax = 0, started = false;
    for (let i = 0; i < 4 * 240 && !started; i++) {
      rig.step({ throttle: 0, ignition: true });
      vmax = Math.max(vmax, Math.abs(rig.s.speedKmh));
      if (rig.s.engine.running) started = true;
    }
    expect(started).toBe(true);
    expect(vmax).toBeLessThan(0.5);
    rig.run(8, { throttle: 0, ignition: true });
    expect(rig.ev('stall')).toHaveLength(1);
    expect(rig.s.engine.running).toBe(true);
  });
});

describe('S1 angleScale', () => {
  it('defaults to 1, is clamped to 0.0005..1 and mirrored into state', () => {
    const sim = createSim();
    expect(sim.angleScale).toBe(1);
    sim.angleScale = 0.05; expect(sim.angleScale).toBe(0.05);
    sim.step(1 / 240, {}); expect(sim.state.angleScale).toBe(0.05);
    sim.angleScale = 0; expect(sim.angleScale).toBe(0.0005);
    sim.angleScale = 7; expect(sim.angleScale).toBe(1);
  });

  const randomAbuse = rig => {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const levers = ['N', '1', '2', '3', '4', '5', 'R'];
    let inp = {};
    for (let i = 0; i < 240 * 120; i++) {
      if (i % 60 === 0) inp = { throttle: rnd() < 0.5 ? 0 : rnd(), clutchPedal: rnd() < 0.5 ? 1 : rnd(), brake: rnd() < 0.8 ? 0 : rnd(), lever: levers[Math.floor(rnd() * 7)], ignition: rnd() < 0.95 };
      rig.step(inp, false);
    }
  };

  for (const angleScale of [0.05, 0.002]) {
    describe(`angleScale ${angleScale}: scenarios keep I1–I5`, () => {
      it('launch', () => {
        const rig = makeRig({ angleScale });
        rig.driver.request('1');
        let t20 = null;
        for (let i = 0; i < 6 * 240; i++) { rig.step({ throttle: 0.4 }); if (t20 === null && rig.s.speedKmh > 20) t20 = rig.s.t; }
        expect(rig.ev('stall')).toHaveLength(0);
        expect(t20).not.toBeNull();
        expect(Math.abs(rig.s.omegaCrank / rig.s.omegaMain - ratios[1])).toBeLessThan(1e-6);
      });
      it('upshifts 1→5', () => {
        const rig = makeRig({ angleScale });
        const dur = climb(rig, 5);
        for (const g of [2, 3, 4, 5]) expect(dur[g], `sync ${g}`).not.toBeNull();
        expect(rig.ev('gearEngaged').map(e => e.detail)).toEqual(['1', '2', '3', '4', '5']);
      });
      it('reverse', () => {
        const rig = makeRig({ angleScale });
        rig.run(0.5);
        rig.driver.request('R');
        expect(rig.until(() => rig.s.gear === 'R', 6, { throttle: 0 })).toBe(true);
        rig.until(() => !rig.driver.busy, 5, { throttle: 0 });
        rig.run(3, { throttle: 0.3 });
        expect(rig.s.omegaMain).toBeLessThan(0);
        rig.until(s => s.clutch.locked, 3, { throttle: 0.3 });
        expect(Math.abs(rig.s.omegaInput / rig.s.omegaMain - ratios.R)).toBeLessThan(1e-9);
      });
      it('random abuse', () => { randomAbuse(makeRig({ angleScale })); });
    });
  }

  it('non-angle state is identical for angleScale 1 and 0.05 (same input script)', () => {
    const snap = rig => {
      const s = rig.s;
      return [s.t, s.omegaCrank, s.omegaInput, s.omegaMain, s.clutchPedal, s.clutch.locked ? 1 : 0, s.clutch.torqueNm,
        s.rails.s12, s.rails.s34, s.rails.s5, s.lever.col, s.lever.row, s.gear, s.speedKmh, s.engine.running ? 1 : 0,
        s.rpm.engine, s.rpm.input, s.rpm.counter, s.rpm.main, JSON.stringify(s.synchro.ringIndex), JSON.stringify(s.synchro.ringPush), s.synchro.active?.phase];
    };
    const script = rig => {
      const out = [];
      const go = (sec, user, drv = true) => { const n = Math.round(sec / rig.dt); for (let i = 0; i < n; i++) { rig.step(user, drv); out.push(snap(rig)); } };
      go(0.5, {});
      rig.driver.request('1'); go(6, { throttle: 0.5 });
      for (const g of ['2', '3']) { go(2, { throttle: 0.8 }); rig.driver.request(g); go(3, { throttle: 0.8 }); }
      rig.driver.request('N'); go(2, {});
      go(6, { brake: 1 });
      rig.driver.request('R'); go(6, { throttle: 0.3 });
      rig.driver.request('N'); go(3, {});
      go(3, { clutchPedal: 1, lever: '2', throttle: 0.5 }, false);   // raw grind / sync without the driver
      return { out, ev: rig.events.map(e => [e.t, e.type, e.detail]) };
    };
    const a = script(makeRig({ angleScale: 1 })), b = script(makeRig({ angleScale: 0.05 }));
    expect(b.ev).toEqual(a.ev);
    expect(b.out.length).toBe(a.out.length);
    for (let i = 0; i < a.out.length; i++) {
      for (let j = 0; j < a.out[i].length; j++) {
        const x = a.out[i][j], y = b.out[i][j];
        if (typeof x === 'number') { if (Math.abs(x - y) > 1e-9) throw new Error(`field ${j} differs at step ${i}: ${x} vs ${y}`); }
        else expect(y, `field ${j} step ${i}`).toBe(x);
      }
    }
  });
});

// ───────────── clutch driver: no pumping (position-proportional slip guard, evaluated inside sim sub-steps) ─────────────
// Every driver scenario runs with three caller-step patterns: fixed 1/240, fixed 1/60 (the app's frame rate) and a
// jittery frame-time cycle. The guard loop is only stable if it runs at sub-step rate, so the caller dt must not matter.
const DT_PATTERNS = {
  '1/240': undefined,
  '1/60': { dt: 1 / 60 },
  'jitter': { dts: [0.0167, 0.0161, 0.0173, 0.0331, 0.0166] },
};
function track(rig) {
  const t = { time: [], pedal: [], cap: [], stages: [], rpm: [], speed: [], lastDir: 0, reversals: 0, travel: 0, stageChanges: 0, prevPedal: null, prevStage: null };
  t.step = user => {
    rig.step(user);
    const p = rig.s.clutchPedal, st = rig.driver.stage;
    if (t.prevPedal !== null) {
      const d = p - t.prevPedal;
      if (Math.abs(d) >= 1e-4) { const dir = Math.sign(d); if (t.lastDir && dir !== t.lastDir) t.reversals++; t.lastDir = dir; t.travel += Math.abs(d); }
    }
    if (t.prevStage !== null && st !== t.prevStage) t.stageChanges++;
    t.prevPedal = p; t.prevStage = st;
    t.time.push(rig.s.t); t.pedal.push(p); t.cap.push(rig.s.clutch.capacityNm); t.stages.push(st);
    t.rpm.push(rig.s.engine.running ? rig.s.rpm.engine : 0); t.speed.push(rig.s.speedKmh);
  };
  const dtOf = () => rig.lastDt;
  t.run = (sec, user) => { for (let el = 0; el < sec - rig.dt / 2; el += dtOf()) t.step(typeof user === 'function' ? user(rig.s) : user); };
  t.until = (cond, sec, user) => { for (let el = 0; el < sec - rig.dt / 2; el += dtOf()) { if (cond(rig.s)) return true; t.step(user); } return cond(rig.s); };
  t.tail = (arr, sec) => { const t0 = t.time.at(-1) - sec; return arr.filter((_, i) => t.time[i] >= t0); };
  t.lastSpread = (sec, arr = t.pedal) => { const a = t.tail(arr, sec); return Math.max(...a) - Math.min(...a); };
  return t;
}
// A deliberate shift request is itself 3-4 stage changes and 2-3 pedal reversals (declutch, release), so the
// budget of 10 applies to a single launch/shift and grows by 5 for every further request in the scenario.
const noPump = (rig, t, requests) => {
  const budget = 10 + 5 * (requests - 1);
  expect(rig.ev('stall')).toHaveLength(0);
  expect(t.reversals).toBeLessThanOrEqual(budget);
  expect(t.stageChanges).toBeLessThanOrEqual(budget);
  expect(t.lastSpread(4)).toBeLessThanOrEqual(0.01);
  expect(t.lastSpread(4, t.cap)).toBeLessThanOrEqual(5);
};
const noPumpScenarios = {
  '1st from rest, 12 s': (rig, t) => { rig.driver.request('1'); t.run(12, { throttle: 0 }); },
  '3rd from rest, 15 s': (rig, t) => { rig.driver.request('3'); t.run(15, { throttle: 0 }); },
  '5th from rest, 15 s': (rig, t) => { rig.driver.request('5'); t.run(15, { throttle: 0 }); },
  '1st then 4th at 7 km/h': (rig, t) => {
    rig.driver.request('1'); t.until(s => s.clutch.locked && !rig.driver.busy && s.speedKmh > 6, 10, { throttle: 0 });
    rig.driver.request('4'); t.run(15, { throttle: 0 });
  },
  '1→2→3→5 with light throttle': (rig, t) => {
    rig.driver.request('1'); t.run(6, { throttle: 0.15 });
    for (const g of ['2', '3', '5']) { rig.driver.request(g); t.run(5, { throttle: g === '5' ? 0.1 : 0.2 }); }
    t.run(8, { throttle: 0.1 });
  },
  '2nd, full brake to stop, release, 20 s': (rig, t) => {
    rig.driver.request('1'); t.run(4, { throttle: 0.5 });
    rig.driver.request('2'); t.run(6, { throttle: 0.5 });
    t.until(s => Math.abs(s.speedKmh) < 0.01, 40, { throttle: 0, brake: 1 });
    t.run(2, { throttle: 0, brake: 1 });
    t.run(20, { throttle: 0, brake: 0 });   // slipping from 0 up to 2nd's idle speed (11 km/h) at idle torque takes ~10 s
  },
};
for (const [pname, popt] of Object.entries(DT_PATTERNS)) {
  describe(`clutch driver does not pump (caller dt ${pname})`, () => {
    for (const [name, fn] of Object.entries(noPumpScenarios)) {
      it(name, () => {
        const rig = makeRig(popt), t = track(rig);
        let requests = 0; const req = rig.driver.request; rig.driver.request = g => { requests++; return req(g); };
        rig.run(1, {});
        fn(rig, t);
        if (process.env.DRV_LOG) require('fs').appendFileSync(process.env.DRV_LOG, `${pname} | ${name} | reversals ${t.reversals} stageChanges ${t.stageChanges} pedalSpread4s ${t.lastSpread(4).toFixed(4)} capSpread4s ${t.lastSpread(4, t.cap).toFixed(2)} rpm ${t.rpm.at(-1).toFixed(0)}\n`);
        noPump(rig, t, requests);
      });
    }
    it('tall-gear launch (3rd, zero throttle) is physically sensible', () => {
      const rig = makeRig(popt), t = track(rig);
      rig.run(1, {});
      rig.driver.request('3');
      t.until(() => rig.driver.stage === 'release', 10, { throttle: 0 });
      const i0 = t.speed.length;
      t.run(15, { throttle: 0 });
      for (let i = i0; i < t.rpm.length; i++) { expect(t.rpm[i]).toBeGreaterThan(550); expect(t.rpm[i]).toBeLessThan(1200); }
      for (let i = i0 + 1; i < t.speed.length; i++) expect(t.speed[i]).toBeGreaterThanOrEqual(t.speed[i - 1] - 0.01)   // 0.01 km/h: bite-point ripple as the clutch takes up;
      expect(rig.s.clutch.locked || (t.lastSpread(4) <= 0.01 && t.lastSpread(4, t.cap) <= 5)).toBe(true);
    });
    for (const [gear, sign] of [['1', 1], ['R', -1]]) {
      it(`zero-throttle creep in ${gear}: locked, pedal 0, steady speed`, () => {
        const rig = makeRig(popt);
        rig.run(1, {});
        rig.driver.request(gear);
        expect(rig.until(s => s.gear === gear && s.clutch.locked && !rig.driver.busy, 8, { throttle: 0 })).toBe(true);
        rig.run(2, { throttle: 0 });
        for (let i = 0; i < 5 * 240; i += 1 + (i % 3)) { rig.step({ throttle: 0 }); expect(Math.abs(rig.s.speedKmh - sign * (gear === 'R' ? 5.9 : 6.6))).toBeLessThan(0.5); }
        expect(rig.s.clutch.locked).toBe(true);
        expect(rig.s.clutchPedal).toBe(0);
        expect(rig.s.clutch.guard).toBe(0);
        expect(rig.ev('stall')).toHaveLength(0);
      });
    }
    it('launch with throttle 0.4 exceeds 20 km/h within 6 s', () => {
      const rig = makeRig(popt);
      rig.driver.request('1');
      expect(rig.until(s => s.speedKmh > 20, 6, { throttle: 0.4 })).toBe(true);
      expect(rig.ev('stall')).toHaveLength(0);
    });

    describe('start matrix: ignition off/on in every gear', () => {
      function driveTo(rig, g) {
        if (g === 'R') { rig.driver.request('R'); rig.until(() => !rig.driver.busy, 10, { throttle: 0 }); rig.run(3, { throttle: 0 }); return; }
        rig.driver.request('1'); rig.until(() => !rig.driver.busy, 10, { throttle: 0.4 });
        for (const k of ['2', '3', '4', '5']) {
          if (Number(k) > Number(g)) break;
          rig.until(s => s.speedKmh > { 2: 12, 3: 25, 4: 40, 5: 55 }[k] - 8, 20, { throttle: 0.6 });
          rig.driver.request(k); rig.until(() => !rig.driver.busy, 10, { throttle: 0.4 });
        }
        rig.run(3, { throttle: 0.4 });
      }
      for (const g of ['1', '2', '3', '4', '5', 'R']) {
        for (const braked of [false, true]) {
          it(`gear ${g}${braked ? ' with brake held' : ''}: restarts within 3 s and stays running`, () => {
            const rig = makeRig(popt);
            driveTo(rig, g);
            const b = braked ? 1 : 0;
            rig.run(2, { throttle: 0, brake: b, ignition: false });
            expect(rig.s.engine.running).toBe(false);
            const n0 = rig.ev('stall').length;
            expect(rig.until(s => s.engine.running, 3, { throttle: 0, brake: b, ignition: true })).toBe(true);
            rig.run(braked ? 2 : 0, { throttle: 0, brake: b, ignition: true });
            rig.run(8, { throttle: 0, brake: 0, ignition: true });
            expect(rig.s.engine.running).toBe(true);
            expect(rig.ev('stall').length).toBe(n0);
          });
        }
        it(`gear ${g}: raw-sim stall at standstill, driver takes over`, () => {
          const rig = makeRig(popt);
          const jit = rig.dts; rig.dts = null;      // the raw-sim set-up (gear engagement with no driver) runs at the fixed small dt
          rig.run(1, {});
          const raw = { throttle: 0, brake: 1, clutchPedal: 0, lever: g, ignition: true };
          rig.run(3, raw, false);
          if (rig.s.gear !== g) { rig.run(4, { ...raw, clutchPedal: 1 }, false); rig.run(2, raw, false); }
          expect(rig.s.gear).toBe(g);
          rig.until(() => !rig.s.engine.running, 6, raw, false);
          rig.run(1, { ...raw, ignition: false }, false);
          expect(rig.s.engine.running).toBe(false);
          rig.dts = jit;
          const n0 = rig.ev('stall').length;
          expect(rig.until(s => s.engine.running, 3, { throttle: 0, brake: 0, ignition: true })).toBe(true);
          rig.run(8, { throttle: 0, brake: 0, ignition: true });
          expect(rig.s.engine.running).toBe(true);
          expect(rig.ev('stall').length).toBe(n0);
        });
      }
    });
  });
}

describe('raw sim without clutchGuard is unchanged', () => {
  it('3rd, clutch engaged at standstill with the brake released still stalls; guard stays 0', () => {
    const rig = makeRig();
    rig.run(1, {});
    rig.run(3, { throttle: 0, brake: 1, clutchPedal: 1, lever: '3' }, false);
    expect(rig.s.gear).toBe('3');
    rig.run(8, { throttle: 0, brake: 0, clutchPedal: 0, lever: '3' }, false);
    expect(rig.ev('stall').length).toBeGreaterThan(0);
    expect(rig.s.clutch.guard).toBe(0);
  });
});
