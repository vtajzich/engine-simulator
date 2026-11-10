import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { poseAt, poseForGear } from '../../src/kin/pose.js';
import {
  collectBodies, sweep, formatCollisions, bodiesIntersect, bodiesIntersectDisplaced, snapshotRigidity, rigidityViolations,
} from '../../verify/collide.js';
import { buildShift } from '../../src/model/shift.js';
import { buildGearbox } from '../../src/model/gearbox.js';

const SH = SPEC.gearbox.shift, TRAVEL = SH.railTravel, W = SPEC.gearbox.walls;
const t0 = performance.now();
const shift = buildShift();
const buildMs = performance.now() - t0;
const gearbox = buildGearbox();           // may still be an empty stub
const root = new THREE.Group();
root.add(gearbox.group, shift.group);

// rigidity is checked on every pose that goes through assembly.update
let snap = null;
const violations = [];
const assembly = {
  root,
  update(p) {
    gearbox.update(p); shift.update(p); root.updateMatrixWorld(true);
    if (snap) violations.push(...rigidityViolations(root, snap));
  },
};
assembly.update(poseAt({}));
const bodies = collectBodies(root);
snap = snapshotRigidity(root);

const MINE = new Set(['gearCase', 'fork12', 'fork34', 'fork5', 'shiftLever']);
const hasGearbox = bodies.has('sleeve12');
const onlyMine = (a, b) => MINE.has(a) && MINE.has(b);
const involvesMine = (a, b) => MINE.has(a) || MINE.has(b);
const V = (x, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const run = (poses, only) => { const r = sweep(assembly, bodies, poses, { only }); return r; };
const expectClean = (r) => expect(r.collisions.size, formatCollisions(r)).toBe(0);

const GEARS = ['N', '1', '2', '3', '4', '5', 'R'];
const colOf = { s12: -1, s34: 0, s5: 1 };

describe('shift mechanism + gear case', () => {
  it('module sanity: bodies present, triangle budget, build time', () => {
    for (const n of MINE) expect(bodies.has(n), n).toBe(true);
    const counts = Object.fromEntries([...MINE].map(n => [n, bodies.get(n).triangleCount]));
    console.log('shift triangles', JSON.stringify(counts), 'total', shift.triangles, `build ${buildMs.toFixed(0)} ms`,
      hasGearbox ? '(real gearbox present)' : '(gearbox stub)');
    expect(shift.triangles).toBeLessThan(150000);
    expect(buildMs).toBeLessThan(4000);
  });

  it('1: every gear, main shaft 0…2π in 24 steps: no collisions (own bodies and gearbox)', () => {
    const poses = [];
    for (const g of GEARS) for (let i = 0; i < 24; i++) poses.push({ label: `gear ${g} m=${i}/24`, pose: poseForGear(g, { main: i / 24 * 2 * Math.PI }) });
    expectClean(run(poses, involvesMine));
  }, 300000);

  it('2: rail travel sweeps ±9.5 mm with the lever following (own bodies)', () => {
    for (const s of ['s12', 's34', 's5']) {
      const poses = [];
      for (let k = -19; k <= 19; k++) {
        const x = k * 0.5;
        poses.push({ label: `${s} x=${x}`, pose: poseAt({ sleeves: { [s]: x }, lever: { col: colOf[s], row: x / TRAVEL } }) });
      }
      expectClean(run(poses, onlyMine));
    }
  });

  it.skipIf(!hasGearbox)('2b: small rail travel (±0.4 mm) against the real gearbox bodies', () => {
    for (const s of ['s12', 's34', 's5']) {
      const poses = [];
      for (let k = -4; k <= 4; k++) {
        const x = k * 0.1;
        poses.push({ label: `${s} x=${x}`, pose: poseAt({ main: 0.3, sleeves: { [s]: x }, lever: { col: colOf[s], row: x / TRAVEL } }) });
      }
      expectClean(run(poses, involvesMine));
    }
  }, 300000);

  it('3: cross-gate sweep in neutral, col −1…1 in 20 steps', () => {
    const poses = [];
    for (let i = 0; i <= 20; i++) { const col = -1 + 2 * i / 20; poses.push({ label: `col=${col.toFixed(2)}`, pose: poseAt({ lever: { col, row: 0 } }) }); }
    expectClean(run(poses, involvesMine));
  }, 300000);

  it('4: lever finger ball lands in the selected slot for all seven gate positions', () => {
    const ball = shift.group.getObjectByName('fingerBall');
    const wp = new THREE.Vector3();
    for (const g of GEARS) {
      const p = poseForGear(g);
      assembly.update(p);
      ball.getWorldPosition(wp);
      const [col] = SH.gate[g];
      const s = ['s12', 's34', 's5'][col + 1];
      expect(Math.abs(wp.x - (SH.leverPivot[0] + p.sleeves[s])), `${g} x`).toBeLessThan(0.05);
      expect(Math.abs(wp.z - 13 * col), `${g} z`).toBeLessThan(0.05);
      expect(wp.y, `${g} y`).toBeGreaterThan(SH.railY + SPEC.gearbox.shift.railDiameter / 2 + 5);   // ball above the rail tops
    }
    // knob moves the way the H pattern says: gate 1 (col −1) → knob to +Z, row +1 → knob forward (−X)
    const knob = shift.group.getObjectByName('knob'), kp = new THREE.Vector3();
    assembly.update(poseForGear('1')); knob.getWorldPosition(kp);
    expect(kp.z).toBeGreaterThan(20); expect(kp.x).toBeLessThan(SH.leverKnob[0] - 20);
    assembly.update(poseAt({})); knob.getWorldPosition(kp);
    expect(kp.x).toBeCloseTo(SH.leverKnob[0], 3); expect(kp.y).toBeCloseTo(SH.leverKnob[1], 3);
  });

  it('4b: rigidity over everything swept so far', () => {
    expect(violations).toEqual([]);
    expect(rigidityViolations(root, snap)).toEqual([]);
  });

  it('rails stay in all three wall bores over ±travel and behind the clutch cover', () => {
    for (const n of ['fork12', 'fork34', 'fork5']) {
      const b = bodies.get(n).localBox;
      expect(b.min.x - TRAVEL, n).toBeGreaterThan(SPEC.clutch.cover.rearX + 7);
      expect(b.min.x + TRAVEL, n).toBeLessThan(W.front[1] - 10);           // still ≥ 10 mm into the front wall
      expect(b.max.x - TRAVEL, n).toBeGreaterThan(W.rear[0] + 10);         // still ≥ 10 mm into the rear wall
    }
  });

  it.skipIf(!hasGearbox)('5: fork pads sit in the sleeve grooves (two-sided) and idler prongs straddle the idler', () => {
    assembly.update(poseAt({}));
    for (const [f, s] of [['fork12', 'sleeve12'], ['fork34', 'sleeve34'], ['fork5', 'sleeve5']]) {
      expect(bodiesIntersect(bodies, f, s), `${f} nominal`).toBe(false);
      for (const d of [-0.5, 0.5]) expect(bodiesIntersectDisplaced(bodies, f, s, { offset: V(d) }), `${f} ${d}`).toBe(true);
      for (const d of [-0.2, 0.2]) expect(bodiesIntersectDisplaced(bodies, f, s, { offset: V(d) }), `${f} ${d} (inside clearance)`).toBe(false);
    }
    for (const g of ['N', 'R', '5']) {
      assembly.update(poseForGear(g));
      expect(bodiesIntersect(bodies, 'fork5', 'idlerR'), `idler nominal ${g}`).toBe(false);
      for (const d of [-0.6, 0.6]) expect(bodiesIntersectDisplaced(bodies, 'fork5', 'idlerR', { offset: V(d) }), `idler ${g} ${d}`).toBe(true);
    }
    assembly.update(poseAt({}));
  });

  it('5b: contacts that exist without the gearbox: rails in wall bores, finger ball in its slot', () => {
    assembly.update(poseAt({}));
    for (const f of ['fork12', 'fork34', 'fork5']) {
      expect(bodiesIntersect(bodies, f, 'gearCase')).toBe(false);
      for (const d of [-1, 1]) expect(bodiesIntersectDisplaced(bodies, f, 'gearCase', { offset: V(0, d, 0) }), `${f} y${d}`).toBe(true);
    }
    expect(bodiesIntersect(bodies, 'shiftLever', 'fork34')).toBe(false);
    for (const d of [-1, 1]) expect(bodiesIntersectDisplaced(bodies, 'shiftLever', 'fork34', { offset: V(d) }), `lever x${d}`).toBe(true);
    // lever passes the roof opening and cap with clearance, touches the case when pushed sideways
    expect(bodiesIntersect(bodies, 'shiftLever', 'gearCase')).toBe(false);
    expect(bodiesIntersectDisplaced(bodies, 'shiftLever', 'gearCase', { offset: V(0, 0, 40) })).toBe(true);
  });

  it('6: negative control — lever in gate 1 with all rails in neutral hits the 1–2 lug', () => {
    assembly.update(poseAt({ lever: { col: -1, row: 1 } }));
    expect(bodiesIntersect(bodies, 'shiftLever', 'fork12')).toBe(true);
    assembly.update(poseAt({ lever: { col: 1, row: -1 } }));
    expect(bodiesIntersect(bodies, 'shiftLever', 'fork5')).toBe(true);
    assembly.update(poseAt({ lever: { col: 0, row: 1 } }));
    expect(bodiesIntersect(bodies, 'shiftLever', 'fork34')).toBe(true);
    // positive counterpart: rails follow → no contact
    assembly.update(poseForGear('1'));
    expect(bodiesIntersect(bodies, 'shiftLever', 'fork12')).toBe(false);
    // detector also fires through the sweep
    const r = run([{ label: 'gate1 rails neutral', pose: poseAt({ lever: { col: -1, row: 1 } }) }], onlyMine);
    expect(r.collisions.has('fork12|shiftLever')).toBe(true);
    assembly.update(poseAt({}));
  });

  it('7: every collidable mesh belongs to a design.md §3 body; housing flags', () => {
    const allowed = new Set(['gearCase', 'fork12', 'fork34', 'fork5', 'shiftLever']);
    const ids = new Set();
    shift.group.traverse((o) => {
      const p = o.userData.part;
      if (p) { expect(allowed.has(p.body), p.id).toBe(true); ids.add(p.id); }
      if (o.isMesh && !o.userData.noCollide) {
        let a = o.parent, part = null;
        while (a && !part) { part = a.userData.part; a = a.parent; }
        expect(part, `mesh ${o.name}`).toBeTruthy();
        expect(allowed.has(part.body)).toBe(true);
        if (part.id === 'gearCase') expect(o.userData.housing, o.name).toBe(true);
        if (part.id === 'idlerShaft' || part.id === 'quill') expect(o.userData.housing).not.toBe(true);
      }
    });
    expect([...ids].sort()).toEqual(['fork12', 'fork34', 'fork5', 'gearCase', 'idlerShaft', 'quill', 'shiftLever']);
    expect(bodies.get('gearCase').static).toBe(true);
    // no blanket noCollide on real solids
    shift.group.traverse((o) => { if (o.isMesh) expect(o.userData.noCollide, o.name).not.toBe(true); });
  });
});
