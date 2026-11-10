import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { rad } from '../../src/kin/derive.js';
import { gasState } from '../../src/kin/engine.js';
import { poseAt, poseFromState } from '../../src/kin/pose.js';
import {
  sparkAdvanceDeg, sparkCrankDeg, rotorAngle, terminalAngle, terminalOrder, rotorMisalignDeg, flashOf,
} from '../../src/kin/ignition.js';

const IG = SPEC.engine.ignition;
const TAU = 2 * Math.PI;
const mod = (a, n) => ((a % n) + n) % n;

describe('ignition kinematics', () => {
  it('terminals are in firing order, 90 degrees apart', () => {
    expect(terminalOrder()).toEqual(SPEC.engine.firingOrder);
    const ang = terminalOrder().map(c => terminalAngle(c - 1));
    for (let k = 0; k < 4; k++) expect(mod(ang[(k + 1) % 4] - ang[k], TAU)).toBeCloseTo(Math.PI / 2, 9);
    for (const a of ang) { expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(TAU); }
  });

  it('spark advance matches the idle..load range', () => {
    expect(sparkAdvanceDeg(0)).toBe(10); expect(sparkAdvanceDeg(0.5)).toBe(20); expect(sparkAdvanceDeg(1)).toBe(30);
  });

  it('rotor tip stays on its terminal at every spark for the whole advance range', () => {
    for (let c = 0; c < 4; c++) for (const thr of [0, 0.5, 1]) {
      const m = Math.abs(rotorMisalignDeg(c, thr));
      expect(m, `cyl ${c} thr ${thr}`).toBeLessThanOrEqual(5.01);
      expect(m).toBeLessThanOrEqual(IG.rotor.tipHalfAngleDeg - 2);
    }
    expect(rotorMisalignDeg(0, 0.5)).toBeCloseTo(0, 9);
  });

  it('rotor turns once per cycle (half crank speed)', () => {
    for (const crank of [0, 1, 2.7, 5]) {
      expect(mod(rotorAngle(crank + 4 * Math.PI) - rotorAngle(crank), TAU)).toBeCloseTo(0, 9);
      expect(rotorAngle(crank)).toBeCloseTo(crank / 2, 12);
    }
  });

  it('flashOf envelope', () => {
    expect(flashOf(0)).toBe(1); expect(flashOf(IG.flashDeg)).toBe(0);
    expect(flashOf(-1)).toBe(0); expect(flashOf(IG.flashDeg + 5)).toBe(0);
    expect(flashOf(IG.flashDeg / 2)).toBeCloseTo(0.5, 12);
  });

  it('gasState flash is positive exactly on [sparkPsi, sparkPsi + flashDeg)', () => {
    for (const thr of [0, 0.3, 1]) {
      const sparkPsi = 720 - sparkAdvanceDeg(thr);
      for (let psi = 0; psi < 720; psi += 0.25) {
        const since = mod(psi - sparkPsi, 720);
        const g = gasState(psi, thr);
        expect(g.flash > 0, `psi ${psi} thr ${thr}`).toBe(since < IG.flashDeg);
        expect(g.spark).toBe(since < 4);
      }
    }
    expect(gasState(720 - sparkAdvanceDeg(0.3)).flash).toBe(1);
  });

  it('sparkCrankDeg is the crank angle at which the cylinder sparks', () => {
    for (let c = 0; c < 4; c++) {
      const crank = sparkCrankDeg(c, 0.3);
      const psi = mod(crank - SPEC.engine.firingAngleDeg[c], 720);
      expect(gasState(psi, 0.3).flash).toBe(1);
      expect(gasState(psi - 0.01, 0.3).flash).toBe(0);
    }
  });

  it('poseFromState with the engine stopped has no flash', () => {
    const base = poseAt({});
    const state = {
      thetaInput: 0.3, thetaMain: 0, thetaCrank: rad(sparkCrankDeg(0)) , engine: { running: false, throttleEff: 0.3 },
      synchro: { ringIndex: { ring1: 0, ring2: 0, ring3: 0, ring4: 0, ring5: 0 }, ringPush: { ring1: 0, ring2: 0, ring3: 0, ring4: 0, ring5: 0 } },
      clutchPedal: 0, rails: { s12: 0, s34: 0, s5: 0 }, lever: { col: 0, row: 0 }, flow: [],
    };
    const p = poseFromState(state);
    expect(p.cylinders).toHaveLength(4);
    for (const c of p.cylinders) { expect(c.flash).toBe(0); expect(c.spark).toBe(false); }
    state.engine.running = true;
    expect(poseFromState(state).cylinders[0].flash).toBe(1);
    expect(base.cylinders[0]).toHaveProperty('flash');
  });
});
