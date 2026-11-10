// INTEGRATION 1/3: whole assembly, all bodies against all bodies — structure, engine cycle, interference proof, clutch.
import * as THREE from 'three';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive, rad } from '../../src/kin/derive.js';
import { poseAt, poseForGear } from '../../src/kin/pose.js';
import { bodiesIntersect, clearanceAlong, rigidityViolations } from '../../verify/collide.js';
import { createRig } from './_assembly.js';

const D = derive();
let rig;
beforeAll(() => { rig = createRig('engine'); });
afterAll(() => rig.save());

const EXPECTED_BODIES = [
  'block', 'head', 'crank', 'camIn', 'camEx', 'bellhousing', 'gearCase',
  ...[1, 2, 3, 4].flatMap(n => [`piston${n}`, `rod${n}`, `valveIn${n}a`, `valveIn${n}b`, `valveEx${n}a`, `valveEx${n}b`]),
  'pressurePlate', 'clutchDisc', 'releaseBearing', 'releaseFork',
  ...Array.from({ length: SPEC.clutch.diaphragm.fingers }, (_, i) => `finger${String(i + 1).padStart(2, '0')}`),
  'inputShaft', 'counterShaft', 'mainShaft', 'gear1', 'gear2', 'gear3', 'gear5', 'idlerR',
  'sleeve12', 'sleeve34', 'sleeve5', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5',
  'fork12', 'fork34', 'fork5', 'shiftLever',
];

describe('assembly structure', () => {
  it('contains every body of the design contract and nothing unknown', () => {
    const { bodies } = rig;
    const missing = EXPECTED_BODIES.filter(n => !bodies.has(n) || !bodies.get(n).bvh);
    expect(missing, `missing or empty bodies: ${missing.join(', ')}`).toEqual([]);
    const unknown = [...bodies.keys()].filter(n => !EXPECTED_BODIES.includes(n) && bodies.get(n).bvh);
    expect(unknown, `unexpected collidable bodies: ${unknown.join(', ')}`).toEqual([]);
  });
  it('static housings are flagged static, moving parts are not', () => {
    for (const s of ['block', 'head', 'bellhousing', 'gearCase']) expect(rig.bodies.get(s).static, s).toBe(true);
    for (const m of ['crank', 'piston1', 'valveIn1a', 'gear1', 'sleeve12', 'finger01']) expect(rig.bodies.get(m).static, m).toBeFalsy();
  });
});

describe('engine in the full assembly', () => {
  it('four-stroke cycle 0–720° in 3° steps: no collisions between any two bodies', () => {
    const poses = [];
    for (let d = 0; d < 720; d += 3) poses.push({ label: `crank ${d}°`, pose: poseAt({ crank: rad(d) }) });
    const { res, message } = rig.run('engine 0-720', poses);
    expect(res.collisions.size, message).toBe(0);
  });

  it('piston-to-valve clearance stays positive and is reported', () => {
    let min = { mm: Infinity };
    for (const [kind, key] of [['in', 'valveIn1a'], ['ex', 'valveEx1a']]) {
      const ax = D.valve[kind].axis;
      const dir = new THREE.Vector3(-ax[0], -ax[1], -ax[2]);
      for (let d = 300; d <= 420; d += 4) {
        rig.assembly.update(poseAt({ crank: rad(d) }));
        const c = clearanceAlong(rig.bodies, key, 'piston1', dir, { max: 12, step: 0.25, tol: 0.02 });
        if (c < min.mm) min = { mm: +c.toFixed(2), valve: key, crankDeg: d };
      }
    }
    rig.report.clearances.pistonToValveMin = min;
    expect(min.mm).toBeGreaterThan(1.0);
  });

  it('NEGATIVE CONTROL — interference engine: valve timing 114° late puts an open intake valve into the piston at TDC', () => {
    rig.assembly.modules.bottomEnd.update(poseAt({ crank: rad(360) }));   // cylinder 1 at gas-exchange TDC
    rig.assembly.modules.topEnd.update(poseAt({ crank: rad(474) }));      // valvetrain as at max intake lift
    rig.assembly.root.updateMatrixWorld(true);
    const hit = bodiesIntersect(rig.bodies, 'piston1', 'valveIn1a') || bodiesIntersect(rig.bodies, 'piston1', 'valveIn1b');
    rig.assembly.update(poseAt({}));
    expect(hit).toBe(true);
  });
});

describe('clutch in the full assembly', () => {
  it('pedal sweep with engine and input shaft turning: no collisions', () => {
    const poses = [];
    for (let i = 0; i <= 20; i++) {
      const pedal = i / 20;
      poses.push({ label: `pedal ${pedal.toFixed(2)}`, pose: poseAt({ crank: 0.31 * i, input: 0.17 * i, clutchPedal: pedal }) });
    }
    const { res, message } = rig.run('clutch pedal', poses);
    expect(res.collisions.size, message).toBe(0);
  });
});

describe('rigidity', () => {
  it('parts that share a body never move relative to each other', () => {
    rig.assembly.update(poseForGear('3', { main: 1.234, clutchPedal: 0.7 }));
    const v = rigidityViolations(rig.assembly.root, rig.rigid);
    expect(v, JSON.stringify(v)).toEqual([]);
  });
});
