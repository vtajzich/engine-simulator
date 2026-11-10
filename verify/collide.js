// Reusable mesh-collision framework (Node-safe: three + three-mesh-bvh only). See docs/plan/D-collision-framework.md.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const MIN_AREA2 = 1e-12; // squared cross-product length below which a triangle is degenerate

const _cache = new WeakMap();
const _inv = new THREE.Matrix4();
const _rel = new THREE.Matrix4();
const _m = new THREE.Matrix4();
const _inst = new THREE.Matrix4();
const _v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();

/** Collect rigid bodies from an assembly root. Returns Map<bodyName, Body>.
 *  Body = { name, static, anchor, geometry, bvh, partIds, parts, localBox, triangleCount }
 *  (`parts` = part Object3Ds, an addition used by the rigidity helpers). bvh is null when a body has no triangles.
 *  Results are cached per root; pass { cache: false } to rebuild. */
export function collectBodies(root, { cache = true } = {}) {
  if (cache && _cache.has(root)) return _cache.get(root);
  root.updateMatrixWorld(true);

  const bodies = new Map();
  const seenIds = new Set();
  const meshesOf = new Map(); // bodyName -> Mesh[]

  const visit = (obj, part) => {
    const p = obj.userData && obj.userData.part;
    if (p) {
      if (seenIds.has(p.id)) throw new Error(`collectBodies: duplicate part id "${p.id}"`);
      seenIds.add(p.id);
      let body = bodies.get(p.body);
      if (!body) {
        body = { name: p.body, static: !!p.static, anchor: obj, geometry: null, bvh: null, partIds: [], parts: [],
          localBox: new THREE.Box3(), triangleCount: 0, _wbox: new THREE.Box3() };
        bodies.set(p.body, body);
        meshesOf.set(p.body, []);
      } else if (body.static !== !!p.static) {
        throw new Error(`collectBodies: parts of body "${p.body}" disagree on static (part "${p.id}")`);
      }
      body.partIds.push(p.id);
      body.parts.push(obj);
      part = p;
    }
    if (obj.isMesh && obj.userData.noCollide !== true && obj.geometry && obj.geometry.attributes.position) {
      if (!part) throw new Error(`collectBodies: mesh "${obj.name || obj.uuid}" has no part ancestor`);
      meshesOf.get(part.body).push(obj);
    }
    for (const c of obj.children) visit(c, part);
  };
  visit(root, null);

  for (const body of bodies.values()) {
    _inv.copy(body.anchor.matrixWorld).invert();
    const chunks = [];
    let total = 0;
    for (const mesh of meshesOf.get(body.name)) {
      const pos = mesh.geometry.attributes.position;
      const index = mesh.geometry.index;
      const triCount = index ? Math.floor(index.count / 3) : Math.floor(pos.count / 3);
      const n = mesh.isInstancedMesh ? mesh.count : 1;
      for (let k = 0; k < n; k++) {
        _m.multiplyMatrices(_inv, mesh.matrixWorld);
        if (mesh.isInstancedMesh) { mesh.getMatrixAt(k, _inst); _m.multiply(_inst); }
        const out = new Float32Array(triCount * 9);
        let o = 0;
        for (let t = 0; t < triCount; t++) {
          for (let j = 0; j < 3; j++) {
            const vi = index ? index.getX(t * 3 + j) : t * 3 + j;
            _v[j].set(pos.getX(vi), pos.getY(vi), pos.getZ(vi)).applyMatrix4(_m);
          }
          _e1.subVectors(_v[1], _v[0]);
          _e2.subVectors(_v[2], _v[0]);
          const a2 = _e1.cross(_e2).lengthSq();
          if (!(a2 > MIN_AREA2)) continue; // also drops NaN
          for (let j = 0; j < 3; j++) { out[o++] = _v[j].x; out[o++] = _v[j].y; out[o++] = _v[j].z; }
        }
        chunks.push(o === out.length ? out : out.slice(0, o));
        total += o;
      }
    }
    const all = new Float32Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(all, 3));
    body.geometry = geometry;
    body.triangleCount = total / 9;
    if (body.triangleCount > 0) {
      body.localBox.setFromBufferAttribute(geometry.attributes.position);
      body.bvh = new MeshBVH(geometry);
      geometry.boundsTree = body.bvh;
    }
    body.partIds = body.partIds.slice();
  }

  if (cache) _cache.set(root, bodies);
  return bodies;
}

/** Snapshot of every part's transform relative to its body anchor: Map partId -> Matrix4. */
export function snapshotRigidity(root) {
  root.updateMatrixWorld(true);
  const snap = new Map();
  for (const body of collectBodies(root).values()) {
    _inv.copy(body.anchor.matrixWorld).invert();
    body.parts.forEach((p, i) => snap.set(body.partIds[i], new THREE.Matrix4().multiplyMatrices(_inv, p.matrixWorld)));
  }
  return snap;
}

/** Parts whose anchor-relative transform differs from `snapshot` (> 1e-6): [{ partId, body }]. */
export function rigidityViolations(root, snapshot) {
  root.updateMatrixWorld(true);
  const out = [];
  for (const body of collectBodies(root).values()) {
    _inv.copy(body.anchor.matrixWorld).invert();
    body.parts.forEach((p, i) => {
      const id = body.partIds[i];
      const ref = snapshot.get(id);
      if (!ref) return;
      _rel.multiplyMatrices(_inv, p.matrixWorld);
      for (let k = 0; k < 16; k++) {
        if (Math.abs(_rel.elements[k] - ref.elements[k]) > 1e-6) { out.push({ partId: id, body: body.name }); break; }
      }
    });
  }
  return out;
}

const _ma = new THREE.Matrix4();
const _mb = new THREE.Matrix4();

function narrow(a, b, matrixBtoA) {
  if (!a.bvh || !b.bvh) return false;
  return a.bvh.intersectsGeometry(b.geometry, matrixBtoA);
}

/** All colliding pairs in the current pose: [{ a, b }] with a < b. options: { ignore(a,b), only(a,b) }. */
export function findCollisions(bodies, options = {}) {
  const { ignore, only } = options;
  const list = [...bodies.values()].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  for (const b of list) b._wbox.copy(b.localBox).applyMatrix4(b.anchor.matrixWorld);
  const result = [];
  for (let i = 0; i < list.length; i++) {
    const A = list[i];
    if (!A.bvh) continue;
    for (let j = i + 1; j < list.length; j++) {
      const B = list[j];
      if (!B.bvh || (A.static && B.static)) continue;
      if (!A._wbox.intersectsBox(B._wbox)) continue;
      if (ignore && ignore(A.name, B.name)) continue;
      if (only && !only(A.name, B.name)) continue;
      _ma.copy(A.anchor.matrixWorld).invert();
      _mb.multiplyMatrices(_ma, B.anchor.matrixWorld);
      if (narrow(A, B, _mb)) result.push({ a: A.name, b: B.name });
    }
  }
  return result;
}

function need(bodies, name) {
  const b = bodies.get(name);
  if (!b) throw new Error(`unknown body "${name}"`);
  return b;
}

/** True if the two named bodies intersect in the current pose. */
export function bodiesIntersect(bodies, a, b) {
  const A = need(bodies, a), B = need(bodies, b);
  _ma.copy(A.anchor.matrixWorld).invert();
  _mb.multiplyMatrices(_ma, B.anchor.matrixWorld);
  return narrow(A, B, _mb);
}

const _disp = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _ax = new THREE.Vector3();

/** Intersection test with body `a` displaced in world space (does not modify the scene). Rotation by `angle` about the
 *  axis through `axisPoint` (default origin) with direction `axisDir`, applied first, then translation by `offset`. */
export function bodiesIntersectDisplaced(bodies, a, b, { offset, angle, axisPoint, axisDir } = {}) {
  const A = need(bodies, a), B = need(bodies, b);
  _disp.identity();
  if (angle && axisDir) {
    _ax.copy(axisDir).normalize();
    _q.setFromAxisAngle(_ax, angle);
    const p = axisPoint || _ax.set(0, 0, 0);
    _disp.makeTranslation(p.x, p.y, p.z);
    _disp.multiply(_t.makeRotationFromQuaternion(_q));
    _disp.multiply(_t.makeTranslation(-p.x, -p.y, -p.z));
  }
  if (offset) _disp.premultiply(_t.makeTranslation(offset.x, offset.y, offset.z));
  // A displaced: worldA' = disp * worldA ; matrix maps A's geometry into B's frame.
  _ma.copy(B.anchor.matrixWorld).invert();
  _mb.multiplyMatrices(_disp, A.anchor.matrixWorld);
  _mb.premultiply(_ma);
  if (!A.bvh || !B.bvh) return false;
  return B.bvh.intersectsGeometry(A.geometry, _mb);
}

const _off = new THREE.Vector3();

/** Smallest t in [0, max] at which translating `a` by t*dir makes it intersect `b` (0 if already intersecting,
 *  Infinity if none up to max). Steps by `step`, then bisects to `tol`. Obstacles thinner than `step` can be missed. */
export function clearanceAlong(bodies, a, b, dir, { max = 20, step = 0.25, tol = 0.01 } = {}) {
  const d = dir.clone().normalize();
  const hit = (t) => bodiesIntersectDisplaced(bodies, a, b, { offset: _off.copy(d).multiplyScalar(t) });
  if (hit(0)) return 0;
  let lo = 0;
  for (let t = step; ; t += step) {
    const tt = Math.min(t, max);
    if (hit(tt)) {
      let hi = tt;
      while (hi - lo > tol) {
        const mid = (lo + hi) / 2;
        if (hit(mid)) hi = mid; else lo = mid;
      }
      return hi;
    }
    lo = tt;
    if (tt >= max) return Infinity;
  }
}

/** Run findCollisions over `poses` ({ label, pose }). Returns { samples, collisions: Map<"a|b", {a,b,count,first,labels}> }. */
export function sweep(assembly, bodies, poses, options = {}) {
  const collisions = new Map();
  let samples = 0;
  for (const { label, pose } of poses) {
    assembly.update(pose);
    if (assembly.group) assembly.group.updateMatrixWorld(true);
    else for (const b of bodies.values()) b.anchor.updateWorldMatrix(true, false);
    samples++;
    for (const { a, b } of findCollisions(bodies, options)) {
      const key = `${a}|${b}`;
      let e = collisions.get(key);
      if (!e) { e = { a, b, count: 0, first: label, labels: [] }; collisions.set(key, e); }
      e.count++;
      if (e.labels.length < 5) e.labels.push(label);
    }
  }
  return { samples, collisions };
}

/** Human-readable report of a sweep result. */
export function formatCollisions(result) {
  if (result.collisions.size === 0) return `no collisions in ${result.samples} samples`;
  const lines = [`${result.collisions.size} colliding pair(s) in ${result.samples} samples:`];
  for (const e of result.collisions.values()) {
    lines.push(`  ${e.a} x ${e.b}: ${e.count} sample(s), first at ${e.first}${e.count > 1 ? ` (e.g. ${e.labels.join(', ')})` : ''}`);
  }
  return lines.join('\n');
}
