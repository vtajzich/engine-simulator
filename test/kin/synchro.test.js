import { describe, it, expect } from 'vitest';
import { derive } from '../../src/kin/derive.js';
import * as S from '../../src/kin/synchro.js';

const { P, w, c, pitchAngle } = derive().synchro;
describe('synchro', () => {
  it('tooth geometry', () => {
    expect(c).toBeGreaterThan(0.15);
    expect(P).toBeCloseTo(34 * pitchAngle, 9);
    expect(w).toBeCloseTo(0.46 * P, 9);
  });
  it('blocking position', () => {
    expect(S.xBlock).toBeGreaterThan(1); expect(S.xBlock).toBeLessThan(3);
    expect(S.xRingTip).toBeCloseTo(0.5, 9); expect(S.xDogTip).toBeCloseTo(6, 9); expect(S.xEngaged).toBe(9.5);
    expect(S.advanceRing(S.xBlock)).toBeCloseTo(S.maxAdvance(0.25 * P), 9);
  });
  it('maxAdvance / maxMisalign are consistent', () => {
    for (let k = 1; k < 100; k++) {
      const a = (k / 100) * (P / 2 - c);
      expect(S.maxAdvance(S.maxMisalign(a))).toBeGreaterThanOrEqual(a - 1e-9);
    }
    expect(S.maxMisalign(0)).toBeCloseTo(P / 2, 9);
    expect(S.maxAdvance(0)).toBe(Infinity);
  });
  it('misalign', () => {
    expect(S.misalign(pitchAngle / 2, 0)).toBeCloseTo(0, 12);
    expect(S.misalign(0, 0)).toBeCloseTo(P / 2, 9);
    expect(S.misalign(pitchAngle / 2 + 1 * pitchAngle, 0)).toBeCloseTo(0, 9);
  });
});
