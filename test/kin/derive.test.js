import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive, wrapPi, wrapTo, mod } from '../../src/kin/derive.js';

describe('derive', () => {
  const D = derive();
  it('is memoised and frozen', () => {
    expect(derive()).toBe(D);
    expect(Object.isFrozen(D)).toBe(true);
  });
  it('helpers wrap correctly', () => {
    expect(wrapPi(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapPi(-Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapTo(0.9, 1)).toBeCloseTo(-0.1, 12);
    expect(mod(-1, 720)).toBe(719);
  });
  it('displacement is 1998 cc and compression ratio ~11', () => {
    expect(Math.abs(D.displacement * 4 / 1000 - 1998)).toBeLessThan(2);
    expect(D.compressionRatio).toBeGreaterThan(10.8);
    expect(D.compressionRatio).toBeLessThan(11.2);
  });
  it('valve events', () => {
    expect([D.valve.in.openDeg, D.valve.in.closeDeg, D.valve.in.peakDeg]).toEqual([350, 598, 474]);
    expect([D.valve.ex.openDeg, D.valve.ex.closeDeg, D.valve.ex.peakDeg]).toEqual([122, 370, 246]);
  });
  it('cam axes are above the valve seats', () => {
    for (const k of ['in', 'ex']) {
      expect(D.valve[k].camAxis.y).toBeGreaterThan(D.valve[k].seat(0, 0)[1]);
    }
    expect(D.valve.in.camAxis.z).toBeGreaterThan(0);
    expect(D.valve.ex.camAxis.z).toBeLessThan(0);
  });
  it('idler axis meshes with both gears', () => {
    const g = D.gearbox, G = g.gears, i = g.idlerAxis;
    const dc = Math.hypot(i.y - g.counterAxis.y, i.z - g.counterAxis.z);
    const dm = Math.hypot(i.y, i.z);
    expect(dc).toBeCloseTo(G['rev.counter'].r + G['rev.idler'].r, 9);
    expect(dm).toBeCloseTo(G['rev.main'].r + G['rev.idler'].r, 9);
    expect(Math.sign(i.z)).toBe(SPEC.gearbox.reverse.idlerSide);
  });
});
