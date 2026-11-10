import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive, rad } from '../../src/kin/derive.js';
import { throwAngle, pistonCrownY } from '../../src/kin/engine.js';
import { poseAt } from '../../src/kin/pose.js';
import {
  collectBodies, sweep, formatCollisions, bodiesIntersect, bodiesIntersectDisplaced, clearanceAlong,
  snapshotRigidity, rigidityViolations,
} from '../../verify/collide.js';
import { buildBottomEnd } from '../../src/model/bottomEnd.js';

const D = derive();
const E = SPEC.engine;
const t0 = performance.now();
const mod = buildBottomEnd();
const buildMs = performance.now() - t0;
const root = new THREE.Group();
root.add(mod.group);
const assembly = { root, update(p) { mod.update(p); root.updateMatrixWorld(true); } };
assembly.update(poseAt({}));
const bodies = collectBodies(root);

const BODY_NAMES = ['block', 'crank', 'piston1', 'piston2', 'piston3', 'piston4', 'rod1', 'rod2', 'rod3', 'rod4'];
const X = new THREE.Vector3(1, 0, 0);
const poses = [];
for (let d = 0; d < 720; d += 2) poses.push({ label: `${d}deg`, pose: poseAt({ crank: rad(d) }) });
const part = id => { let f = null; root.traverse(o => { if (o.userData.part?.id === id) f = o; }); return f; };

describe('B1 bottom end', () => {
  it('has exactly the bodies of design.md section 3, every mesh attributed', () => {
    expect([...bodies.keys()].sort()).toEqual([...BODY_NAMES].sort());
    root.traverse(o => {
      if (!o.isMesh) return;
      let p = o, found = null;
      while (p) { if (p.userData.part) { found = p.userData.part; break; } p = p.parent; }
      expect(found, 'mesh without part').toBeTruthy();
      expect(BODY_NAMES).toContain(found.body);
      expect(o.userData.noCollide).not.toBe(true);
      if (found.body === 'block') expect(o.userData.housing).toBe(true);
    });
    expect(bodies.get('block').static).toBe(true);
  });

  it('1: zero collisions over crank 0..720 deg in 2 deg steps', () => {
    const res = sweep(assembly, bodies, poses);
    expect(res.samples).toBe(360);
    expect(res.collisions.size, formatCollisions(res)).toBe(0);
  });

  it('2: rigidity over the sweep', () => {
    assembly.update(poseAt({}));
    const snap = snapshotRigidity(root);
    for (const { label, pose } of poses) {
      assembly.update(pose);
      expect(rigidityViolations(root, snap), label).toEqual([]);
    }
  });

  it('3: geometric invariants at 24 angles', () => {
    const crank = part('crankshaft');
    const v = new THREE.Vector3(), w = new THREE.Vector3(), big = new THREE.Vector3();
    for (let k = 0; k < 24; k++) {
      const c = rad(k * 15 + 3.7);
      assembly.update(poseAt({ crank: c }));
      for (let i = 0; i < 4; i++) {
        const a = throwAngle(c, i);
        const pinLocal = new THREE.Vector3(D.cylX[i], D.r * Math.cos(D.throwPhase[i]), D.r * Math.sin(D.throwPhase[i]));
        const pin = pinLocal.applyMatrix4(crank.matrixWorld);
        const rod = part(`rod${i + 1}`);
        v.setFromMatrixPosition(rod.matrixWorld);
        expect(v.distanceTo(pin)).toBeCloseTo(D.L, 6);
        expect(Math.abs(v.distanceTo(pin) - D.L)).toBeLessThan(1e-6);
        big.set(0, -D.L, 0).applyMatrix4(rod.matrixWorld);       // big-end centre sits on the crankpin
        expect(big.distanceTo(pin)).toBeLessThan(1e-6);
        const box = new THREE.Box3().setFromObject(part(`piston${i + 1}`).children[0]);
        expect(Math.abs(box.max.y - pistonCrownY(a))).toBeLessThan(1e-4);   // float32 mesh bounds
        w.setFromMatrixPosition(part(`piston${i + 1}`).matrixWorld);
        expect(Math.abs(w.y + E.compressionHeight - pistonCrownY(a))).toBeLessThan(1e-9);
        w.setFromMatrixPosition(part(`piston${i + 1}`).matrixWorld);
        expect(Math.abs(w.x - D.cylX[i]) + Math.abs(w.z)).toBeLessThan(1e-9);
      }
    }
    assembly.update(poseAt({ crank: 0 }));
    const crown = i => new THREE.Box3().setFromObject(part(`piston${i}`).children[0]).max.y;
    // mesh bounding boxes are float32: 1e-4 tolerance
    expect(crown(1)).toBeCloseTo(214.8, 4);
    expect(crown(4)).toBeCloseTo(214.8, 4);
    expect(crown(2)).toBeCloseTo(D.L - D.r + E.compressionHeight, 4);   // BDC
    expect(crown(3)).toBeCloseTo(crown(2), 9);
  });

  it('4: clearances', () => {
    assembly.update(poseAt({ crank: 0 }));
    const side = clearanceAlong(bodies, 'piston1', 'block', new THREE.Vector3(0, 0, 1), { max: 2, step: 0.05, tol: 0.001 });
    const sideNeg = clearanceAlong(bodies, 'piston1', 'block', new THREE.Vector3(0, 0, -1), { max: 2, step: 0.05, tol: 0.001 });
    let minCw = Infinity, atDeg = 0;
    for (let d = 0; d < 360; d += 3) {
      assembly.update(poseAt({ crank: rad(d) }));
      const g = clearanceAlong(bodies, 'piston1', 'crank', new THREE.Vector3(0, -1, 0), { max: 40, step: 0.5, tol: 0.02 });
      if (g < minCw) { minCw = g; atDeg = d; }
    }
    console.log(['clearance table (mm)',
      `  piston1 -> block (+Z): ${side.toFixed(3)}   (-Z): ${sideNeg.toFixed(3)}`,
      `  piston1 -> crank probing -Y, minimum over sweep: ${minCw.toFixed(2)} at crank ${atDeg} deg`].join('\n'));
    expect(side).toBeGreaterThanOrEqual(0.15);
    expect(side).toBeLessThanOrEqual(0.35);
    expect(sideNeg).toBeGreaterThanOrEqual(0.15);
    expect(sideNeg).toBeLessThanOrEqual(0.35);
    expect(minCw).toBeGreaterThan(2);
  });

  it('running fits: touching-pair two-sided checks (nominal free, 0.3 mm displaced intersects)', () => {
    assembly.update(poseAt({ crank: 0 }));       // pins 1&4 up, rods vertical
    const up = { offset: new THREE.Vector3(0, 0.3, 0) };
    // crankpin in rod big-end bore (0.2 gap)
    expect(bodiesIntersect(bodies, 'crank', 'rod1')).toBe(false);
    expect(bodiesIntersectDisplaced(bodies, 'crank', 'rod1', up)).toBe(true);
    // piston pin in rod small-end bore (0.2 gap)
    expect(bodiesIntersect(bodies, 'piston1', 'rod1')).toBe(false);
    expect(bodiesIntersectDisplaced(bodies, 'piston1', 'rod1', up)).toBe(true);
    // main journals in bulkhead bores (0.2 gap)
    expect(bodiesIntersect(bodies, 'crank', 'block')).toBe(false);
    expect(bodiesIntersectDisplaced(bodies, 'crank', 'block', up)).toBe(true);
    // rod big end 0.5 mm side clearance to the webs
    expect(bodiesIntersectDisplaced(bodies, 'rod1', 'crank', { offset: new THREE.Vector3(0.3, 0, 0) })).toBe(false);
    expect(bodiesIntersectDisplaced(bodies, 'rod1', 'crank', { offset: new THREE.Vector3(0.6, 0, 0) })).toBe(true);
    // crank webs 1 mm from the thick part of the bulkheads
    expect(bodiesIntersectDisplaced(bodies, 'crank', 'block', { offset: new THREE.Vector3(1.5, 0, 0) })).toBe(true);
  });

  it('5: negative controls (the detector fires)', () => {
    assembly.update(poseAt({ crank: 0 }));
    expect(bodiesIntersectDisplaced(bodies, 'piston1', 'block', { offset: new THREE.Vector3(0, 0, 0.5) })).toBe(true);
    expect(bodiesIntersectDisplaced(bodies, 'crank', 'rod1',
      { angle: rad(15), axisDir: X, axisPoint: new THREE.Vector3(0, 0, 0) })).toBe(true);
    const off = { offset: new THREE.Vector3(1.5, 0, 0) };
    expect(bodiesIntersectDisplaced(bodies, 'rod1', 'crank', off) || bodiesIntersectDisplaced(bodies, 'rod1', 'piston1', off)).toBe(true);
  });

  it('6: triangle counts and build time', () => {
    let total = 0;
    const lines = [];
    for (const [name, b] of bodies) { lines.push(`  ${name}: ${b.triangleCount}`); total += b.triangleCount; }
    console.log(`triangles per body:\n${lines.join('\n')}\n  total: ${total}; build ${buildMs.toFixed(0)} ms`);
    expect(total).toBeLessThan(250000);
    expect(buildMs).toBeLessThan(4000);
  });
});
