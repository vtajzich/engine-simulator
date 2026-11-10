// Test rig: runs the simulator (optionally with the driver) and asserts invariants I1–I5 after EVERY step.
import { expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive, wrapTo } from '../../src/kin/derive.js';
import { gearLinear, gearForSleeve, gearNumber } from '../../src/kin/gears.js';
import { misalign, maxMisalign, advanceDog, advanceRing, xBlock } from '../../src/kin/synchro.js';
import { createSim } from '../../src/sim/sim.js';
import { createDriver } from '../../src/sim/driver.js';

export const D = derive();
export const ratios = D.gearbox.ratios;
export const c = D.synchro.c;
const RV = SPEC.gearbox.reverse;
const rRevMain = RV.module * RV.main / 2;
const nameOf = { '1': 'g1', '2': 'g2', '3': 'g3', '4': 'input', '5': 'g5' };
export const kmh = v => v / 3.6 / (SPEC.vehicle.tyreRadiusM / SPEC.vehicle.finalDrive);   // km/h -> mainshaft rad/s

function allFinite(o, path = 'state') {
  if (typeof o === 'number') { if (!Number.isFinite(o)) throw new Error(`non-finite ${path}`); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) allFinite(v, `${path}.${k}`);
}

export function checkInvariants(s, prev, dt) {
  allFinite(s);
  // I1 interlock
  const off = Object.values(s.rails).filter(x => Math.abs(x) > 1e-9).length;
  expect(off).toBeLessThanOrEqual(1);
  // I4 angle continuity
  if (prev) {
    for (const [k, w] of [['thetaCrank', 'omegaCrank'], ['thetaInput', 'omegaInput'], ['thetaMain', 'omegaMain']]) {
      const lim = Math.max(Math.abs(s[w]), Math.abs(prev[w] ?? 0)) * dt * (s.angleScale ?? 1) + 0.2;
      if (Math.abs(s[k] - prev[k]) > lim) throw new Error(`I4 ${k} jumped ${s[k] - prev[k]} at t=${s.t}`);
    }
  }
  // I2 engaged gear
  if (s.gear !== 'N' && s.gear !== 'R') {
    const g = gearLinear(nameOf[s.gear]);
    const m = misalign(g.A * s.thetaInput + g.B, s.thetaMain);
    if (m > c) throw new Error(`I2 misalign ${m} > c ${c} in gear ${s.gear} at t=${s.t}`);
    if (Math.abs(s.omegaInput - ratios[s.gear] * s.omegaMain) >= 1e-6) throw new Error(`I2 speed lock broken in ${s.gear} at t=${s.t}`);
  }
  if (s.gear === 'R') {
    const g = gearLinear('revMain');
    const e = wrapTo(s.thetaMain - (g.A * s.thetaInput + g.B), 2 * Math.PI / RV.main);
    if (Math.abs(e) * rRevMain >= 0.05) throw new Error(`I2 reverse residual ${Math.abs(e) * rRevMain} mm`);
    if (Math.abs(s.omegaInput - ratios.R * s.omegaMain) >= 1e-6) throw new Error('I2 reverse speed lock broken');
  }
  // I3 chamfer rule and I5 reverse entry
  const a = s.synchro.active;
  if (a) {
    const X = Math.abs(s.rails[a.sleeve]);
    if (a.gear === 'revMain') {
      const g = gearLinear('revMain');
      const e = wrapTo(s.thetaMain - (g.A * s.thetaInput + g.B), 2 * Math.PI / RV.main);
      if (X > RV.entryGap + 1e-9 && Math.abs(e) * rRevMain >= 0.05) throw new Error(`I5 idler entered with residual ${Math.abs(e) * rRevMain} mm`);
    } else {
      const g = gearLinear(a.gear);
      const m = misalign(g.A * s.thetaInput + g.B, s.thetaMain);
      if (m > maxMisalign(advanceDog(X)) + 1e-6) throw new Error(`I3 dog misalign ${m} at x=${X}`);
      const ringKey = 'ring' + gearNumber[a.gear];
      if (Math.abs(s.synchro.ringIndex[ringKey]) > maxMisalign(advanceRing(X)) + 1e-6) throw new Error(`I3 ring index at x=${X}`);
      if (a.phase === 'blocking' && X > xBlock + 1e-6) throw new Error('I3 passed xBlock while blocking');
    }
  }
}

// `dts`: optional cycle of caller step sizes (e.g. real frame jitter); each driver.update + sim.step pair uses the next one.
export function makeRig({ dt = 1 / 240, angleScale = 1, dts = null } = {}) {
  let di = 0;
  const sim = createSim();
  sim.angleScale = angleScale;
  const driver = createDriver(sim);
  const events = [];
  const rig = {
    sim, driver, dt, dts, lastDt: dt, events, s: sim.state,
    prev: null,
    /** one step; user = { throttle, brake, clutchPedal, lever, ignition }; useDriver routes through the driver */
    step(user = {}, useDriver = true) {
      const dt = rig.dts ? rig.dts[di++ % rig.dts.length] : rig.dt;
      rig.lastDt = dt;
      const inp = useDriver ? driver.update(dt, user) : user;
      const before = { thetaCrank: sim.state.thetaCrank, thetaInput: sim.state.thetaInput, thetaMain: sim.state.thetaMain,
        omegaCrank: sim.state.omegaCrank, omegaInput: sim.state.omegaInput, omegaMain: sim.state.omegaMain };
      sim.step(dt, inp);
      for (const e of sim.drainEvents()) events.push(e);
      checkInvariants(sim.state, before, dt);
    },
    run(seconds, user = {}, useDriver = true) {
      for (let el = 0; el < seconds - rig.dt / 2; el += rig.lastDt) rig.step(typeof user === 'function' ? user(sim.state) : user, useDriver);
    },
    until(cond, maxSeconds, user = {}, useDriver = true) {
      for (let el = 0; el < maxSeconds - rig.dt / 2; el += rig.lastDt) {
        if (cond(sim.state)) return true;
        rig.step(typeof user === 'function' ? user(sim.state) : user, useDriver);
      }
      return cond(sim.state);
    },
    ev(type) { return events.filter(e => e.type === type); },
    /** request a gear through the driver and wait until the driver is done */
    shiftTo(gear, user = {}, maxSeconds = 12) {
      driver.request(gear);
      return rig.until(() => !driver.busy, maxSeconds, user);
    },
    /** launch into 1st and accelerate until gear-rpm threshold; returns after reaching rpm */
    revTo(rpm, thr = 0.7) { return rig.until(s => s.rpm.engine > rpm && !driver.busy, 30, { throttle: thr }); },
  };
  return rig;
}
