// INTEGRATION 2/3: whole assembly, every gear engaged, one output revolution each.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { poseAt, poseForGear } from '../../src/kin/pose.js';
import { createRig, GEARBOX } from './_assembly.js';

let rig;
beforeAll(() => { rig = createRig('gears'); });
afterAll(() => rig.save());

describe('gearbox in the full assembly', () => {
  for (const g of ['N', '1', '2', '3', '4', '5', 'R']) {
    it(`gear ${g}: one output revolution, no collisions`, () => {
      const poses = [];
      for (let i = 0; i < 30; i++) {
        const main = (i / 30) * 2 * Math.PI;
        poses.push({ label: `gear ${g} main ${i * 12}°`, pose: g === 'N' ? poseAt({ crank: main * 2.3, main }) : poseForGear(g, { main }) });
      }
      const { res, message } = rig.run(`gear ${g}`, poses, { only: (a, b) => GEARBOX.test(a) || GEARBOX.test(b) });
      expect(res.collisions.size, message).toBe(0);
    });
  }
});
