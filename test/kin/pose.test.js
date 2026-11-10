import { describe, it, expect } from 'vitest';
import { derive, wrapTo } from '../../src/kin/derive.js';
import { poseAt, poseForGear, poseFromState } from '../../src/kin/pose.js';
import { misalign } from '../../src/kin/synchro.js';
import { gearForSleeve, shaftAngles } from '../../src/kin/gears.js';

const D = derive();
describe('pose', () => {
  it('poseAt defaults are complete', () => {
    const p = poseAt({ crank: 1 });
    expect(p.camIn).toBeCloseTo(0.5, 12); expect(p.camEx).toBeCloseTo(0.5, 12);
    expect(p.input).toBe(1);
    expect(p.cylinders).toHaveLength(4);
    expect(Object.keys(p.rings)).toEqual(['ring1', 'ring2', 'ring3', 'ring4', 'ring5']);
    expect(p.rings.ring1.angle).toBeCloseTo(D.synchro.pitchAngle / 2, 12);
    expect(p.flow).toBeInstanceOf(Set);
    expect(p.sleeves).toEqual({ s12: 0, s34: 0, s5: 0 });
  });
  it('forward gears align the engaged gear', () => {
    for (const g of ['1', '2', '3', '4', '5']) {
      for (const main of [0, 0.7, -2.2]) {
        const p = poseForGear(g, { main });
        const name = g === '4' ? 'input' : 'g' + g;
        const ang = name === 'input' ? p.input : p.gears[name];
        expect(misalign(ang, p.main)).toBeLessThan(1e-6);
        expect(p.crank).toBe(p.input);
      }
    }
  });
  it('sleeves pick the right gear', () => {
    expect(poseForGear('1').sleeves.s12).toBe(9.5); expect(poseForGear('2').sleeves.s12).toBe(-9.5);
    expect(poseForGear('3').sleeves.s34).toBe(9.5); expect(poseForGear('4').sleeves.s34).toBe(-9.5);
    expect(poseForGear('5').sleeves.s5).toBe(9.5);
    expect(poseForGear('N').lever).toEqual({ col: 0, row: 0 });
    expect(poseForGear('1').lever).toEqual({ col: -1, row: 1 });
    expect(gearForSleeve.s5['1']).toBe('g5');
  });
  it('reverse meshes the idler with the fixed reverse gear', () => {
    for (const main of [0, 1.3]) {
      const p = poseForGear('R', { main });
      expect(p.idlerX).toBe(-9.5); expect(p.sleeves.s5).toBe(-9.5);
      const req = shaftAngles({ input: p.input, main }).revMainRequired;
      expect(Math.abs(wrapTo(p.main - req, 2 * Math.PI / 50))).toBeLessThan(1e-9);
    }
  });
  it('poseFromState is a TODO for A2', () => { expect(() => poseFromState({})).toThrow(); });
});
