// Camshaft lobes, shafts, toothed sprockets and the timing-belt path.
import * as THREE from 'three';
import { lobeOutline } from '../kin/cam.js';

// shape (x, y, depth) -> (Y, Z, X) : cyclic permutation, proper rotation
const toAxisX = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

/** Lobe solid: outline [y, z] in the camshaft frame, extruded along X, centred at x = xc. */
export function lobeGeometry(kind, cyl, width, xc, n = 360) {
  const shape = new THREE.Shape(lobeOutline(kind, cyl, n).map(([y, z]) => new THREE.Vector2(y, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  g.applyMatrix4(toAxisX);
  g.translate(xc - width / 2, 0, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Cylinder about X from x0 to x1. */
export function shaftGeometry(r, x0, x1, n = 48) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, n, 1, false);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

/** Toothed belt sprocket about X, centred at xc. boreR > 0 cuts a bore. Returns merged geometry. */
export function sprocketGeometry(teeth, pitch, width, xc, boreR = 0) {
  const rp = teeth * pitch / (2 * Math.PI), P = 2 * Math.PI / teeth;
  const tip = rp - 0.6, root = rp - 2.6;
  const pol = (r, a) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  const pts = [];
  for (let k = 0; k < teeth; k++) {
    const a = k * P;
    pts.push(pol(root, a - 0.30 * P), pol(tip, a - 0.18 * P), pol(tip, a + 0.18 * P), pol(root, a + 0.30 * P), pol(root, a + 0.5 * P));
  }
  const shape = new THREE.Shape(pts);
  if (boreR > 0) {
    const h = new THREE.Path();
    h.setFromPoints(Array.from({ length: 64 }, (_, k) => pol(boreR, 2 * Math.PI * k / 64)));
    shape.holes.push(h);
  }
  const body = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  body.applyMatrix4(toAxisX);
  body.translate(xc - width / 2, 0, 0);
  body.deleteAttribute('uv');
  return { body, rp, tip, root };
}

export function flangeGeometry(rOut, rIn, x0, x1) {
  const shape = new THREE.Shape();
  const n = 96;
  shape.setFromPoints(Array.from({ length: n }, (_, k) => new THREE.Vector2(rOut * Math.cos(2 * Math.PI * k / n), rOut * Math.sin(2 * Math.PI * k / n))));
  if (rIn > 0) {
    const h = new THREE.Path();
    h.setFromPoints(Array.from({ length: 64 }, (_, k) => new THREE.Vector2(rIn * Math.cos(2 * Math.PI * k / 64), rIn * Math.sin(2 * Math.PI * k / 64))));
    shape.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false });
  g.applyMatrix4(toAxisX);
  g.translate(x0, 0, 0);
  g.deleteAttribute('uv');
  return g;
}

/**
 * Closed belt path around circles [{p, q, r}] in the (p, q) = (Y, Z) plane (positive rotation = CCW), convex hull,
 * traversed CCW. `at(s, off, out)` -> out = { p, q, nAngle } at arc length s on the pitch path, offset `off` outward.
 */
export function beltPath(circles0) {
  const c = circles0.slice();
  const cross = (a, b, d) => (b.p - a.p) * (d.q - a.q) - (b.q - a.q) * (d.p - a.p);
  if (cross(c[0], c[1], c[2]) < 0) { const t = c[1]; c[1] = c[2]; c[2] = t; }
  const n = c.length;
  const segs = [];
  const nAng = [];
  const tang = [];
  for (let i = 0; i < n; i++) {
    const A = c[i], B = c[(i + 1) % n];
    const dx = B.p - A.p, dy = B.q - A.q, Ld = Math.hypot(dx, dy);
    const d = [dx / Ld, dy / Ld], cc = (A.r - B.r) / Ld, ss = Math.sqrt(1 - cc * cc);
    const w = [d[1], -d[0]];
    const nv = [cc * d[0] + ss * w[0], cc * d[1] + ss * w[1]];
    tang.push({ d, nv, A, B });
    nAng.push(Math.atan2(nv[1], nv[0]));
  }
  let s = 0;
  const wrap = a => { let r = a % (2 * Math.PI); if (r < 0) r += 2 * Math.PI; return r; };
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n;
    const a0 = nAng[prev], da = wrap(nAng[i] - nAng[prev]);
    const C = c[i];
    segs.push({ type: 'arc', s0: s, len: C.r * da, C, a0, da });
    s += C.r * da;
    const { d, nv, A, B } = tang[i];
    const P0 = [A.p + A.r * nv[0], A.q + A.r * nv[1]], P1 = [B.p + B.r * nv[0], B.q + B.r * nv[1]];
    const len = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
    segs.push({ type: 'line', s0: s, len, P0, d, nv, nAngle: nAng[i] });
    s += len;
  }
  const total = s;
  function at(sv, off, out) {
    let t = sv % total; if (t < 0) t += total;
    let k = 0;
    while (k < segs.length - 1 && t >= segs[k].s0 + segs[k].len) k++;
    const g = segs[k], u = t - g.s0;
    if (g.type === 'arc') {
      const a = g.a0 + u / g.C.r;
      const rr = g.C.r + off;
      out.p = g.C.p + rr * Math.cos(a); out.q = g.C.q + rr * Math.sin(a); out.nAngle = a;
    } else {
      out.p = g.P0[0] + g.d[0] * u + off * g.nv[0]; out.q = g.P0[1] + g.d[1] * u + off * g.nv[1]; out.nAngle = g.nAngle;
    }
    return out;
  }
  /** Closed outline polyline at offset `off` (arcs sampled every ~3 degrees). */
  function outline(off) {
    const pts = [];
    for (const g of segs) {
      if (g.type === 'arc') {
        const steps = Math.max(1, Math.ceil(g.da / (Math.PI / 60)));
        for (let k = 0; k <= steps; k++) {
          const a = g.a0 + g.da * k / steps, rr = g.C.r + off;
          pts.push(new THREE.Vector2(g.C.p + rr * Math.cos(a), g.C.q + rr * Math.sin(a)));
        }
      } else {
        pts.push(new THREE.Vector2(g.P0[0] + off * g.nv[0], g.P0[1] + off * g.nv[1]));
        pts.push(new THREE.Vector2(g.P0[0] + g.d[0] * g.len + off * g.nv[0], g.P0[1] + g.d[1] * g.len + off * g.nv[1]));
      }
    }
    // drop consecutive duplicates
    return pts.filter((v, i) => i === 0 || v.distanceToSquared(pts[i - 1]) > 1e-9);
  }
  return { total, at, outline, segs };
}

export function beltBandGeometry(path, offIn, offOut, width, xc) {
  const shape = new THREE.Shape(path.outline(offOut));
  const h = new THREE.Path();
  h.setFromPoints(path.outline(offIn));
  shape.holes.push(h);
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  g.applyMatrix4(toAxisX);
  g.translate(xc - width / 2, 0, 0);
  g.deleteAttribute('uv');
  return g;
}
