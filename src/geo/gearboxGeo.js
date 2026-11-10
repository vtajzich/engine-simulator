// Low-level helpers for the gearbox geometry: raw non-indexed triangle soups (Float32Array of xyz triples),
// revolution of a closed (x, r) profile about the X axis, winding repair, mirroring. Node-safe.
import * as THREE from 'three';

/** Signed volume of a closed triangle soup (positive = outward-facing winding). */
export function signedVolume(pos) {
  let v = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
    const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

/** Flip every triangle in place so the shell has positive volume. */
export function fixWinding(pos) {
  if (signedVolume(pos) < 0) flipWinding(pos);
  return pos;
}

export function flipWinding(pos) {
  for (let i = 0; i < pos.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t;
    }
  }
  return pos;
}

/** Growable triangle soup. */
export class Soup {
  constructor() { this.a = []; }
  tri(p, q, r) { this.a.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]); }
  quad(p, q, r, s) { this.tri(p, q, r); this.tri(p, r, s); }
  toArray() { return Float32Array.from(this.a); }
}

/** Revolve a closed profile [[x, r], ...] about the X axis (angle from +Y toward +Z). */
export function revolveX(profile, segments = 64) {
  const s = new Soup();
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const [x0, r0] = profile[i], [x1, r1] = profile[(i + 1) % n];
    if (r0 === 0 && r1 === 0) continue;
    for (let j = 0; j < segments; j++) {
      const a0 = 2 * Math.PI * j / segments, a1 = 2 * Math.PI * (j + 1) / segments;
      const p00 = [x0, r0 * Math.cos(a0), r0 * Math.sin(a0)], p01 = [x0, r0 * Math.cos(a1), r0 * Math.sin(a1)];
      const p10 = [x1, r1 * Math.cos(a0), r1 * Math.sin(a0)], p11 = [x1, r1 * Math.cos(a1), r1 * Math.sin(a1)];
      if (r0 === 0) s.tri(p00, p10, p11);
      else if (r1 === 0) s.tri(p00, p11, p01);
      else s.quad(p00, p10, p11, p01);
    }
  }
  return fixWinding(s.toArray());
}

/** Map x -> offset + sign * x (sign = -1 mirrors, keeping outward winding). Returns a new array. */
export function placeX(pos, sign, offset = 0) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    out[i] = offset + sign * pos[i]; out[i + 1] = pos[i + 1]; out[i + 2] = pos[i + 2];
  }
  return sign < 0 ? flipWinding(out) : out;
}

export function translate(pos, dx = 0, dy = 0, dz = 0) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) { out[i] = pos[i] + dx; out[i + 1] = pos[i + 1] + dy; out[i + 2] = pos[i + 2] + dz; }
  return out;
}

export function concat(list) {
  let n = 0;
  for (const a of list) n += a.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const a of list) { out.set(a, o); o += a.length; }
  return out;
}

/** Flat-shaded BufferGeometry from a triangle soup. */
export function soupGeometry(pos) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Positions of a (possibly indexed) geometry as a plain soup. */
export function geometryToSoup(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  return g.attributes.position.array;
}
