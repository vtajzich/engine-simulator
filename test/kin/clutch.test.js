import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import * as K from '../../src/kin/clutch.js';

describe('clutch release kinematics', () => {
  it('pedal 0 is engaged', () => {
    const r = K.releaseKin(0);
    expect(r.bearingTravel).toBe(0); expect(r.tipTravel).toBe(0); expect(r.fingerAngle).toBe(0);
    expect(r.plateLift).toBe(0); expect(r.discShift).toBe(0); expect(r.capacity).toBe(1);
  });
  it('pedal 1 is released', () => {
    const r = K.releaseKin(1);
    expect(r.plateLift).toBeCloseTo(1.8, 2);
    expect(r.capacity).toBe(0);
    expect(r.bearingTravel).toBeGreaterThan(8); expect(r.bearingTravel).toBeLessThan(11);
    expect(r.discShift).toBeCloseTo(r.plateLift / 2, 12);
  });
  it('free play, monotonic, direction of motion', () => {
    let prev = K.releaseKin(0);
    const fp = SPEC.clutch.releaseBearing.freePlay;
    for (let i = 1; i <= 100; i++) {
      const p = i / 100, r = K.releaseKin(p);
      if (r.bearingTravel <= fp) expect(r.plateLift).toBe(0);
      expect(r.bearingTravel).toBeGreaterThanOrEqual(prev.bearingTravel);
      expect(r.plateLift).toBeGreaterThanOrEqual(prev.plateLift);
      expect(r.capacity).toBeLessThanOrEqual(prev.capacity);
      prev = r;
    }
    const st = K.clutchStack(SPEC), r = K.releaseKin(1);
    const T = K.fingerPoint(st.T, r.fingerAngle), O = K.fingerPoint(st.O, r.fingerAngle);
    expect(T.x).toBeLessThan(st.T.x); expect(O.x).toBeGreaterThan(st.O.x);
    expect(K.fingerPoint(st.F, r.fingerAngle).x).toBeCloseTo(st.F.x, 12);
  });
  it('stack and bearing face', () => {
    const st = K.clutchStack(SPEC);
    expect(st.ridgeX).toBeGreaterThan(st.plateRearX);
    expect(K.bearingFaceX(0)).toBeCloseTo(st.T.x + SPEC.clutch.diaphragm.thickness / 2 + 1.5, 9);
    expect(K.bearingFaceX(1)).toBeLessThan(K.bearingFaceX(0));
  });
});
