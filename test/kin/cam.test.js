import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive, rad } from '../../src/kin/derive.js';
import * as C from '../../src/kin/cam.js';

const D = derive();
const fa = SPEC.engine.firingAngleDeg;
const lift = (kind, cyl, psi) => C.camLift(kind, cyl, rad(psi + fa[cyl]));

describe('cam timing', () => {
  it('camAngle = crank/2', () => { expect(C.camAngle(2.4)).toBeCloseTo(1.2, 12); });
  it('lift windows for every cylinder', () => {
    for (let cyl = 0; cyl < 4; cyl++) {
      for (let psi = 0; psi < 720; psi++) {
        const li = lift('in', cyl, psi) > 1e-9, le = lift('ex', cyl, psi) > 1e-9;
        expect(li).toBe(psi > 350 && psi < 598);
        expect(le).toBe(psi > 122 && psi < 370);
        if (psi >= 600 || psi <= 120) {
          expect(C.valveLift('in', cyl, rad(psi + fa[cyl]))).toBe(0);
          expect(C.valveLift('ex', cyl, rad(psi + fa[cyl]))).toBe(0);
        }
      }
    }
  });
  it('overlap is exactly 20 deg at gas-exchange TDC', () => {
    const both = [];
    for (let psi = 0; psi < 720; psi++) if (lift('in', 0, psi) > 1e-9 && lift('ex', 0, psi) > 1e-9) both.push(psi);
    expect(both[0]).toBe(351); expect(both[both.length - 1]).toBe(369);
  });
  it('peak lifts 8.56/8.31 at psi 474/246', () => {
    expect(lift('in', 0, 474)).toBeCloseTo(8.56, 6);
    expect(lift('ex', 0, 246)).toBeCloseTo(8.31, 6);
    let m = 0, at = 0;
    for (let p = 0; p < 720; p += 0.5) { const l = lift('in', 2, p); if (l > m) { m = l; at = p; } }
    expect(at).toBeCloseTo(474, 0);
  });
  it('valveLift subtracts lash', () => {
    expect(C.valveLift('in', 0, rad(474 + fa[0]))).toBeCloseTo(8.56 - SPEC.engine.valvetrain.lash, 6);
  });
});

describe('lift law', () => {
  const H = D.valve.in.halfDurationCam, { f1, f3 } = SPEC.engine.valvetrain.profile;
  it('is C1 continuous and reaches Lmax', () => {
    expect(C.liftLaw(H, H, 8.56, f1, f3).s).toBeCloseTo(8.56, 9);
    expect(C.liftLaw(H, H, 8.56, f1, f3).ds).toBeCloseTo(0, 9);
    const a = C.liftLaw(f1 * H - 1e-9, H, 8.56, f1, f3), b = C.liftLaw(f1 * H + 1e-9, H, 8.56, f1, f3);
    expect(a.ds).toBeCloseTo(b.ds, 6);
    expect(C.liftLaw(-1, H, 8.56, f1, f3).s).toBe(0);
  });
});

// SPEC PROBLEM (reported to lead): with baseCircleRadius 14 and profile f1 .15 / f3 .62 the flat-follower lobe is
// CONCAVE on the start of the deceleration flank (rb + s + d2s = -0.92 mm intake, -0.49 mm exhaust at tau = t1+t2).
// The required checks below are kept strict and marked it.fails (they currently fail by design of the spec numbers).
// Fixes: baseCircleRadius >= 16.5 (intake) / 16 (exhaust), or a gentler law.
describe('lobes', () => {
  for (const kind of ['in', 'ex']) {
    it(`${kind}: minCurvatureRadius > 1.5`, () => {
      expect(C.lobeChecks(kind).minCurvatureRadius).toBeGreaterThan(1.5);
    });
    it(`${kind}: maxContactOffset < bucketDiameter/2 - 0.5`, () => {
      expect(C.lobeChecks(kind).maxContactOffset).toBeLessThan(SPEC.engine.valvetrain.bucketDiameter / 2 - 0.5);
    });
    it(`${kind}: outline is the envelope of the follower plane`, () => {
      const rb = SPEC.engine.valvetrain.baseCircleRadius;
      const pts = C.lobeOutline(kind, 0, 2000);
      for (let k = 0; k < 360; k++) {
        const phi = rad(k + 0.37), u = [Math.cos(phi), Math.sin(phi)];
        let mx = -Infinity;
        for (const p of pts) mx = Math.max(mx, p[0] * u[0] + p[1] * u[1]);
        expect(Math.abs(mx - rb - C.lobeLift(kind, 0, phi).s)).toBeLessThan(0.01);
      }
    });
    it(`${kind}: outline is convex`, () => {
      const o = C.lobeOutline(kind, 1, 240);
      expect(o.length).toBe(240);
      let sign = 0;
      for (let i = 0; i < o.length; i++) {
        const a = o[i], b = o[(i + 1) % o.length], c = o[(i + 2) % o.length];
        const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if (Math.abs(cr) < 1e-9) continue;
        if (sign === 0) sign = Math.sign(cr);
        expect(Math.sign(cr)).toBe(sign);
      }
    });
  }
});
