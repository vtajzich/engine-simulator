import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

// Small geometry helpers for the shift mechanism / gear case. All "2D" points are [y, z] pairs in the YZ plane;
// solids are extruded along X.

// (a, b, e) -> (X = e, Y = a, Z = b): proper rotation (det +1), shape plane -> YZ, extrusion axis -> X
const TO_X = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

export function circlePts(cy, cz, r, n) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cy + r * Math.cos(a), cz + r * Math.sin(a)]); }
  return p;
}

/** Rounded rectangle y0..y1 × z0..z1 with corner radius rc. */
export function roundedRect(y0, y1, z0, z1, rc, seg = 8) {
  const p = [];
  const corner = (cy, cz, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; p.push([cy + rc * Math.cos(a), cz + rc * Math.sin(a)]); } };
  corner(y1 - rc, z1 - rc, 0);                // top, +z
  corner(y0 + rc, z1 - rc, Math.PI / 2);      // bottom, +z
  corner(y0 + rc, z0 + rc, Math.PI);          // bottom, -z
  corner(y1 - rc, z0 + rc, 1.5 * Math.PI);    // top, -z
  return p;
}

/** Annular sector r0..r1 between angles a0..a1 (angle from +Y toward +Z). */
export function sectorPts(r0, r1, a0, a1, stepDeg = 2) {
  const n = Math.max(2, Math.ceil(((a1 - a0) * 180 / Math.PI) / stepDeg));
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([r1 * Math.cos(a), r1 * Math.sin(a)]); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; p.push([r0 * Math.cos(a), r0 * Math.sin(a)]); }
  return p;
}

/** Polygon (with optional holes) extruded along X from x0 to x1. */
export function extrudeX(outer, x0, x1, holes = []) {
  const v = ([y, z]) => new THREE.Vector2(y, z);
  const shape = new THREE.Shape(outer.map(v));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(v)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, steps: 1 });
  g.applyMatrix4(TO_X);
  g.translate(x0, 0, 0);
  return g;
}

/** Box with X range x0..x1 whose YZ footprint is centred (cy, cz), `a` half-length along direction `ang`
 *  (angle from +Y toward +Z) and `b` half-width across it. */
export function boxX(x0, x1, cy, cz, ang, a, b) {
  const g = new THREE.BoxGeometry(x1 - x0, 2 * a, 2 * b);
  g.rotateX(ang);
  g.translate((x0 + x1) / 2, cy, cz);
  return g;
}

/** Straight slab in the YZ plane from p0 to p1 (both [y, z]), extended `ext` beyond both ends. */
export function slabX(x0, x1, p0, p1, width, ext = width / 2) {
  const dy = p1[0] - p0[0], dz = p1[1] - p0[1], len = Math.hypot(dy, dz);
  return boxX(x0, x1, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, Math.atan2(dz, dy), len / 2 + ext, width / 2);
}

const plain = (g) => {
  const o = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal') o.deleteAttribute(k);
  if (!o.attributes.normal) o.computeVertexNormals();
  return o;
};

/** Merge several (possibly overlapping) closed solids into one geometry. */
export function mergeSolids(list) {
  return mergeGeometries(list.map(plain), false);
}

/** CSG: geometry minus each cutter geometry. */
export function subtract(geometry, cutters) {
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  let a = new Brush(plain(geometry));
  a.updateMatrixWorld();
  for (const c of cutters) {
    const b = new Brush(plain(c));
    b.updateMatrixWorld();
    a = ev.evaluate(a, b, SUBTRACTION);
    a.updateMatrixWorld();
  }
  return a.geometry;
}
