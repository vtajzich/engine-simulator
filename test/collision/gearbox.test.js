import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive } from '../../src/kin/derive.js';
import { poseAt, poseForGear } from '../../src/kin/pose.js';
import { gearLinear } from '../../src/kin/gears.js';
import { maxMisalign, advanceDog, advanceRing, xDogTip, xBlock } from '../../src/kin/synchro.js';
import {
  collectBodies, sweep, formatCollisions, bodiesIntersect, bodiesIntersectDisplaced, snapshotRigidity, rigidityViolations,
} from '../../verify/collide.js';

const t0 = Date.now();
import { buildGearbox } from '../../src/model/gearbox.js';
const mod = buildGearbox();
const buildMs = Date.now() - t0;
const root = new THREE.Group(); root.add(mod.group);
const assembly = { root, update(p) { mod.update(p); root.updateMatrixWorld(true); } };
assembly.update(poseAt({}));
const bodies = collectBodies(root);

const D = derive();
const GB = SPEC.gearbox, SY = GB.synchro;
const { P, pitchAngle } = D.synchro;
const PR = SY.pitchRadius, TAU = 2 * Math.PI;
const T = { timeout: 600000 };
const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const BODY_NAMES = ['inputShaft', 'counterShaft', 'mainShaft', 'gear1', 'gear2', 'gear3', 'gear5', 'idlerR',
  'sleeve12', 'sleeve34', 'sleeve5', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5'];
const gearBody = { g1: 'gear1', g2: 'gear2', g3: 'gear3', g5: 'gear5', input: 'inputShaft' };
const sideList = [   // [sleeve, sign, gear, ring]
  ['s12', -1, 'g2', 'ring2'], ['s12', 1, 'g1', 'ring1'], ['s34', -1, 'input', 'ring4'], ['s34', 1, 'g3', 'ring3'], ['s5', 1, 'g5', 'ring5'],
];
const sleeveBody = { s12: 'sleeve12', s34: 'sleeve34', s5: 'sleeve5' };

function check(poses, label = '') {
  const res = sweep(assembly, bodies, poses);
  expect(res.collisions.size, `${label}\n${formatCollisions(res)}`).toBe(0);
  return res;
}

describe('gearbox structure', () => {
  it('every collidable mesh belongs to a body of design.md §3; all bodies present', () => {
    const names = [...bodies.keys()].sort();
    expect(names).toEqual([...BODY_NAMES].sort());
    root.traverse(o => {
      if (o.isMesh && !o.userData.noCollide) {
        let p = o, found = null;
        while (p) { if (p.userData.part) { found = p.userData.part; break; } p = p.parent; }
        expect(found, `mesh ${o.name} without part`).toBeTruthy();
        expect(BODY_NAMES).toContain(found.body);
      }
    });
    const ids = new Set(); root.traverse(o => { if (o.userData.part) ids.add(o.userData.part.id); });
    for (const id of ['inputShaft', 'inputGear', 'counterShaft', 'mainShaft', 'hub12', 'hub34', 'hub5', 'revGear', 'outputFlange',
      'gear1', 'gear2', 'gear3', 'gear5', 'idlerR', 'sleeve12', 'sleeve34', 'sleeve5', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5']) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('9: triangle counts and build time', () => {
    let total = 0;
    const rows = [];
    for (const b of bodies.values()) { total += b.triangleCount; rows.push(`${b.name}:${b.triangleCount}`); }
    console.log(`gearbox triangles ${total} (${rows.join(' ')}), build ${buildMs} ms`);
    expect(total).toBeLessThan(450000);
    expect(buildMs).toBeLessThan(5000);
  });

  it('shafts have the interface diameters inside the wall ranges and bores are real holes', () => {
    // largest radius of any triangle that overlaps the x range [lo, hi] (anchor-local frame; shafts sit on their own axis)
    const radial = (body, lo, hi) => {
      const pos = bodies.get(body).geometry.attributes.position;
      let r = 0;
      for (let i = 0; i < pos.count; i += 3) {
        let mn = Infinity, mx = -Infinity, rr = 0;
        for (let k = 0; k < 3; k++) { const x = pos.getX(i + k); mn = Math.min(mn, x); mx = Math.max(mx, x); rr = Math.max(rr, Math.hypot(pos.getY(i + k), pos.getZ(i + k))); }
        if (mx >= lo && mn <= hi) r = Math.max(r, rr);
      }
      return r;
    };
    expect(radial('inputShaft', ...GB.walls.front)).toBeCloseTo(12.5, 3);
    expect(radial('mainShaft', ...GB.walls.centre)).toBeCloseTo(15, 3);
    expect(radial('mainShaft', ...GB.walls.rear)).toBeCloseTo(15, 3);
    for (const w of Object.values(GB.walls)) expect(radial('counterShaft', ...w)).toBeCloseTo(16, 3);
    expect(radial('inputShaft', ...GB.shafts.inputSplineX)).toBeLessThanOrEqual(12.5 + 1e-4);
    expect(radial('inputShaft', GB.shafts.inputPilotX[0] + 1, GB.shafts.inputPilotX[1] - 1)).toBeLessThanOrEqual(GB.shafts.inputPilotDiameter / 2 + 1e-4);
    // bores are real holes: a ray from the axis hits the bore wall (r 15.3), not the outside of the gear
    const caster = new THREE.Raycaster();
    const firstHit = (body, x) => {
      const m = new THREE.Mesh(bodies.get(body).geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      caster.set(new THREE.Vector3(x, 0, 0), new THREE.Vector3(0.013, 1, 0.021).normalize());
      const hits = caster.intersectObject(m);
      return hits.length ? hits[0].distance : Infinity;
    };
    const hx = h => SY.hubs[h].x;
    expect(firstHit('gear3', hx('s34') + 30)).toBeCloseTo(15.3, 1);
    expect(firstHit('gear2', hx('s12') - 30)).toBeCloseTo(15.3, 1);
    expect(firstHit('gear1', hx('s12') + 30)).toBeCloseTo(15.3, 1);
    expect(firstHit('gear5', hx('s5') + 30)).toBeCloseTo(15.3, 1);
    expect(firstHit('inputShaft', hx('s34') - 10)).toBeCloseTo(15.3, 1);                                  // hollow cone end
    expect(firstHit('inputShaft', (GB.shafts.mainPilotX[0] + GB.shafts.mainPilotX[1]) / 2)).toBeCloseTo(8.2, 1);   // pilot hole
    expect(firstHit('idlerR', 0)).toBeCloseTo(8.2, 1);
  });
});

describe('gearbox collision sweeps', () => {
  it('1: neutral, clutch engaged, mainshaft still and turning', T, () => {
    const n = 180;
    check(seq(n + 1, i => { const a = 4 * Math.PI * i / n; return { label: `a=${a.toFixed(3)}`, pose: poseAt({ crank: a, input: a, main: 0 }) }; }), 'main=0');
    check(seq(n + 1, i => { const a = 4 * Math.PI * i / n; return { label: `a=${a.toFixed(3)}`, pose: poseAt({ crank: a, input: a, main: 0.37 * a }) }; }), 'main=0.37a');
  });

  it('2+3: every gear and reverse, mainshaft over one turn; rigidity', T, () => {
    const snap = snapshotRigidity(root);
    for (const g of ['1', '2', '3', '4', '5', 'R']) {
      const poses = seq(61, i => { const m = TAU * i / 60; return { label: `gear ${g} main=${m.toFixed(3)}`, pose: poseForGear(g, { main: m }) }; });
      check(poses, `gear ${g}`);
      expect(rigidityViolations(root, snap)).toEqual([]);
    }
    expect(rigidityViolations(root, snap)).toEqual([]);
  });

  it('4: speed / direction from the pose chain and the scene graph', () => {
    const p0 = poseAt({ input: 0.4, main: 0 }), p1 = poseAt({ input: 0.4 + 0.1, main: 0 });
    const d = (a, b) => b - a;
    const dIn = d(p0.input, p1.input);
    expect(d(p0.counter, p1.counter)).toBeLessThan(0);                                           // against the input
    expect(d(p0.counter, p1.counter) / dIn).toBeCloseTo(-GB.pairs.input.main / GB.pairs.input.counter, 9);
    for (const g of ['g1', 'g2', 'g3', 'g5']) {
      const r = d(p0.gears[g], p1.gears[g]) / dIn;
      expect(r).toBeGreaterThan(0);                                                              // with the input
      expect(r).toBeCloseTo((GB.pairs[g].counter / GB.pairs[g].main) * (GB.pairs.input.main / GB.pairs.input.counter), 9);
    }
    expect(d(p0.gears.idler, p1.gears.idler)).toBeGreaterThan(0);                                // idler with the input
    // the scene graph really turns the bodies: world direction of local +Y on each body equals the pose angle
    const ang = (name) => {
      const b = bodies.get(name); const q = new THREE.Quaternion().setFromRotationMatrix(b.anchor.matrixWorld);
      const v = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      return Math.atan2(v.z, v.y);
    };
    assembly.update(p1);
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    expect(wrap(ang('inputShaft') - p1.input)).toBeCloseTo(0, 9);
    expect(wrap(ang('counterShaft') - p1.counter)).toBeCloseTo(0, 9);
    expect(wrap(ang('gear1') - p1.gears.g1)).toBeCloseTo(0, 9);
    expect(wrap(ang('idlerR') - p1.gears.idler)).toBeCloseTo(0, 9);
    expect(wrap(ang('mainShaft') - p1.main)).toBeCloseTo(0, 9);
  });
});

describe('gear mesh two-sided checks', () => {
  const X = new THREE.Vector3(1, 0, 0);
  const helical = [
    ['input', 'inputShaft', GB.pairs.input.main], ['g3', 'gear3', GB.pairs.g3.main], ['g2', 'gear2', GB.pairs.g2.main],
    ['g1', 'gear1', GB.pairs.g1.main], ['g5', 'gear5', GB.pairs.g5.main],
  ];
  for (const [name, body] of helical) {
    it(`5: ${name} <-> countershaft, 12 phases`, T, () => {
      const g = D.gearbox.gears[`${name}.main`];
      const dAng = 1.3 * g.backlash / g.r;
      for (let k = 0; k < 12; k++) {
        assembly.update(poseAt({ input: 0.21 + TAU * k / 12 * (1 / 7) + k * 0.37 }));
        expect(bodiesIntersect(bodies, body, 'counterShaft'), `nominal k=${k}`).toBe(false);
        for (const s of [1, -1]) {
          expect(bodiesIntersectDisplaced(bodies, body, 'counterShaft', { angle: s * dAng, axisPoint: new THREE.Vector3(), axisDir: X }),
            `displaced ${s} k=${k}`).toBe(true);
        }
      }
    });
  }
  it('5: reverse train (counter<->idler, idler<->reverse gear), 12 phases', T, () => {
    const gi = D.gearbox.gears['rev.idler'];
    const dAng = 1.3 * gi.backlash / gi.r;
    const axisPoint = new THREE.Vector3(0, D.gearbox.idlerAxis.y, D.gearbox.idlerAxis.z);
    for (let k = 0; k < 12; k++) {
      assembly.update(poseForGear('R', { main: 0.13 + TAU * k / 12 * (3 / 17) + k * 0.29 }));
      expect(bodiesIntersect(bodies, 'idlerR', 'counterShaft'), `nominal c-i k=${k}`).toBe(false);
      expect(bodiesIntersect(bodies, 'idlerR', 'mainShaft'), `nominal i-m k=${k}`).toBe(false);
      for (const s of [1, -1]) {
        for (const other of ['counterShaft', 'mainShaft']) {
          expect(bodiesIntersectDisplaced(bodies, 'idlerR', other, { angle: s * dAng, axisPoint, axisDir: X }), `displaced ${other} ${s} k=${k}`).toBe(true);
        }
      }
    }
  });
});

describe('synchro shift sweeps', () => {
  const main = 0.3;
  const poseFor = (sleeve, sg, gname, ring, x, sign, extra = {}) => {
    const dg = maxMisalign(advanceDog(x));
    const dr = Math.min(SY.ringIndexFraction * P, maxMisalign(advanceRing(x)));
    const { A, B } = gearLinear(gname);
    const gearAngle = main + pitchAngle / 2 + sign * dg / PR;
    return poseAt({
      main, input: (gearAngle - B) / A, sleeves: { [sleeve]: sg * x },
      rings: { [ring]: { angle: main + pitchAngle / 2 + sign * dr / PR, push: clamp(x / 0.3, 0, 1) } }, ...extra,
    });
  };
  it('6: worst allowed misalignment, every active sleeve side, both signs', T, () => {
    for (const [sleeve, sg, gname, ring] of sideList) {
      for (const sign of [1, -1]) {
        const poses = seq(39, i => { const x = 0.25 * i; return { label: `${sleeve}${sg > 0 ? '+' : '-'} sign=${sign} x=${x}`, pose: poseFor(sleeve, sg, gname, ring, x, sign) }; });
        check(poses, `${sleeve} ${sg} ${sign}`);
      }
    }
  });

  it('7a: gear misaligned beyond the chamfer limit -> sleeve/gear collision', () => {
    for (const [sleeve, sg, gname, ring] of sideList) {
      for (const sign of [1, -1]) {
        const x = xDogTip + 1.5;
        const dg = maxMisalign(advanceDog(x)) + 0.35;
        const { A, B } = gearLinear(gname);
        const gearAngle = main0 + pitchAngle / 2 + sign * dg / PR;
        assembly.update(poseAt({ main: main0, input: (gearAngle - B) / A, sleeves: { [sleeve]: sg * x }, rings: { [ring]: { angle: main0 + pitchAngle / 2, push: 1 } } }));
        expect(bodiesIntersect(bodies, sleeveBody[sleeve], gearBody[gname]), `${sleeve} ${sg} ${sign}`).toBe(true);
      }
    }
  });
  const main0 = 0.3;

  it('7b: ring at full index blocks the sleeve -> sleeve/ring collision (and none just below the block point)', () => {
    for (const [sleeve, sg, gname, ring] of sideList) {
      for (const sign of [1, -1]) {
        const ringAngle = main0 + pitchAngle / 2 + sign * SY.ringIndexFraction * P / PR;
        const at = x => { assembly.update(poseAt({ main: main0, sleeves: { [sleeve]: sg * x }, rings: { [ring]: { angle: ringAngle, push: 1 } } })); };
        at(xBlock + 0.4);
        expect(bodiesIntersect(bodies, sleeveBody[sleeve], ring), `${sleeve} ${sg} ${sign} blocked`).toBe(true);
        at(xBlock - 0.1);
        expect(bodiesIntersect(bodies, sleeveBody[sleeve], ring), `${sleeve} ${sg} ${sign} before block`).toBe(false);
      }
    }
  });

  it('7c/d: reverse idler: correct phase meshes, half-tooth-off collides, neutral never collides', () => {
    const gm = D.gearbox.gears['rev.main'];
    const halfTooth = TAU / gm.z / 2;
    for (let k = 0; k < 8; k++) {
      const m = 0.2 + k * 0.7;
      const good = poseForGear('R', { main: m });
      expect(good.idlerX).toBe(GB.reverse.idlerTravel);
      assembly.update(good);
      expect(bodiesIntersect(bodies, 'idlerR', 'mainShaft'), `good k=${k}`).toBe(false);
      assembly.update({ ...good, main: m + halfTooth, rings: poseAt({ main: m + halfTooth }).rings });
      expect(bodiesIntersect(bodies, 'idlerR', 'mainShaft'), `half tooth off k=${k}`).toBe(true);
      // (d) idlerX = 0 and any phase: no collision of the idler with anything
      for (const mm of [m, m + halfTooth, m + 1.1]) {
        const res = sweep(assembly, bodies, [{ label: `neutral m=${mm}`, pose: poseAt({ input: 0.9 * k, main: mm, idlerX: 0 }) }]);
        expect(res.collisions.size, formatCollisions(res)).toBe(0);
      }
    }
  });

  it('idler stays meshed with the wide countershaft gear over the whole idlerX range (-9.5 reverse ... 0 ... +9.5 fifth)', () => {
    const gi = D.gearbox.gears['rev.idler'];
    const dAng = 1.3 * gi.backlash / gi.r;
    const axisPoint = new THREE.Vector3(0, D.gearbox.idlerAxis.y, D.gearbox.idlerAxis.z);
    const poses = [{ label: 'R', pose: poseForGear('R', { main: 0.4 }) }];
    poses.push({ label: '5th', pose: poseForGear('5', { main: 0.4 }) });
    for (const x of [-1, 0, 3]) {
      for (const m of [0, 0.5, 1.7]) poses.push({ label: `idlerX=${x} main=${m}`, pose: poseAt({ input: 2 * m, main: m, idlerX: x, sleeves: { s5: x } }) });
    }
    for (const { label, pose } of poses) {
      assembly.update(pose);
      const res = sweep(assembly, bodies, [{ label, pose }]);
      expect(res.collisions.size, `${label}\n${formatCollisions(res)}`).toBe(0);
      for (const s of [1, -1]) {
        expect(bodiesIntersectDisplaced(bodies, 'idlerR', 'counterShaft', { angle: s * dAng, axisPoint, axisDir: new THREE.Vector3(1, 0, 0) }), `${label} meshed ${s}`).toBe(true);
      }
    }
  });

  it('8: cone contact two-sided: seated ring clear at every relative phase, 0.3 mm toward its gear intersects', () => {
    for (const [sleeve, sg, gname, ring] of sideList) {
      const sign = sg;                                   // gear sits on side sg of its hub
      for (let k = 0; k < 24; k++) {
        const { A, B } = gearLinear(gname);
        const ga = main0 + pitchAngle / 2 + k * 0.263;
        assembly.update(poseAt({ main: main0, input: (ga - B) / A, rings: { [ring]: { angle: main0 + pitchAngle / 2, push: 1 } } }));
        expect(bodiesIntersect(bodies, ring, gearBody[gname]), `${ring} nominal k=${k}`).toBe(false);
        expect(bodiesIntersectDisplaced(bodies, ring, gearBody[gname], { offset: new THREE.Vector3(sign * 0.3, 0, 0) }), `${ring} displaced k=${k}`).toBe(true);
      }
    }
  });
});
