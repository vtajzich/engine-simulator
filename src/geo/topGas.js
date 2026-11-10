// Gas-exchange helpers for src/model/topEnd.js: deterministic charge cloud, port frames (the same numbers that cut the
// ports in topHead.js) and the static manifold stubs. Pure geometry / numbers, runs in Node.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPEC } from '../spec.js';
import { derive } from '../kin/derive.js';
import { latheSolid } from './topValve.js';

const halton = (i, b) => { let f = 1, r = 0; for (let n = i + 1; n > 0; n = Math.floor(n / b)) { f /= b; r += f * (n % b); } return r; };

export const MANIFOLD_LEN = 60, MANIFOLD_WALL = 2.5, MANIFOLD_EMBED = 8;

/**
 * Fixed deterministic cloud of M points in the cylinder (coordinates relative to the cylinder axis).
 * rho in [0,1) of (R - 2), phi, h in (0,1) fraction of the column height; rankIn[k] = order of appearance during intake
 * (nearest the intake valves first), rankEx[k] = order of leaving during exhaust (nearest the exhaust valves first
 * to leave, i.e. the LARGEST rank).
 */
export function chargeCloud(spec = SPEC, M = 140) {
  const D = derive(spec), Rr = D.R - 2;
  const x = new Float64Array(M), z = new Float64Array(M), h = new Float64Array(M);
  for (let k = 0; k < M; k++) {
    const rho = Math.sqrt(halton(k, 2)) * Rr, phi = 2 * Math.PI * halton(k, 3);
    x[k] = rho * Math.cos(phi); z[k] = rho * Math.sin(phi); h[k] = 0.04 + 0.92 * halton(k, 5);
  }
  const rank = (kind, sign) => {
    const seats = [D.valve[kind].seat(0, 0), D.valve[kind].seat(0, 1)];
    const score = Array.from({ length: M }, (_, k) => Math.min(...seats.map(s => Math.hypot(x[k] - (s[0] - D.cylX[0]), z[k] - s[2]))));
    const order = score.map((s, k) => k).sort((p, q) => score[p] - score[q] || p - q);
    const r = new Int32Array(M);
    order.forEach((k, i) => { r[k] = sign > 0 ? i : M - 1 - i; });
    return r;
  };
  return { M, x, z, h, rankIn: rank('in', 1), rankEx: rank('ex', -1) };
}

/** Frame of one port (cylinder 1): seat, valve axis a, outward direction o (both unit, in the YZ plane), port line. */
export function portFrame(spec, L, kind, which) {
  const D = derive(spec), V = spec.engine.valves, vd = D.valve[kind], g = D.gamma, side = vd.side;
  const seat = vd.seat(0, which);
  const a = [0, Math.cos(g), side * Math.sin(g)], o = [0, -Math.sin(g), side * Math.cos(g)];
  const tilt = L.portTiltDeg * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
  const dir = [0, ct * a[1] + st * o[1], ct * a[2] + st * o[2]];
  const q0 = [seat[0] + L.portStart * a[0], seat[1] + L.portStart * a[1], seat[2] + L.portStart * a[2]];
  const rh = vd.headRadius, rNeck = rh - 3, portR = rNeck - 0.7;
  const tFace = (side * L.halfZ - q0[2]) / dir[2];      // where the port axis leaves the head face
  return { kind, which, side, seat, a, o, dir, q0, rh, rNeck, portR, tFace, headThickness: V.headThickness };
}

/** Intake runners (+Z) or exhaust stubs (-Z): one tube per port and cylinder, merged. Static, open at both ends. */
export function buildManifoldGeometry(spec, L, kind) {
  const D = derive(spec), geos = [];
  const up = new THREE.Vector3(0, 1, 0), dirV = new THREE.Vector3(), q = new THREE.Quaternion();
  for (const which of [0, 1]) {
    const f = portFrame(spec, L, kind, which);
    dirV.set(...f.dir);
    q.setFromUnitVectors(up, dirV);
    const t0 = f.tFace - MANIFOLD_EMBED, len = MANIFOLD_EMBED + MANIFOLD_LEN;
    for (const cx of D.cylX) {
      const g = latheSolid([[f.portR, 0], [f.portR + MANIFOLD_WALL, 0], [f.portR + MANIFOLD_WALL, len], [f.portR, len]], 48);
      g.applyQuaternion(q);
      g.translate(cx + f.q0[0] + f.dir[0] * t0, f.q0[1] + f.dir[1] * t0, f.q0[2] + f.dir[2] * t0);
      g.deleteAttribute('uv');
      geos.push(g);
    }
  }
  return mergeGeometries(geos);
}
