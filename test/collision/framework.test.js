import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { partGroup } from '../../src/geo/parts.js';
import {
  collectBodies, snapshotRigidity, rigidityViolations, findCollisions, bodiesIntersect,
  bodiesIntersectDisplaced, clearanceAlong, sweep, formatCollisions,
} from '../../verify/collide.js';

const mat = new THREE.MeshBasicMaterial();
const boxMesh = (w, h, d) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

function part(root, id, body, mesh, pos = [0, 0, 0], extra = {}) {
  const g = partGroup(id, body, id, extra);
  g.position.set(...pos);
  if (mesh) g.add(mesh);
  root.add(g);
  return g;
}
const build = (fn) => {
  const root = new THREE.Group();
  const parts = fn(root);
  root.updateMatrixWorld(true);
  return { root, parts, bodies: collectBodies(root) };
};
const names = (cols) => cols.map((c) => `${c.a}|${c.b}`);

describe('collision framework', () => {
  it('1: separated vs overlapping boxes, alphabetical names', () => {
    const sep = build((r) => { part(r, 'p1', 'zeta', boxMesh(10, 10, 10)); part(r, 'p2', 'alpha', boxMesh(10, 10, 10), [30, 0, 0]); });
    expect(findCollisions(sep.bodies)).toEqual([]);
    const ov = build((r) => { part(r, 'p1', 'zeta', boxMesh(10, 10, 10)); part(r, 'p2', 'alpha', boxMesh(10, 10, 10), [5, 0, 0]); });
    expect(findCollisions(ov.bodies)).toEqual([{ a: 'alpha', b: 'zeta' }]);
  });

  it('2: 0.05 mm gap, displaced probe and clearance', () => {
    const { bodies } = build((r) => { part(r, 'p1', 'a', boxMesh(10, 10, 10)); part(r, 'p2', 'b', boxMesh(10, 10, 10), [10.05, 0, 0]); });
    expect(bodiesIntersect(bodies, 'a', 'b')).toBe(false);
    expect(bodiesIntersectDisplaced(bodies, 'b', 'a', { offset: new THREE.Vector3(-0.3, 0, 0) })).toBe(true);
    expect(bodiesIntersectDisplaced(bodies, 'b', 'a', { offset: new THREE.Vector3(0.3, 0, 0) })).toBe(false);
    expect(clearanceAlong(bodies, 'b', 'a', new THREE.Vector3(-1, 0, 0))).toBeCloseTo(0.05, 1);
    expect(clearanceAlong(bodies, 'b', 'a', new THREE.Vector3(1, 0, 0))).toBe(Infinity);
    // rotation about an axis through a's centre sweeps b into... nothing (stays at radius), but 90 deg about z through (10,0,0) hits
    expect(bodiesIntersectDisplaced(bodies, 'b', 'a', { angle: Math.PI / 2, axisPoint: new THREE.Vector3(5, 0, 0), axisDir: new THREE.Vector3(0, 0, 1) })).toBe(true);
  });

  it('3: rotating shaft in a tube', () => {
    const run = (rIn) => {
      const profile = [[rIn, -15], [12, -15], [12, 15], [rIn, 15], [rIn, -15]].map(([x, y]) => new THREE.Vector2(x, y));
      const { root, bodies, parts } = build((r) => {
        part(r, 'tube', 'tube', new THREE.Mesh(new THREE.LatheGeometry(profile, 48), mat), [0, 0, 0], { static: true });
        return part(r, 'shaft', 'shaft', new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 40, 48), mat));
      });
      let hits = 0;
      for (let i = 0; i < 24; i++) {
        parts.rotation.y = (i / 24) * Math.PI * 2 / 48 * 7;
        root.updateMatrixWorld(true);
        hits += findCollisions(bodies).length;
      }
      return hits;
    };
    expect(run(10.2)).toBe(0);
    expect(run(9.9)).toBe(24);
  });

  it('4: same body and static-static pairs are ignored', () => {
    const same = build((r) => { part(r, 'p1', 'one', boxMesh(10, 10, 10)); part(r, 'p2', 'one', boxMesh(10, 10, 10), [3, 0, 0]); });
    expect(findCollisions(same.bodies)).toEqual([]);
    expect(same.bodies.get('one').partIds).toEqual(['p1', 'p2']);
    const st = build((r) => { part(r, 'p1', 's1', boxMesh(10, 10, 10), [0, 0, 0], { static: true }); part(r, 'p2', 's2', boxMesh(10, 10, 10), [3, 0, 0], { static: true }); part(r, 'p3', 'dyn', boxMesh(10, 10, 10), [6, 0, 0]); });
    expect(names(findCollisions(st.bodies))).toEqual(['dyn|s1', 'dyn|s2']);
    expect(names(findCollisions(st.bodies, { ignore: (a, b) => a === 'dyn' && b === 's2' }))).toEqual(['dyn|s1']);
    expect(names(findCollisions(st.bodies, { only: (a, b) => b === 's2' }))).toEqual(['dyn|s2']);
    expect(() => build((r) => { part(r, 'p1', 'x', null, [0, 0, 0], { static: true }); part(r, 'p2', 'x', null); })).toThrow(/static/);
  });

  it('5: noCollide skipped; unattributed mesh throws', () => {
    const nc = boxMesh(10, 10, 10);
    nc.userData.noCollide = true;
    const { bodies } = build((r) => { part(r, 'p1', 'a', boxMesh(10, 10, 10)); part(r, 'p2', 'b', nc, [3, 0, 0]); });
    expect(findCollisions(bodies)).toEqual([]);
    expect(bodies.get('b').triangleCount).toBe(0);
    const root = new THREE.Group();
    root.add(boxMesh(1, 1, 1));
    expect(() => collectBodies(root)).toThrow(/no part ancestor/);
  });

  it('6: rigidity violations', () => {
    const { root, parts } = build((r) => {
      part(r, 'p1', 'b', boxMesh(2, 2, 2));
      return part(r, 'p2', 'b', boxMesh(2, 2, 2), [10, 0, 0]);
    });
    const snap = snapshotRigidity(root);
    expect(rigidityViolations(root, snap)).toEqual([]);
    parts.position.x = 11;
    expect(rigidityViolations(root, snap)).toEqual([{ partId: 'p2', body: 'b' }]);
  });

  it('7: sweep accumulates collisions with labels', () => {
    const group = new THREE.Group();
    part(group, 'fixed', 'fixed', boxMesh(10, 10, 10), [0, 0, 0], { static: true });
    const slider = part(group, 'slider', 'slider', boxMesh(10, 10, 10));
    const assembly = { group, update: (pose) => { slider.position.x = pose.x; } };
    const bodies = collectBodies(group);
    const poses = Array.from({ length: 10 }, (_, i) => ({ label: `p${i}`, pose: { x: -20 + 4 * i } }));
    const res = sweep(assembly, bodies, poses);
    expect(res.samples).toBe(10);
    const e = res.collisions.get('fixed|slider');
    expect(e.count).toBe(5);
    expect(e.first).toBe('p3');
    expect(e.labels).toEqual(['p3', 'p4', 'p5', 'p6', 'p7']);
    expect(formatCollisions(res)).toContain('fixed x slider');
    expect(formatCollisions({ samples: 3, collisions: new Map() })).toContain('no collisions');
  });

  it('8: InstancedMesh instances are expanded', () => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(10, 10, 10), mat, 3);
    [0, 50, 100].forEach((x, i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, 0)));
    const { bodies } = build((r) => { part(r, 'inst', 'inst', im); part(r, 'probe', 'probe', boxMesh(4, 4, 4), [104, 0, 0]); });
    expect(bodies.get('inst').triangleCount).toBe(36);
    expect(names(findCollisions(bodies))).toEqual(['inst|probe']);
    const miss = build((r) => {
      const im2 = new THREE.InstancedMesh(new THREE.BoxGeometry(10, 10, 10), mat, 3);
      [0, 50, 100].forEach((x, i) => im2.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, 0)));
      part(r, 'inst', 'inst', im2); part(r, 'probe', 'probe', boxMesh(4, 4, 4), [75, 0, 0]);
    });
    expect(findCollisions(miss.bodies)).toEqual([]);
  });

  it('9: timing smoke test (60 bodies x ~10k triangles)', () => {
    const geo = new THREE.TorusKnotGeometry(10, 3, 250, 20); // 10 000 triangles
    const overlapIdx = [1, 11, 21];
    const t0 = performance.now();
    const { root, bodies } = build((r) => {
      for (let i = 0; i < 60; i++) {
        const pos = [(i % 10) * 60, Math.floor(i / 10) * 60, 0];
        if (overlapIdx.includes(i)) { pos[0] = ((i - 1) % 10) * 60 + 1; pos[1] = Math.floor((i - 1) / 10) * 60 + 1; }
        part(r, `p${i}`, `k${String(i).padStart(2, '0')}`, new THREE.Mesh(geo, mat), pos);
      }
    });
    const collectMs = performance.now() - t0;
    expect(bodies.size).toBe(60);
    root.updateMatrixWorld(true);
    const t1 = performance.now();
    const cols = findCollisions(bodies);
    const findMs = performance.now() - t1;
    console.log(`[perf] collect ${collectMs.toFixed(0)} ms, findCollisions ${findMs.toFixed(1)} ms (${bodies.size} bodies, ${[...bodies.values()].reduce((s, b) => s + b.triangleCount, 0)} tris)`);
    expect(names(cols).sort()).toEqual(['k00|k01', 'k10|k11', 'k20|k21']);
    expect(findMs).toBeLessThan(500);
  });
});
