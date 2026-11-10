// Ignition geometry for src/model/topEnd.js: distributor rotor / base / cap, coil, plug boots and HT lead curves.
// Distributor parts are built in the frame of the intake camshaft axis (X along the axis, +Y = angle 0); the part groups
// sit on that axis. Boots are built about +Y with y = 0 at the roof apex. Coil and lead curves are in world coordinates.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPEC } from '../spec.js';
import { derive, rad } from '../kin/derive.js';
import { terminalAngle } from '../kin/ignition.js';
import { latheSolid } from './topValve.js';
import { segs } from './parts.js';

// shape (y, z, depth) -> (Y, Z, X)
const toAxisX = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

/** Prism along X from x0 to x1 with the (y, z) outline `pts`. */
function prismX(pts, x0, x1) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([y, z]) => new THREE.Vector2(y, z))), { depth: x1 - x0, bevelEnabled: false });
  g.applyMatrix4(toAxisX);
  g.translate(x0, 0, 0);
  g.deleteAttribute('uv');
  return g;
}
/** Solid of revolution about X from (r, x) points. */
function latheX(points, n) {
  const g = latheSolid(points, n);
  g.rotateZ(-Math.PI / 2);
  return g;
}
const cylX = (r, x0, x1, n, y = 0, z = 0) => {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, n, 1, false);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, z);
  return g;
};
const boxX = (x0, x1, y0, y1, z0, z1) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};
const radial = (r, a) => [r * Math.cos(a), r * Math.sin(a)];   // (y, z) at angle a from +Y toward +Z

const axisOf = spec => derive(spec).valve[spec.engine.ignition.drivenBy].camAxis;

/** Rotor group content, tip on local +Y: { shaft (steel), body (plastic hub + arm), tip (brass) }. */
export function buildRotorGeometries(spec, L) {
  const E = spec.engine, IG = E.ignition, R = IG.rotor, I = L.ign;
  const camX1 = E.block.rearX - 10;
  const rs = IG.shaftDiameter / 2;
  const shaft = cylX(rs, camX1, R.x[1], 48);
  const hub = cylX(I.hubRadius, R.x[0], R.x[1], 48);
  const arm = boxX(R.x[0] + I.armInset, R.x[1] - I.armInset, I.hubRadius - 1, R.tipRadius - I.tipDepth + 1, -I.armHalfWidth, I.armHalfWidth);
  const body = mergeGeometries([hub, arm]);
  const h = rad(R.tipHalfAngleDeg), N = 8, pts = [];
  for (let k = 0; k <= N; k++) pts.push(radial(R.tipRadius, -h + 2 * h * k / N));          // centre of the arc is a vertex
  for (let k = N; k >= 0; k--) pts.push(radial(R.tipRadius - I.tipDepth, -h + 2 * h * k / N));
  const tip = prismX(pts, R.x[0] + I.tipInset, R.x[1] - I.tipInset);
  return { shaft, body, tip };
}

/** Static distributor base: cup with a bore around the shaft plus a foot down to the head top. */
export function buildDistributorGeometry(spec, L) {
  const IG = spec.engine.ignition, B = IG.base, I = L.ign, ay = axisOf(spec).y;
  const rb = IG.shaftDiameter / 2 + I.boreClearance;
  const prof = [[rb, B.x[0]], [B.outerRadius, B.x[0]], [B.outerRadius, B.x[1]], [B.outerRadius - I.baseWall, B.x[1]],
    [B.outerRadius - I.baseWall, B.x[0] + I.baseFloor], [rb, B.x[0] + I.baseFloor], [rb, B.x[0]]];
  const cup = latheX(prof, segs(B.outerRadius));
  const foot = boxX(I.footX[0], I.footX[1], I.footBottomY - ay, I.footTopY - ay, -I.footHalfWidth, I.footHalfWidth);
  return mergeGeometries([cup, foot]);
}

/** Radius of the terminal post / tower axis from the distributor axis. */
export const towerRadius = (spec, L) => {
  const IG = spec.engine.ignition;
  return IG.rotor.tipRadius + IG.airGap + L.ign.postDepth / 2;
};

/** { shell (one mesh, capShell), posts[4] (by cylinder), contact } for the cap. */
export function buildCapGeometries(spec, L) {
  const E = spec.engine, IG = E.ignition, C = IG.cap, R = IG.rotor, I = L.ign;
  const n = segs(C.outerRadius), rc = towerRadius(spec, L);
  const xEnd = C.x[1] + C.towerLength;
  const rIn = C.outerRadius - C.wall;
  const cup = latheX([[0, C.x[1] - C.wall], [rIn, C.x[1] - C.wall], [rIn, C.x[0]], [C.outerRadius, C.x[0]], [C.outerRadius, C.x[1]], [0, C.x[1]]], n);
  const tower = (y, z) => {
    const x0 = C.x[1] - C.wall;
    const g = latheX([[I.towerInner, x0], [I.towerOuter, x0], [I.towerOuter, xEnd], [I.towerInner, xEnd], [I.towerInner, x0]], 48);
    g.translate(0, y, z);
    return g;
  };
  const parts = [cup, tower(0, 0)];
  const posts = [];
  for (let c = 0; c < E.cylinders; c++) {
    const a = terminalAngle(c), [ty, tz] = radial(rc, a);
    parts.push(tower(ty, tz));
    const post = boxX(R.x[0], xEnd - 1, R.tipRadius + IG.airGap, R.tipRadius + IG.airGap + I.postDepth, -I.postHalfWidth, I.postHalfWidth);
    post.rotateX(a);
    posts.push(post);
  }
  const contact = cylX(I.contactRadius, R.x[1] + I.contactGap, xEnd - 1, 32);
  return { shell: mergeGeometries(parts), posts, contact };
}

/** Mouth of the cap tower of cylinder `cyl` (0-based), world coordinates. */
export function towerMouth(spec, L, cyl) {
  const IG = spec.engine.ignition, ax = axisOf(spec), [y, z] = radial(towerRadius(spec, L), terminalAngle(cyl));
  return new THREE.Vector3(IG.cap.x[1] + IG.cap.towerLength, ax.y + y, ax.z + z);
}
/** Mouth of the centre tower (world). */
export function centreMouth(spec) {
  const IG = spec.engine.ignition, ax = axisOf(spec);
  return new THREE.Vector3(IG.cap.x[1] + IG.cap.towerLength, ax.y, ax.z);
}

/** Coil canister + HT tower + bracket (world coordinates, head body) and the top of its tower. */
export function buildCoilGeometry(spec, L) {
  const I = L.ign, K = I.coil, r = K.diameter / 2;
  const can = cylX(r, K.x0, K.x0 + K.length, 48, K.y, K.z);
  const tower = new THREE.CylinderGeometry(K.towerRadius, K.towerRadius, K.towerHeight, 32, 1, false);
  tower.translate(K.x0 + K.towerX, K.y + r + K.towerHeight / 2 - 2, K.z);
  const bracket = boxX(K.bracketX[0], K.bracketX[1], K.bracketY[0], K.bracketY[1], K.z - K.bracketHalfWidth, K.z + K.bracketHalfWidth);
  return { geometry: mergeGeometries([can, tower, bracket]), towerTop: new THREE.Vector3(K.x0 + K.towerX, K.y + r + K.towerHeight - 2, K.z) };
}

/** Plug boot about +Y, y = 0 at the roof apex. */
export function buildBootGeometry(spec, L) {
  const I = L.ign, y0 = L.plugTerminalTop - I.bootBelow, y1 = L.plugTerminalTop + I.bootAbove, r = I.bootRadius;
  return latheSolid([[0, y0], [r - 1, y0], [r, y0 + 2], [r, y1 - 3], [r - 2, y1], [0, y1]], 48);
}

/** HT lead curves in world coordinates: { leads[4] (by cylinder), coil }. */
export function buildLeadCurves(spec, L) {
  const D = derive(spec), I = L.ign, K = I.coil;
  const bootTop = D.roofApexY + L.plugTerminalTop + I.bootAbove;
  const leads = D.cylX.map((x, i) => {
    const m = towerMouth(spec, L, i), yl = I.loomY + I.loomYStep * i, zl = I.loomZ + I.loomPitch * i, u = m.x + I.uTurn;
    const end = m.x - I.leadInsert;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, bootTop - 2, 0), new THREE.Vector3(x, bootTop + 20, 0), new THREE.Vector3(x, yl - 9, 0),
      new THREE.Vector3(x + 12, yl, zl * 0.6), new THREE.Vector3(x + 32, yl, zl), new THREE.Vector3(m.x - 16, yl, zl),
      new THREE.Vector3(u - 4, yl - 4, zl), new THREE.Vector3(u + 2, (yl + m.y) / 2, (zl + m.z) / 2),
      new THREE.Vector3(u - 4, m.y + 3, m.z), new THREE.Vector3(m.x + 6, m.y, m.z), new THREE.Vector3(end, m.y, m.z),
    ], false, 'centripetal');
  });
  const { towerTop } = buildCoilGeometry(spec, L);
  const c = centreMouth(spec), u = c.x + I.uTurn + I.coilUTurnExtra, top = I.loomY + I.coilLoomRise;
  const coil = new THREE.CatmullRomCurve3([
    towerTop.clone().add(new THREE.Vector3(0, -2, 0)), towerTop.clone().add(new THREE.Vector3(2, 14, 0)),
    new THREE.Vector3(towerTop.x + 18, top - 20, -10), new THREE.Vector3(c.x - 10, top, c.z * 0.4 - 12),
    new THREE.Vector3(u - 6, top - 4, c.z), new THREE.Vector3(u + 2, (top + c.y) / 2, c.z), new THREE.Vector3(u - 6, c.y + 3, c.z),
    new THREE.Vector3(c.x + 6, c.y, c.z), new THREE.Vector3(c.x - I.leadInsert, c.y, c.z),
  ], false, 'centripetal');
  return { leads, coil };
}

/** Tube along `curve`. */
export function leadTube(curve, radius, segments = 120) {
  const g = new THREE.TubeGeometry(curve, segments, radius, 10, false);
  g.deleteAttribute('uv');
  return g;
}
