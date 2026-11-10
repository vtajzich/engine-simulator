// Valve, retainer, bucket tappet and spring geometry (local frame: origin at the seat point, +Y = valve axis).
import * as THREE from 'three';
import { segs } from './parts.js';

function signedVolume(g) {
  const p = g.attributes.position, idx = g.index;
  const n = idx ? idx.count : p.count;
  let v = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
    v += a.dot(b.cross(c)) / 6;
  }
  return v;
}

/** Closed solid of revolution about Y from (r, y) points; reversed automatically so that the volume is positive. */
export function latheSolid(points, n) {
  let g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), n);
  if (signedVolume(g) < 0) g = new THREE.LatheGeometry(points.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), n);
  return g;
}

/** @returns {{valve, retainer, bucket, spring, t0}} geometries; `spring` runs along +Y from 0 to springLen. */
export function buildValveGeometries(spec, L, kind, headRadius, springBaseT) {
  const E = spec.engine, V = E.valves, VT = E.valvetrain;
  const rh = headRadius, rs = V.stemDiameter / 2, ht = V.headThickness, len = V.length;
  const rNeck = rh - 3, rt0 = rNeck - 1.0;
  const n = Math.max(64, segs(rh));
  const prof = [[0, 0], [rh, 0], [rh, ht], [rt0, ht]];
  const N = 14;
  for (let k = 1; k <= N; k++) {
    const u = k / N;
    prof.push([rs + (rt0 - rs) * (1 - u) * (1 - u), ht + u * L.tulipLength]);
  }
  prof.push([rs, len], [0, len]);
  const valve = latheSolid(prof, n);

  const rr = L.retainerRadius, ry = len - L.retainerFromTip;
  const retainer = latheSolid([[0, ry], [rr, ry], [rr, ry + L.retainerThickness], [0, ry + L.retainerThickness]], 48);

  const top = len + VT.bucketTopThickness, bot = top - VT.bucketHeight;
  const ro = VT.bucketDiameter / 2, ri = ro - L.bucketWall;
  const bucket = latheSolid([[0, len], [ri, len], [ri, bot], [ro, bot], [ro, top], [0, top]], 64);

  // helix spring from the head top (t = springBaseT) up to the retainer underside
  const springLen = ry - springBaseT - V.seatGap;
  const rm = (VT.springOD - VT.springWire) / 2, turns = VT.springCoils, per = 20;
  const cp = [];
  for (let i = 0; i <= turns * per; i++) {
    const a = 2 * Math.PI * i / per;
    cp.push(new THREE.Vector3(rm * Math.cos(a), springLen * i / (turns * per), rm * Math.sin(a)));
  }
  const spring = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), turns * per * 2, VT.springWire / 2, 8, false);
  return { valve, retainer, bucket, spring, springLen };
}
