import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { poseAt } from '../../src/kin/pose.js';
import { clutchStack, fingerPoint, releaseKin, bearingFaceX } from '../../src/kin/clutch.js';
import {
  collectBodies, sweep, formatCollisions, bodiesIntersect, bodiesIntersectDisplaced, clearanceAlong,
  snapshotRigidity, rigidityViolations, findCollisions,
} from '../../verify/collide.js';
import { buildClutch } from '../../src/model/clutch.js';

const t0 = performance.now();
const mod = buildClutch();
const buildMs = performance.now() - t0;
const root = new THREE.Group();
root.add(mod.group);

// Stand-ins for solids that belong to other modules (static, dimensions from SPEC):
// the Ø36 guide quill and the Ø25 gearbox input shaft (spline section).
function proxy(id, r, x0, x1) {
  const g = new THREE.Group(); g.userData.part = { id, body: id, label: id, static: true };
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 64).rotateZ(-Math.PI / 2).translate((x0 + x1) / 2, 0, 0), new THREE.MeshBasicMaterial());
  g.add(m); return g;
}
root.add(proxy('quillProxy', SPEC.clutch.quill.od / 2, SPEC.clutch.quill.frontX, SPEC.gearbox.walls.front[0]));
const SH = SPEC.gearbox.shafts;   // the input shaft: Ø15 pilot inside the crank, Ø25 from the spline section on
root.add(proxy('shaftPilotProxy', SH.inputPilotDiameter / 2, SH.inputPilotX[0], SH.inputSplineX[0]));
root.add(proxy('shaftProxy', SH.inputDiameter / 2, SH.inputSplineX[0], 520));

const assembly = { root, update(p) { mod.update(p); root.updateMatrixWorld(true); } };
const pose = (pedal, crank = 0, input = 0) => poseAt({ crank, input, clutchPedal: pedal });
assembly.update(pose(0));
const bodies = collectBodies(root);
const X = new THREE.Vector3(1, 0, 0);
const FINGERS = Array.from({ length: 18 }, (_, i) => 'finger' + String(i + 1).padStart(2, '0'));
const own = [...bodies.keys()].filter(n => !n.endsWith('Proxy'));
const anyFinger = (fn) => FINGERS.some(fn);
const at = (p) => assembly.update(pose(p));
const off = (x) => ({ offset: new THREE.Vector3(x, 0, 0) });

describe('clutch module', () => {
  it('has exactly the bodies of design.md section 3 and all collidable meshes attributed', () => {
    const allowed = new Set(['crank', 'pressurePlate', 'clutchDisc', 'releaseBearing', 'releaseFork', 'bellhousing', ...FINGERS]);
    expect(new Set(own)).toEqual(allowed);
    const noCol = []; let meshes = 0;
    mod.group.traverse(o => { if (o.isMesh) { meshes++; if (o.userData.noCollide) noCol.push(o); } });
    expect(noCol.length).toBe(2);                       // only the visual drive straps and the disc-hub index mark
    expect(noCol.map(o => o.parent.userData.part.id).sort()).toEqual(['clutchDisc', 'pressurePlate']);
    expect(bodies.get('crank').partIds.sort()).toEqual(['clutchCover', 'flywheel', 'pilotBearing']);
    expect(bodies.get('bellhousing').static).toBe(true);
    let housing = false; mod.group.traverse(o => { if (o.isMesh && o.userData.housing) housing = true; });
    expect(housing).toBe(true);
    for (const b of bodies.values()) expect(b.triangleCount, b.name).toBeGreaterThan(0);
  });

  it('1+2: pedal 0..1 sweep x crank x input has zero collisions and rigid bodies', () => {
    const poses = [];
    for (let i = 0; i <= 20; i++) for (const c of [0, 0.37, 1.9]) for (const inp of [0, 0.5])
      poses.push({ label: `p${(i / 20).toFixed(2)} c${c} i${inp}`, pose: pose(i / 20, c, inp) });
    assembly.update(poses[0].pose);
    const snap = snapshotRigidity(root);
    const viol = [];
    for (const { label, pose: p } of poses) { assembly.update(p); for (const v of rigidityViolations(root, snap)) viol.push(label + ' ' + v.partId); }
    expect(viol).toEqual([]);
    const res = sweep(assembly, bodies, poses);
    expect(res.samples).toBe(126);
    expect(res.collisions.size, formatCollisions(res)).toBe(0);
  });

  it('pilot bearing is a crank-body part inside radius 13.1 and x 361.9 ... 372.1', () => {
    at(0);
    const part = collectBodies(root, { cache: false }).get('crank').partIds.includes('pilotBearing');
    expect(part).toBe(true);
    let g = null; mod.group.traverse(o => { if (o.userData.part?.id === 'pilotBearing') g = o; });
    expect(g.userData.part.body).toBe('crank');
    const bb = new THREE.Box3().setFromObject(g);
    expect(Math.max(Math.abs(bb.min.y), bb.max.y, Math.abs(bb.min.z), bb.max.z)).toBeLessThanOrEqual(13.1);
    expect(bb.min.x).toBeGreaterThanOrEqual(361.9);
    expect(bb.max.x).toBeLessThanOrEqual(372.1);
  });

  it('fork keeps >= 2 mm from the quill (margin proxy radius 20)', () => {
    const r = new THREE.Group(); r.add(mod.group); r.add(proxy('quillMargin', 20, SPEC.clutch.quill.frontX, SPEC.gearbox.walls.front[0]));
    const a = { root: r, update(p) { mod.update(p); r.updateMatrixWorld(true); } };
    const bs = collectBodies(r, { cache: false });
    const poses = Array.from({ length: 21 }, (_, i) => ({ label: 'p' + i, pose: pose(i / 20) }));
    const res = sweep(a, bs, poses, { only: (x, y) => x === 'releaseFork' || y === 'releaseFork', ignore: (x, y) => x === 'releaseBearing' || y === 'releaseBearing' });
    expect(res.collisions.size, formatCollisions(res)).toBe(0);
    root.add(mod.group); assembly.update(pose(0));   // re-parent back
  });

  it('3: finger kinematics match fingerPoint(T/O, phi)', () => {
    const st = clutchStack();
    const f1 = bodies.get('finger01').anchor;
    for (const p of [0, 0.3, 0.6, 1]) {
      assembly.update(pose(p));
      const phi = releaseKin(p).fingerAngle;
      for (const P of [st.T, st.O, st.F]) {
        const w = f1.localToWorld(new THREE.Vector3(P.x - st.F.x, P.rho - st.F.rho, 0));
        const e = fingerPoint(P, phi);
        expect(Math.hypot(w.y, w.z)).toBeCloseTo(e.rho, 6);
        expect(w.x).toBeCloseTo(e.x, 6);
      }
    }
    assembly.update(pose(0));
  });

  it('4: directions of motion', () => {
    const worldX = (name, local = new THREE.Vector3()) => bodies.get(name).anchor.localToWorld(local.clone()).x;
    const st = clutchStack();
    const tipX = () => bodies.get('finger01').anchor.localToWorld(new THREE.Vector3(st.T.x - st.F.x, st.T.rho - st.F.rho, 0)).x;
    at(0);
    const b0 = worldX('releaseBearing'), t0x = tipX(), p0 = worldX('pressurePlate'), d0 = worldX('clutchDisc');
    at(1);
    expect(worldX('releaseBearing')).toBeLessThan(b0);
    expect(b0 - worldX('releaseBearing')).toBeCloseTo(releaseKin(1).bearingTravel, 9);
    expect(tipX()).toBeLessThan(t0x);
    expect(worldX('pressurePlate') - p0).toBeCloseTo(1.8, 6);
    expect(worldX('clutchDisc') - d0).toBeCloseTo(0.9, 6);
    at(0);
  });

  it('5a: contacts at pedal 0 (two-sided)', () => {
    at(0);
    expect(bodiesIntersect(bodies, 'clutchDisc', 'crank')).toBe(false);
    expect(bodiesIntersect(bodies, 'pressurePlate', 'clutchDisc')).toBe(false);
    expect(bodiesIntersectDisplaced(bodies, 'clutchDisc', 'crank', off(-0.3))).toBe(true);
    expect(bodiesIntersectDisplaced(bodies, 'pressurePlate', 'clutchDisc', off(-0.3))).toBe(true);
    expect(anyFinger(f => bodiesIntersect(bodies, 'pressurePlate', f))).toBe(false);
    expect(anyFinger(f => bodiesIntersectDisplaced(bodies, 'pressurePlate', f, off(0.3)))).toBe(true);
    expect(anyFinger(f => bodiesIntersect(bodies, f, 'crank'))).toBe(false);
    expect(bodiesIntersectDisplaced(bodies, 'finger01', 'crank', off(0.3))).toBe(true);
    expect(bodiesIntersectDisplaced(bodies, 'finger01', 'crank', off(0.1))).toBe(true);   // gap is only 0.05
    expect(bodiesIntersectDisplaced(bodies, 'finger01', 'crank', off(0.02))).toBe(false);
  });

  it('5b: contacts at pedal 0.6 and 1 (two-sided)', () => {
    for (const p of [0.6, 1]) {
      at(p);
      expect(anyFinger(f => bodiesIntersect(bodies, 'releaseBearing', f)), 'bearing nominal').toBe(false);
      expect(anyFinger(f => bodiesIntersectDisplaced(bodies, 'releaseBearing', f, off(-0.3))), 'bearing -0.3 p' + p).toBe(true);
      expect(anyFinger(f => bodiesIntersect(bodies, 'pressurePlate', f)), 'plate nominal').toBe(false);
      expect(anyFinger(f => bodiesIntersectDisplaced(bodies, 'pressurePlate', f, off(0.3))), 'plate +0.3 p' + p).toBe(true);
      expect(anyFinger(f => bodiesIntersect(bodies, f, 'crank'))).toBe(false);
      const gap = clearanceAlong(bodies, 'releaseBearing', 'finger01', new THREE.Vector3(-1, 0, 0), { max: 3 });
      const gaps = FINGERS.map(f => clearanceAlong(bodies, 'releaseBearing', f, new THREE.Vector3(-1, 0, 0), { max: 3 }));
      const g = Math.min(...gaps);
      expect(g, 'bearing-finger gap p' + p).toBeGreaterThan(0);
      expect(g).toBeLessThan(0.3);
      void gap;
    }
    at(0);
  });

  it('5c: pedal 1 — disc is free on both sides', () => {
    at(1);
    const dx = new THREE.Vector3(-1, 0, 0);
    expect(clearanceAlong(bodies, 'clutchDisc', 'crank', dx)).toBeCloseTo(0.9, 0);
    expect(Math.abs(clearanceAlong(bodies, 'clutchDisc', 'crank', dx) - 0.9)).toBeLessThan(0.15);
    expect(Math.abs(clearanceAlong(bodies, 'pressurePlate', 'clutchDisc', dx) - 0.9)).toBeLessThan(0.15);
    at(0);
  });

  it('fork pads follow the bearing with a 0.1 - 0.6 mm gap', () => {
    for (const p of [0, 0.3, 0.6, 1]) {
      at(p);
      const g = clearanceAlong(bodies, 'releaseFork', 'releaseBearing', new THREE.Vector3(-1, 0, 0), { max: 3, step: 0.05, tol: 0.005 });
      expect(g, 'p' + p).toBeGreaterThan(0.1);
      expect(g, 'p' + p).toBeLessThan(0.6);
    }
    at(0);
  });

  it('6: negative controls', () => {
    for (const p of [0, 1]) {
      at(p);
      expect(bodiesIntersect(bodies, 'releaseFork', 'releaseBearing')).toBe(false);
      expect(bodiesIntersectDisplaced(bodies, 'releaseFork', 'releaseBearing', {
        angle: 6 * Math.PI / 180, axisPoint: bodies.get('releaseFork').anchor.getWorldPosition(new THREE.Vector3()), axisDir: new THREE.Vector3(0, 1, 0),
      }), 'fork +6deg p' + p).toBe(true);
    }
    // finger driven 0.12 rad beyond its engaged position (outer end down into the pressure-plate ridge)
    at(0);
    const st = clutchStack();
    const Fw = new THREE.Vector3(st.F.x, st.F.rho, 0);
    const opt = { angle: 0.12, axisPoint: Fw, axisDir: new THREE.Vector3(0, 0, 1) };
    expect(bodiesIntersectDisplaced(bodies, 'finger01', 'pressurePlate', opt) || bodiesIntersectDisplaced(bodies, 'finger01', 'crank', opt)).toBe(true);
    expect(bodiesIntersectDisplaced(bodies, 'finger01', 'pressurePlate', { ...opt, angle: 0.01 })).toBe(true);
  });

  it('7: triangle counts and build time', () => {
    let total = 0; const rows = [];
    for (const b of bodies.values()) if (!b.name.endsWith('Proxy')) { total += b.triangleCount; rows.push(`${b.name}=${b.triangleCount}`); }
    console.log(`clutch triangles: total ${total}; ${rows.filter(r => !r.startsWith('finger')).join(' ')}; finger=${bodies.get('finger01').triangleCount} x18; build ${buildMs.toFixed(0)} ms`);
    expect(total).toBeLessThan(200000);
    expect(buildMs).toBeLessThan(4000);
  });
});
