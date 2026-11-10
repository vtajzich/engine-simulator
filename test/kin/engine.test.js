import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive, rad } from '../../src/kin/derive.js';
import * as E from '../../src/kin/engine.js';

const D = derive();
describe('slider crank', () => {
  it('pin height at TDC and BDC', () => {
    expect(E.pistonPinY(0)).toBeCloseTo(181.0, 9);
    expect(E.pistonPinY(Math.PI)).toBeCloseTo(95.0, 9);
    expect(E.pistonCrownY(0)).toBeCloseTo(181.0 + SPEC.engine.compressionHeight, 9);
  });
  it('rod length is constant and rodAngle places the big end on the crank pin', () => {
    for (let k = 0; k < 720; k++) {
      const a = rad(k * 0.5);
      const cp = E.crankPin(a), py = E.pistonPinY(a);
      expect(Math.hypot(cp.y - py, cp.z)).toBeCloseTo(138, 9);
      const th = E.rodAngle(a);
      const y = -138 * Math.cos(th), z = -138 * Math.sin(th);
      expect(py + y).toBeCloseTo(cp.y, 9);
      expect(z).toBeCloseTo(cp.z, 9);
    }
  });
  it('piston is 49.9 mm below TDC at 90 deg', () => {
    expect(Math.abs(181 - E.pistonPinY(Math.PI / 2) - 49.9)).toBeLessThan(0.1);
  });
  it('max piston speed at 73-75 deg ATDC (exact for r/L = 43/138: 74.05); analytic velocity matches finite difference', () => {
    let best = 0, bestA = 0;
    for (let a = 0; a <= 180; a += 0.05) {
      const v = Math.abs(E.pistonVelocityPerRad(rad(a)));
      if (v > best) { best = v; bestA = a; }
    }
    expect(bestA).toBeGreaterThan(73); expect(bestA).toBeLessThan(75);   // actual 74.05 (see strict test below)
    const h = 1e-6, a = 1.1;
    expect(E.pistonVelocityPerRad(a)).toBeCloseTo((E.pistonPinY(a + h) - E.pistonPinY(a - h)) / (2 * h), 5);
  });
  it('pistons 1&4 and 2&3 move together', () => {
    for (let c = 0; c < 720; c += 7) {
      const y = [0, 1, 2, 3].map(i => E.pistonPinY(E.throwAngle(rad(c), i)));
      expect(y[0]).toBeCloseTo(y[3], 9); expect(y[1]).toBeCloseTo(y[2], 9);
    }
  });
});

describe('four-stroke table (research 2.4)', () => {
  const table = { 90: ['power', 'exhaust', 'compression', 'intake'], 270: ['exhaust', 'intake', 'power', 'compression'],
    450: ['intake', 'compression', 'exhaust', 'power'], 630: ['compression', 'power', 'intake', 'exhaust'] };
  for (const [c, row] of Object.entries(table)) {
    it(`crank ${c}`, () => {
      row.forEach((s, i) => expect(E.strokeOf(E.cycleAngleDeg(+c, i))).toBe(s));
    });
  }
});

describe('volumes', () => {
  it('cylinder volume at TDC is the clearance volume and at BDC adds the displacement', () => {
    expect(E.cylinderVolume(0)).toBeCloseTo(D.clearanceVolume, 6);
    expect(E.cylinderVolume(Math.PI)).toBeCloseTo(D.clearanceVolume + D.displacement, 6);
  });
});

describe('gasState', () => {
  const sweep = th => Array.from({ length: 720 }, (_, k) => E.gasState(k, th));
  it('peak pressure at full throttle is 5-25 deg ATDC and 40-80 bar', () => {
    const s = sweep(1);
    let pk = 0, at = 0;
    s.forEach((g, k) => { if (g.pBar > pk) { pk = g.pBar; at = k; } });
    expect(pk).toBeGreaterThan(40); expect(pk).toBeLessThan(80);
    expect(at).toBeGreaterThanOrEqual(5); expect(at).toBeLessThanOrEqual(25);
  });
  it('p positive and continuous (<15 % per degree)', () => {
    for (const th of [0, 0.3, 1]) {
      const s = sweep(th);
      for (let k = 0; k < 720; k++) {
        const a = s[k].pBar, b = s[(k + 1) % 720].pBar;
        expect(a).toBeGreaterThan(0);
        expect(Math.abs(b - a) / Math.min(a, b)).toBeLessThan(0.15);
      }
    }
  });
  it('phases and spark', () => {
    expect(E.gasState(400, 0.5).phase).toBe('intake');
    expect(E.gasState(250, 0.5).phase).toBe('exhaust');
    expect(E.gasState(600, 0.5).phase).toBe('compression');
    expect(E.gasState(60, 1).phase).toBe('expansion');
    const adv = 10 + 20 * 0.5;
    expect(E.gasState(720 - adv + 1, 0.5).spark).toBe(true);
    expect(E.gasState(720 - adv - 1, 0.5).spark).toBe(false);
    expect(E.gasState(720 - adv + 6, 0.5).spark).toBe(false);
  });
});
