import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive, rad } from '../../src/kin/derive.js';
import { poseAt } from '../../src/kin/pose.js';
import { valveLift, lobeCentreAngle, camAngle } from '../../src/kin/cam.js';
import {
  collectBodies, sweep, formatCollisions, bodiesIntersect, bodiesIntersectDisplaced, clearanceAlong,
  snapshotRigidity, rigidityViolations,
} from '../../verify/collide.js';
import { buildTopEnd } from '../../src/model/topEnd.js';
import { portFrame } from '../../src/geo/topGas.js';
import { gasState, pistonCrownY, throwAngle } from '../../src/kin/engine.js';

const D = derive();
const E = SPEC.engine;
const t0 = performance.now();
const mod = buildTopEnd();
const buildMs = performance.now() - t0;
const root = new THREE.Group(); root.add(mod.group);
const assembly = { root, update(p) { mod.update(p); root.updateMatrixWorld(true); } };
assembly.update(poseAt({}));
const bodies = collectBodies(root);

const valveNames = [];
for (const k of ['In', 'Ex']) for (let c = 1; c <= 4; c++) for (const w of ['a', 'b']) valveNames.push(`valve${k}${c}${w}`);
const info = n => ({ kind: n.startsWith('valveIn') ? 'in' : 'ex', cyl: +n[7] - 1, which: n[8] === 'a' ? 0 : 1 });
const poses = (step, from = 0, to = 720) => {
  const out = [];
  for (let d = from; d <= to; d += step) out.push({ label: `crank=${d}`, pose: poseAt({ crank: rad(d) }) });
  return out;
};
const camOf = kind => (kind === 'in' ? 'camIn' : 'camEx');
const axisVec = kind => new THREE.Vector3(...D.valve[kind].axis);

describe('top end', () => {
  it('has the expected bodies', () => {
    const allowed = new Set(['head', 'crank', 'camIn', 'camEx', ...valveNames]);
    for (const name of bodies.keys()) expect(allowed.has(name), `unexpected body ${name}`).toBe(true);
    for (const n of [...allowed]) expect(bodies.has(n), `missing body ${n}`).toBe(true);
    expect(bodies.get('head').static).toBe(true);
    const ids = new Set(); root.traverse(o => o.userData.part && ids.add(o.userData.part.id));
    for (const id of ['head', 'camCaps', 'sparkPlug1', 'sparkPlug4', 'camIn', 'camEx', 'camSprocketIn', 'camSprocketEx', 'crankSprocket', 'belt', 'gas1', 'gas4', 'spark1', 'spark4', 'intakeManifold', 'exhaustManifold']) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('1: sweep crank 0..720 in 2 deg steps has zero collisions', () => {
    const res = sweep(assembly, bodies, poses(2));
    expect(res.samples).toBe(361);
    expect(res.collisions.size, formatCollisions(res)).toBe(0);
  }, 600000);

  it('2: rigidity over the sweep', () => {
    assembly.update(poseAt({}));
    const snap = snapshotRigidity(root);
    for (const { pose } of poses(10)) {
      assembly.update(pose);
      expect(rigidityViolations(root, snap)).toEqual([]);
    }
  });

  it('3: kinematics from the scene', () => {
    const maxDisp = E.valves.seatGap + valveLift('in', 0, rad(474));
    for (const n of valveNames) {
      const { kind, cyl, which } = info(n);
      const g = root.getObjectByName(n);
      const seat = new THREE.Vector3(...D.valve[kind].seat(cyl, which));
      const ax = axisVec(kind);
      for (let d = 0; d < 720; d += 10) {
        assembly.update(poseAt({ crank: rad(d) }));
        const disp = seat.clone().sub(g.position);
        expect(disp.dot(ax)).toBeCloseTo(E.valves.seatGap + valveLift(kind, cyl, rad(d)), 9);
        expect(disp.clone().addScaledVector(ax, -disp.dot(ax)).length()).toBeLessThan(1e-9);   // purely along the axis
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(g.quaternion);
        expect(up.distanceTo(ax)).toBeLessThan(1e-9);                                             // local +Y = valve axis
      }
    }
    // intake valves of cylinder 1 at maximum lift at crank 474 deg
    let best = -1, bestAt = 0;
    for (let d = 0; d < 720; d += 1) {
      const l = valveLift('in', 0, rad(d)); if (l > best) { best = l; bestAt = d; }
    }
    expect(bestAt).toBe(474);
    assembly.update(poseAt({ crank: rad(474) }));
    for (const n of ['valveIn1a', 'valveIn1b']) {
      const disp = new THREE.Vector3(...D.valve.in.seat(0, n.endsWith('a') ? 0 : 1)).sub(root.getObjectByName(n).position).length();
      expect(disp).toBeCloseTo(E.valves.seatGap + SPEC.engine.valves.intake.maxLift - E.valvetrain.lash, 6);
    }
    // cams turn at half crank speed in the crank direction
    for (const d of [0, 90, 400, 700]) {
      assembly.update(poseAt({ crank: rad(d) }));
      const up = new THREE.Vector3(0, 1, 0);
      for (const k of ['camIn', 'camEx']) {
        const w = up.clone().applyQuaternion(root.getObjectByName(k).getWorldQuaternion(new THREE.Quaternion()));
        expect(Math.atan2(w.z, w.y)).toBeCloseTo(Math.atan2(Math.sin(rad(d) / 2), Math.cos(rad(d) / 2)), 9);
      }
    }
    // lobe nose direction of cylinder 1 intake lobe equals lobeCentreAngle, also in the world at crank 474
    assembly.update(poseAt({ crank: rad(474) }));
    for (const [nm, kind, cyl] of [['lobeIn1a', 'in', 0], ['lobeIn2a', 'in', 1], ['lobeEx3b', 'ex', 2]]) {
      const lobe = root.getObjectByName(nm);
      const pos = lobe.geometry.attributes.position;
      let rMax = 0, ang = 0;
      for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot(pos.getY(i), pos.getZ(i));
        if (r > rMax) { rMax = r; ang = Math.atan2(pos.getZ(i), pos.getY(i)); }
      }
      const want = lobeCentreAngle(kind, cyl);
      expect(Math.abs(Math.atan2(Math.sin(ang - want), Math.cos(ang - want)))).toBeLessThan(rad(1.01));
      expect(rMax).toBeCloseTo(SPEC.engine.valvetrain.baseCircleRadius + (kind === 'in' ? E.valves.intake.maxLift : E.valves.exhaust.maxLift), 1);
    }
    // world nose direction of the cylinder-1 intake lobe points at the follower at crank 474
    {
      const lobe = root.getObjectByName('lobeIn1a');
      const pos = lobe.geometry.attributes.position;
      let rMax = 0, vi = 0;
      for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getY(i), pos.getZ(i)); if (r > rMax) { rMax = r; vi = i; } }
      const w = new THREE.Vector3().fromBufferAttribute(pos, vi).applyMatrix4(lobe.matrixWorld);
      const c = root.getObjectByName('camIn').position;
      const a = Math.atan2(w.z - c.z, w.y - c.y), f = D.valve.in.followerAngle;
      expect(Math.abs(Math.atan2(Math.sin(a - f), Math.cos(a - f)))).toBeLessThan(rad(1.01));
    }
  });

  it('4: two-sided contact: cam-bucket and valve-seat', () => {
    for (let d = 0; d <= 720; d += 30) {
      assembly.update(poseAt({ crank: rad(d) }));
      for (const n of valveNames) {
        const { kind, cyl } = info(n);
        const off = axisVec(kind).multiplyScalar(0.3);
        const cam = camOf(kind);
        expect(bodiesIntersect(bodies, n, cam), `${n} x ${cam} nominal at ${d}`).toBe(false);
        expect(bodiesIntersectDisplaced(bodies, n, cam, { offset: off }), `${n} displaced +0.3 into ${cam} at ${d}`).toBe(true);
        if (valveLift(kind, cyl, rad(d)) === 0) {
          expect(bodiesIntersect(bodies, n, 'head'), `${n} x head nominal at ${d}`).toBe(false);
          expect(bodiesIntersectDisplaced(bodies, n, 'head', { offset: off }), `${n} displaced +0.3 into head at ${d}`).toBe(true);
        }
      }
    }
  });

  it('5: negative controls', () => {
    assembly.update(poseAt({ crank: rad(474) }));
    const c = root.getObjectByName('camIn').position;
    const hits = [];
    for (const n of valveNames.filter(v => v.startsWith('valveIn'))) {
      if (bodiesIntersectDisplaced(bodies, 'camIn', n, { angle: Math.PI / 2, axisPoint: c.clone(), axisDir: new THREE.Vector3(1, 0, 0) })) hits.push(n);
    }
    expect(hits.length).toBeGreaterThan(0);
    // closed valve pushed 1.5 mm sideways hits the head
    for (const d of [0, 60, 200]) {
      assembly.update(poseAt({ crank: rad(d) }));
      for (const n of valveNames) {
        const { kind, cyl } = info(n);
        if (valveLift(kind, cyl, rad(d)) > 0) continue;
        expect(bodiesIntersectDisplaced(bodies, n, 'head', { offset: new THREE.Vector3(1.5, 0, 0) }), `${n} at ${d}`).toBe(true);
      }
    }
  });

  it('5b: valve stems run in real guide holes (lifted valve pushed 0.6 mm sideways hits the head, 0.1 mm does not)', () => {
    assembly.update(poseAt({ crank: rad(474) }));   // cylinder 1 intake at maximum lift: valve head is out of its pocket
    for (const n of ['valveIn1a', 'valveIn1b']) {
      const a = axisVec('in');
      const perp = new THREE.Vector3(0, -a.z, a.y);
      expect(bodiesIntersectDisplaced(bodies, n, 'head', { offset: perp.clone().multiplyScalar(0.1) }), `${n} 0.1`).toBe(false);
      expect(bodiesIntersectDisplaced(bodies, n, 'head', { offset: perp.clone().multiplyScalar(0.6) }), `${n} 0.6`).toBe(true);
      expect(bodiesIntersectDisplaced(bodies, n, 'head', { offset: perp.clone().multiplyScalar(-0.6) }), `${n} -0.6`).toBe(true);
    }
  });

  it('6: clearance between intake and exhaust valve heads of cylinder 1 (> 0.5 mm)', () => {
    let min = Infinity;
    for (let d = 0; d < 720; d += 6) {
      assembly.update(poseAt({ crank: rad(d) }));
      for (const w of ['a', 'b']) {
        const a = root.getObjectByName(`valveIn1${w}`).position, b = root.getObjectByName(`valveEx1${w}`).position;
        const dir = b.clone().sub(a);
        min = Math.min(min, clearanceAlong(bodies, `valveIn1${w}`, `valveEx1${w}`, dir, { max: 40, step: 0.25, tol: 0.02 }));
      }
    }
    console.log(`min intake/exhaust head clearance of cylinder 1: ${min.toFixed(3)} mm`);
    expect(min).toBeGreaterThan(0.5);
  });

  it('6b: belt teeth run in the crank direction', () => {
    const belt = root.getObjectByName('belt');
    const teeth = belt.children.find(c => c.isInstancedMesh);
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    const angleAt = crank => {
      assembly.update(poseAt({ crank }));
      teeth.getMatrixAt(0, m); p.setFromMatrixPosition(m);
      return Math.atan2(p.z, p.y);                       // tooth 0 starts on the crank sprocket arc (centre at origin)
    };
    const a0 = angleAt(0), a1 = angleAt(0.05);
    expect(a1 - a0).toBeCloseTo(0.05, 6);
  });

  it('7: triangle budget and build time; visual-only parts', () => {
    let total = 0;
    const lines = [];
    for (const b of bodies.values()) { total += b.triangleCount; if (['head', 'camIn', 'camEx', 'crank', 'valveIn1a', 'valveEx1a'].includes(b.name)) lines.push(`${b.name}: ${b.triangleCount}`); }
    console.log(`collidable triangles ${total}; ${lines.join(', ')}; build ${buildMs.toFixed(0)} ms`);
    expect(total).toBeLessThan(350000);
    expect(buildMs).toBeLessThan(6000);
    // gas hides without cylinders, sparks follow pose
    const noCyl = poseAt({ crank: 0 }); delete noCyl.cylinders;
    expect(() => mod.update(noCyl)).not.toThrow();
    expect(root.getObjectByName('gas1').visible).toBe(false);
    assembly.update(poseAt({ crank: rad(706) }));
    expect(root.getObjectByName('gas1').visible).toBe(true);
    expect(root.getObjectByName('spark1').children[0].visible).toBe(true);
    assembly.update(poseAt({ crank: rad(300) }));
    expect(root.getObjectByName('spark1').children[0].visible).toBe(false);
  });
});

// ───────────── gas exchange (docs/plan/G1-gas-flow.md) ─────────────
describe('gas flow visuals', () => {
  const M = 140, R = D.R, apex = D.roofApexY, gam = D.gamma;
  const L = { portStart: 12, portTiltDeg: 55, halfZ: 78 };
  const gasPart = c => root.getObjectByName(`gas${c}`);
  const charge = c => gasPart(c).children.find(o => o.name === `gasCharge${c}`);
  const stream = (c, kind, w) => gasPart(c).children.find(o => o.name === `gasStream${c}${kind}${w}`);
  const at = psi => { assembly.update(poseAt({ crank: rad(psi) })); };
  const visCount = im => { let n = 0; for (let k = 0; k < im.count; k++) if (im.instanceMatrix.array[k * 16] > 0) n++; return n; };
  const pos = (im, k, out) => out.set(im.instanceMatrix.array[k * 16 + 12], im.instanceMatrix.array[k * 16 + 13], im.instanceMatrix.array[k * 16 + 14]);
  const streamsOn = (c, kind) => ['a', 'b'].map(w => stream(c, kind, w)).some(m => m.visible);
  const snapshot = () => {
    const out = [];
    for (let c = 1; c <= 4; c++) {
      const ims = [charge(c), ...['in', 'ex'].flatMap(k => ['a', 'b'].map(w => stream(c, k, w)))];
      for (const im of ims) {
        out.push(im.visible, ...im.instanceMatrix.array);
        if (im.instanceColor) out.push(...im.instanceColor.array); else out.push(im.material.color.r, im.material.color.g, im.material.color.b);
      }
      const sp = root.getObjectByName(`spark${c}`);
      for (const ch of sp.children) out.push(ch.visible, ch.scale.x, ch.material.opacity);
      out.push(gasPart(c).children[0].material.opacity);
    }
    return out;
  };

  it('is a pure function of the pose', () => {
    for (const psi of [30, 100, 450, 700]) {
      at(psi); const a = snapshot();
      at(psi + 237); at(psi + 400);
      at(psi); expect(snapshot()).toEqual(a);
    }
  });

  it('phase logic of cylinder 1 (charge, streams, flame)', () => {
    at(450);
    expect(visCount(charge(1))).toBeGreaterThan(0); expect(visCount(charge(1))).toBeLessThan(M);
    expect(streamsOn(1, 'in')).toBe(true); expect(streamsOn(1, 'ex')).toBe(false);
    at(630);
    expect(visCount(charge(1))).toBe(M);
    expect(streamsOn(1, 'in') || streamsOn(1, 'ex')).toBe(false);
    at(270);
    expect(streamsOn(1, 'ex')).toBe(true); expect(streamsOn(1, 'in')).toBe(false);
    expect(visCount(charge(1))).toBeGreaterThan(0); expect(visCount(charge(1))).toBeLessThan(M);
    // valve overlap: both valves have a (small) lift
    at(360);
    expect(streamsOn(1, 'in') && streamsOn(1, 'ex')).toBe(true);
    // exhaust drains completely, intake starts empty
    at(358); expect(visCount(charge(1))).toBeLessThan(10);
    // engine off: no flame effects, but the pump still works
    const pOff = poseAt({ crank: rad(450) }); for (const s of pOff.cylinders) { s.burn = 0; s.spark = false; }
    assembly.update(pOff); expect(streamsOn(1, 'in')).toBe(true); expect(root.getObjectByName('flameGlow1').visible).toBe(false);
  });

  it('flame front spreads from the plug tip', () => {
    let psi = 700, st;
    for (; psi < 720; psi += 0.5) { st = gasState(psi); if (st.burn > 0.05) break; }
    expect(st.burn).toBeGreaterThan(0.05);
    const tipY = apex - E.head.sparkPlug.tipProtrusion - 1;
    const probe = (psiDeg) => {
      at(psiDeg % 720);
      const im = charge(1), v = new THREE.Vector3(), burned = [];
      let near = -1, far = -1, dn = Infinity, df = -1;
      for (let k = 0; k < M; k++) {
        pos(im, k, v);
        const d = Math.hypot(v.x, v.y - tipY, v.z);
        const col = im.instanceColor.array.slice(k * 3, k * 3 + 3);
        burned[k] = col[2] < 0.75;                      // violet / blue are ~1 in blue, flame colours are not
        if (d < dn) { dn = d; near = k; } if (d > df) { df = d; far = k; }
      }
      return { burned, near, far };
    };
    const early = probe(psi);
    expect(early.burned.some(Boolean)).toBe(true);
    expect(early.burned[early.near]).toBe(true);
    expect(early.burned[early.far]).toBe(false);
    expect(root.getObjectByName('flameGlow1').visible).toBe(true);
    const late = probe(20);
    expect(late.burned.filter(Boolean).length).toBeGreaterThan(early.burned.filter(Boolean).length);
  });

  it('charge particles stay inside the cylinder between crown and roof', () => {
    const v = new THREE.Vector3();
    for (let c = 1; c <= 4; c++) for (let psi = 0; psi <= 720; psi += 15) {
      at(psi % 720 + (c - 1) * 0);
      const crown = pistonCrownY(throwAngle(rad(psi % 720), c - 1));
      const im = charge(c);
      for (let k = 0; k < M; k++) {
        if (im.instanceMatrix.array[k * 16] <= 0) continue;
        pos(im, k, v);
        expect(Math.hypot(v.x, v.z)).toBeLessThan(R);
        expect(v.y).toBeGreaterThan(crown);
        expect(v.y).toBeLessThan(apex - Math.abs(v.z) * Math.tan(gam));
      }
    }
  });

  it('streams flow in the right direction and stay in voids (port, neck, pocket or bore)', () => {
    const v = new THREE.Vector3(), p = new THREE.Vector3(), prev = new THREE.Vector3();
    const seatY = D.valve.in.seat(0, 0)[1];
    for (const [kind, from, to, sign] of [['in', 380, 520, -1], ['ex', 200, 340, -1]]) {
      const im = stream(1, kind, 'a');
      let moved = 0, ended = false;
      let havePrev = false;
      for (let psi = from; psi <= to; psi += 2) {
        at(psi);
        expect(im.visible).toBe(true);
        const f = portFrame(SPEC, L, kind, 0), d = SPEC.engine.valves.seatGap + valveLift(kind, 0, rad(psi));
        const ax = new THREE.Vector3(...f.a), dir = new THREE.Vector3(...f.dir), q0 = new THREE.Vector3(...f.q0), seat = new THREE.Vector3(...f.seat);
        for (let j = 0; j < 14; j++) {
          if (im.instanceMatrix.array[j * 16] <= 0) continue;
          pos(im, j, v);
          const rel = v.clone().sub(q0), t = rel.dot(dir), lat = rel.clone().addScaledVector(dir, -t).length();
          const relS = v.clone().sub(seat), ta = relS.dot(ax), latV = relS.clone().addScaledVector(ax, -ta).length();
          const inPort = t > -2 && lat < f.portR, inNeck = ta > -d - 2 && ta < 16 && latV < f.rNeck + 0.5, inPocket = ta < 2.5 && latV < f.rh + 0.4;
          const inBore = Math.hypot(v.x, v.z) < R && v.y < apex;
          expect(inPort || inNeck || inPocket || inBore, `${kind} j=${j} psi=${psi} at ${v.toArray().map(x => x.toFixed(1))}`).toBe(true);
        }
        if (im.instanceMatrix.array[0 * 16] > 0) {
          pos(im, 0, v);
          if (havePrev && v.distanceTo(prev) < 20) { moved++; expect(v.z - prev.z).toBeLessThanOrEqual(1e-9); }
          prev.copy(v); havePrev = true;
        } else havePrev = false;
        if (kind === 'in' && psi === 520) {
          let minY = Infinity; for (let j = 0; j < 14; j++) { if (im.instanceMatrix.array[j * 16] > 0) { pos(im, j, v); minY = Math.min(minY, v.y); } }
          ended = minY < seatY;
        }
      }
      expect(moved).toBeGreaterThan(10);
      if (kind === 'in') expect(ended).toBe(true);
    }
  });

  it('exhaust streams end inside the manifold stub, intake streams start there', () => {
    const v = new THREE.Vector3();
    for (const kind of ['in', 'ex']) {
      const f = portFrame(SPEC, L, kind, 0);
      let far = 0;
      for (let psi = (kind === 'in' ? 400 : 200); psi < (kind === 'in' ? 520 : 340); psi += 3) {
        at(psi); const im = stream(1, kind, 'a');
        for (let j = 0; j < 14; j++) { pos(im, j, v); if (im.instanceMatrix.array[j * 16] > 0) far = Math.max(far, Math.abs(v.z)); }
      }
      expect(far).toBeGreaterThan(78 + 40);
      expect(far).toBeLessThan(78 + 70);
    }
  });

  it('instance budget', () => {
    let inst = 0, tris = 0;
    root.traverse(o => { if (o.isInstancedMesh && /^gas/.test(o.name)) { inst += o.count; tris += o.count * o.geometry.attributes.position.count / 3; } });
    console.log(`gas instances ${inst}, triangles ${tris}`);
    expect(inst).toBeLessThanOrEqual(1500); expect(tris).toBeLessThan(60000);
  });
});
