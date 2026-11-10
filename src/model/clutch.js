import * as THREE from 'three';
import { SPEC } from '../spec.js';
import { mat } from '../geo/materials.js';
import { partGroup, segs } from '../geo/parts.js';
import { clutchStack, fingerPoint, releaseKin, bearingFaceX } from '../kin/clutch.js';
import { lathePoly, clean, merge, torusX, boxAt } from '../geo/clutchGeo.js';

const LOCAL = {
  ringGearRoot: 145, ringGearX: [363, 375],       // starter ring gear on the flywheel rim (tip = flywheel.diameter / 2)
  counterbore: { radius: 24, x: 378.5 },          // pilot-bearing recess in the flywheel rear face: takes the disc hub (OD 44) with clearance
  recess: { rho: [60, 120], depth: 6 },           // lightening recess on the engine side
  discPlate: 1.0, cageRho: [36, 60], cageT: 1.2, springR: 3, springLen: 12, springDx: 0.5,
  hubBore: 25.5,
  bead: 3.0, beadRho: 96.5,                                      // cover fulcrum bead (torus tube radius)
  beadGap: 0.05, noseR: 2.0, noseRho: 28, noseGap: 0.05, flangeRho: 34, flangeLen: 4,
  coverFlangeRho: 124, coverWallInner: 135, coverWallRearX: 429.5, coverDishRho: 88, coverInnerX: 426.5,
  boltR: 5, boltH: 3.5,
  fork: { zPivot: 105, zSlave: -95, yCentre: 27, yWidth: 6, padR: 3, padGap: 0.3, setback: 8, railT: 8,
          ballR: 6, cupIn: 7, cupOut: 9.5, stud: 4 },
  bell: { taperStartX: 400, taperEndX: 462, flange: 18 },
  boltRho: 131, strapRho: 118,                                   // cover bolt circle, drive-strap radius
  // pilot bearing in the flywheel centre hole around the input-shaft pilot; the bore is inputPilotDiameter / 2 + boreClearance
  pilot: { outer: [11, 13], innerOuterRho: 9.5, boreClearance: 0.25, x: [362, 372], ballR: 1.55, ballRho: 10.25, balls: 8 },
  indexMark: { len: 20, h: 1.0, w: 3.5, count: 6 },              // white stripes around the disc hub (visual only)
};

/** Radii / x of the torque path through the cover, used by the app's clutch-link overlay (src/app/clutchLink.js). */
export const CLUTCH_PATH = {
  boltRho: LOCAL.boltRho,
  coverRho: (LOCAL.coverWallInner + SPEC.clutch.cover.outerRadius) / 2,        // middle of the cover wall
  strapRho: LOCAL.strapRho,
  coverRearX: (LOCAL.coverWallRearX + LOCAL.coverInnerX) / 2,                  // middle of the cover rear wall
};

const N_F = SPEC.clutch.diaphragm.fingers;


// Rear-surface sample points {rho, x} (rho = distance from the crank axis, so lateral plate corners count) of a finger at angle phi.
function fingerRearSamples(spec, phi) {
  const d = spec.clutch.diaphragm, st = clutchStack(spec), out = [];
  for (let i = 0; i <= 168; i++) {
    const rl = d.tipRadius + (d.outerRadius - d.tipRadius) * i / 168;
    const half = (wAt(spec, rl)) / 2;
    const q = fingerPoint({ rho: rl, x: st.O.x + (d.outerRadius - rl) * st.k + d.thickness / 2 }, phi, spec);
    for (const z of [0, half / 2, half]) out.push({ rho: Math.hypot(q.rho, z), x: q.x });
  }
  return out;
}
function wAt(spec, rl) {
  const d = spec.clutch.diaphragm, t = (rl - d.tipRadius) / (d.outerRadius - d.tipRadius);
  const a = 0.8 * 2 * Math.PI * d.tipRadius / d.fingers, b = 0.9 * 2 * Math.PI * d.outerRadius / d.fingers;
  return a + (b - a) * t;
}
// smallest x-gap between a torus (ring radius rho, tube r, centre x = xc) and the sample points
function torusGap(rho, r, xc, samples) {
  let g = Infinity;
  for (const s of samples) {
    const dr = s.rho - rho;
    if (Math.abs(dr) < r) g = Math.min(g, xc - Math.sqrt(r * r - dr * dr) - s.x);
  }
  return g;
}
function bisectX(f, lo, hi) {   // f increasing; returns x with f(x) = 0
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

function ringGearGeometry(spec) {
  const c = spec.clutch.flywheel, n = c.ringGearTeeth, tip = c.diameter / 2, root = LOCAL.ringGearRoot;
  const pitch = 2 * Math.PI / n, sh = new THREE.Shape();
  const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i * pitch;
    pts.push(pt(root, a - 0.27 * pitch), pt(tip, a - 0.12 * pitch), pt(tip, a + 0.12 * pitch), pt(root, a + 0.27 * pitch));
  }
  sh.setFromPoints(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const hole = new THREE.Path();
  const hp = [];
  for (let i = 0; i < 96; i++) hp.push(new THREE.Vector2(140 * Math.cos(-i / 96 * 2 * Math.PI), 140 * Math.sin(-i / 96 * 2 * Math.PI)));
  hole.setFromPoints(hp);
  sh.holes.push(hole);
  const depth = LOCAL.ringGearX[1] - LOCAL.ringGearX[0];
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, steps: 1 });
  g.rotateY(Math.PI / 2);
  g.translate(LOCAL.ringGearX[0], 0, 0);
  return g;
}

function buildFlywheel(spec) {
  const c = spec.clutch.flywheel, [x0, x1] = c.x, hole = c.centreHole / 2, rc = LOCAL.counterbore, rec = LOCAL.recess;
  const body = lathePoly([
    [hole, x0], [rec.rho[0], x0], [rec.rho[0], x0 + rec.depth], [rec.rho[1], x0 + rec.depth], [rec.rho[1], x0],
    [LOCAL.ringGearRoot, x0], [LOCAL.ringGearRoot, x1], [rc.radius, x1], [rc.radius, rc.x], [hole, rc.x], [hole, x0],
  ], segs(150));
  const parts = [body, ringGearGeometry(spec)];
  return new THREE.Mesh(merge(parts), mat('castIron'));
}

function buildCover(spec) {
  const c = spec.clutch.cover, d = spec.clutch.diaphragm, st = clutchStack(spec);
  const L = LOCAL, x0 = spec.clutch.flywheel.x[1], t = c.thickness;
  const rearIn = c.rearX - t;
  const shell = lathePoly([
    [L.coverFlangeRho, x0], [c.outerRadius, x0], [c.outerRadius, L.coverWallRearX], [L.coverDishRho, L.coverWallRearX],
    [c.openingRadius, c.rearX], [c.openingRadius, rearIn], [L.coverDishRho, L.coverInnerX],
    [L.coverWallInner, L.coverInnerX], [L.coverWallInner, x0 + t], [L.coverFlangeRho, x0 + t], [L.coverFlangeRho, x0],
  ], segs(c.outerRadius));
  // fulcrum bead: x position fitted so the gap to the finger rear surface (incl. lateral plate corners, whole swing) is beadGap
  const R = L.bead, rho = L.beadRho, phiMax = releaseKin(1, spec).fingerAngle;
  const smp = [];
  for (let j = 0; j <= 6; j++) smp.push(...fingerRearSamples(spec, phiMax * j / 6));
  const xc = bisectX(x => torusGap(rho, R, x, smp) - L.beadGap, st.F.x, st.F.x + 20);
  const bead = torusX(rho, R, xc, 96, 24);
  const list = [shell, bead];
  for (let i = 0; i < c.bolts; i++) {
    const a = i * 2 * Math.PI / c.bolts + Math.PI / c.bolts;
    const b = new THREE.CylinderGeometry(L.boltR, L.boltR, L.boltH, 6);
    b.rotateZ(-Math.PI / 2);
    b.translate(x0 + t + L.boltH / 2 - 0.5, L.boltRho, 0);
    b.rotateX(a);
    list.push(b);
  }
  return new THREE.Mesh(merge(list), mat('steel'));
}

function buildPressurePlate(spec) {
  const p = spec.clutch.pressurePlate, st = clutchStack(spec);
  const ri = p.innerDiameter / 2, ro = p.outerDiameter / 2, rr = p.ridgeRadius;
  const geo = lathePoly([
    [ri, st.plateFrontX], [ro, st.plateFrontX], [ro, st.plateRearX], [rr + 2, st.plateRearX],
    [rr + 2, st.ridgeX], [rr - 2, st.ridgeX], [rr - 2, st.plateRearX], [ri, st.plateRearX], [ri, st.plateFrontX],
  ], segs(ro));
  const m = new THREE.Mesh(clean(geo), mat('castIron'));
  // drive straps (visual only)
  const straps = [];
  for (let i = 0; i < 3; i++) {
    const g = boxAt(1.5, 12, 30, st.plateRearX + 0.75, 0, 0);
    g.translate(0, LOCAL.strapRho, 0);
    g.rotateX(i * 2 * Math.PI / 3);
    straps.push(g);
  }
  const s = new THREE.Mesh(merge(straps), mat('steelDark'));
  s.userData.noCollide = true;
  return [m, s];
}

function buildFingerGeometry(spec) {
  const d = spec.clutch.diaphragm, st = clutchStack(spec), n = d.fingers;
  const wTip = 0.8 * 2 * Math.PI * d.tipRadius / n, wOut = 0.9 * 2 * Math.PI * d.outerRadius / n;
  const y0 = d.tipRadius - st.F.rho, y1 = d.outerRadius - st.F.rho;
  const sh = new THREE.Shape([
    new THREE.Vector2(-wTip / 2, y0), new THREE.Vector2(wTip / 2, y0),
    new THREE.Vector2(wOut / 2, y1), new THREE.Vector2(-wOut / 2, y1)]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: d.thickness, bevelEnabled: false, steps: 1 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {   // (sx, sy, e) -> local (x = e - t/2 - k*y, y = sy, z = sx): sheared slab, axial thickness t
    const sx = p.getX(i), sy = p.getY(i), e = p.getZ(i);
    p.setXYZ(i, e - d.thickness / 2 - st.k * sy, sy, sx);
  }
  return clean(g);
}

function buildDisc(spec) {
  const c = spec.clutch, ds = c.disc, st = clutchStack(spec), L = LOCAL;
  const ro = ds.outerDiameter / 2, ri = ds.innerDiameter / 2, bore = L.hubBore / 2, hr = ds.hubOD / 2;
  const xc = st.discFrontX + ds.thickness / 2, ft = (ds.thickness - L.discPlate) / 2;
  const sg = segs(ro);
  const facings = merge([
    lathePoly([[ri, st.discFrontX], [ro, st.discFrontX], [ro, st.discFrontX + ft], [ri, st.discFrontX + ft], [ri, st.discFrontX]], sg),
    lathePoly([[ri, st.discRearX - ft], [ro, st.discRearX - ft], [ro, st.discRearX], [ri, st.discRearX], [ri, st.discRearX - ft]], sg),
  ]);
  const plate = lathePoly([[hr, xc - L.discPlate / 2], [ro - 1.5, xc - L.discPlate / 2], [ro - 1.5, xc + L.discPlate / 2], [hr, xc + L.discPlate / 2], [hr, xc - L.discPlate / 2]], sg);
  const hub = lathePoly([[bore, xc - ds.hubLength / 2], [hr, xc - ds.hubLength / 2], [hr, xc + ds.hubLength / 2], [bore, xc + ds.hubLength / 2], [bore, xc - ds.hubLength / 2]], 64);
  const list = [plate, hub];
  const [cr0, cr1] = L.cageRho;
  for (const s of [-1, 1]) {
    const xm = xc + s * (L.discPlate / 2 + L.cageT / 2 + 1.0);
    list.push(lathePoly([[cr0, xm - L.cageT / 2], [cr1, xm - L.cageT / 2], [cr1, xm + L.cageT / 2], [cr0, xm + L.cageT / 2], [cr0, xm - L.cageT / 2]], 64));
  }
  const springs = [];
  for (let i = 0; i < ds.damperSprings; i++) {
    const g = new THREE.CylinderGeometry(L.springR, L.springR, L.springLen, 24);
    g.rotateX(Math.PI / 2);                 // axis along Z (tangential at angle 0)
    g.translate(xc, ds.damperRadius, 0);
    g.rotateX(i * 2 * Math.PI / ds.damperSprings + Math.PI / ds.damperSprings);
    springs.push(g);
  }
  const im = L.indexMark;
  const marks = [];
  for (let i = 0; i < im.count; i++) { const g = boxAt(im.len, im.h, im.w, xc, hr + im.h / 2, 0); g.rotateX(i * 2 * Math.PI / im.count); marks.push(g); }
  const mark = new THREE.Mesh(merge(marks), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mark.userData.noCollide = true;
  return [new THREE.Mesh(facings, mat('friction')), new THREE.Mesh(merge(list), mat('steel')), new THREE.Mesh(merge(springs), mat('steelDark')), mark];
}

// Pilot bearing: sits in the flywheel centre hole around the Ø15 input-shaft pilot (the inner ring is modelled on the crank body)
function buildPilotBearing(spec) {
  const P = LOCAL.pilot, [x0, x1] = P.x, ri = spec.gearbox.shafts.inputPilotDiameter / 2 + P.boreClearance;
  const ring = (r0, r1) => lathePoly([[r0, x0], [r1, x0], [r1, x1], [r0, x1], [r0, x0]], 64);
  const list = [ring(P.outer[0], P.outer[1]), ring(ri, P.innerOuterRho)];
  for (let i = 0; i < P.balls; i++) {
    const b = new THREE.SphereGeometry(P.ballR, 16, 12);
    b.translate((x0 + x1) / 2, P.ballRho, 0);
    b.rotateX(i * 2 * Math.PI / P.balls);
    list.push(b);
  }
  return new THREE.Mesh(merge(list), mat('polished'));
}

// Bearing local frame: x = 0 at the reference face f = bearingFaceX(pedal) (finger rear surface at the tip once free play is taken up)
function bearingNoseOffset(spec) {
  const L = LOCAL, per = [];
  for (let i = 0; i <= 20; i++) {
    const p = i / 20, rk = releaseKin(p, spec);
    per.push({ f: bearingFaceX(p, spec), s: fingerRearSamples(spec, rk.fingerAngle) });
  }
  const gap = a => Math.min(...per.map(q => torusGap(L.noseRho, L.noseR, q.f + a, q.s)));
  return bisectX(a => gap(a) - L.noseGap, -5, 10);   // nose centre axial offset behind the reference face
}

function buildBearing(spec) {
  const b = spec.clutch.releaseBearing, L = LOCAL, a = bearingNoseOffset(spec);
  const rb = b.id / 2, ro = b.od / 2;
  const ring = lathePoly([
    [rb, a], [ro, a], [ro, b.length - L.flangeLen], [L.flangeRho, b.length - L.flangeLen], [L.flangeRho, b.length], [rb, b.length], [rb, a],
  ], 64);
  const nose = torusX(L.noseRho, L.noseR, a, 64, 16);
  return new THREE.Mesh(merge([ring, nose]), mat('steel'));
}

function forkLayout(spec) {
  const F = LOCAL.fork, rear0 = bearingFaceX(0, spec) + spec.clutch.releaseBearing.length;
  const padFront = rear0 + F.padGap;
  return { padFront, xp: padFront + F.setback + F.railT / 2 };
}

function buildFork(spec) {
  const F = LOCAL.fork, { padFront, xp } = forkLayout(spec);
  const xl = x => x - xp, zl = z => z - F.zPivot;
  const list = [];
  const railX0 = padFront + F.setback;
  for (const s of [-1, 1]) {
    const yc = s * F.yCentre;
    const zA = zl(F.zSlave), zB = -F.cupOut - 1.25;
    list.push(boxAt(F.railT, F.yWidth, zB - zA, xl(railX0 + F.railT / 2), yc, (zA + zB) / 2));
    const pad = new THREE.CylinderGeometry(F.padR, F.padR, F.yWidth, 24);
    pad.translate(xl(padFront + F.padR), yc, zl(0));
    list.push(pad);
    list.push(boxAt(F.setback - F.padR + 1, F.yWidth, 2 * F.padR, xl(padFront + F.padR + (F.setback - F.padR + 1) / 2), yc, zl(0)));
  }
  list.push(boxAt(F.railT, 2 * (F.yCentre + F.yWidth / 2), 4, xl(xp), 0, zl(F.zSlave)));   // slave-end crossbar
  list.push(boxAt(F.railT, 2 * (F.yCentre + F.yWidth / 2), 4.5, xl(xp), 0, -F.cupOut - 2.25 + 1.0)); // pivot-end crossbar
  // socket cup around the ball stud (opens toward +z)
  const pts = [];
  const steps = 16, th1 = 100 * Math.PI / 180;
  for (let i = 0; i <= steps; i++) { const t = th1 * i / steps; pts.push([F.cupOut * Math.sin(t) + 0.0, F.cupOut * Math.cos(t)]); }
  for (let i = steps; i >= 0; i--) { const t = th1 * i / steps; pts.push([F.cupIn * Math.sin(t), F.cupIn * Math.cos(t)]); }
  pts.push(pts[0]);
  const cup = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(p[0], 1e-3), p[1])), 48);
  cup.rotateX(-Math.PI / 2);   // pole toward -z
  list.push(cup);
  return new THREE.Mesh(merge(list), mat('steelDark'));
}

function buildBellhousing(spec) {
  const b = spec.clutch.bellhousing, L = LOCAL.bell, w = b.wall;
  const xa = spec.engine.block.rearX, xb = spec.gearbox.walls.front[0];
  const r0 = b.frontRadius, r1 = b.rearRadius;
  const geo = lathePoly([
    [r0, xa], [r0, L.taperStartX], [r1, L.taperEndX], [r1, xb],
    [r1 + w, xb], [r1 + w, L.taperEndX], [r0 + w, L.taperStartX], [r0 + w, xa], [r0, xa],
  ], 96);
  const fl = [
    lathePoly([[r0, xa], [r0 + L.flange, xa], [r0 + L.flange, xa + 10], [r0, xa + 10], [r0, xa]], 96),
    lathePoly([[r1, xb - 10], [r1 + L.flange, xb - 10], [r1 + L.flange, xb], [r1, xb], [r1, xb - 10]], 96),
  ];
  const F = LOCAL.fork, { xp } = forkLayout(spec);
  const stud = new THREE.CylinderGeometry(F.stud, F.stud, r1 + w - 1 - F.zPivot, 24);
  stud.rotateX(Math.PI / 2);
  stud.translate(xp, 0, F.zPivot + (r1 + w - 1 - F.zPivot) / 2);
  const ball = new THREE.SphereGeometry(F.ballR, 32, 20);
  ball.translate(xp, 0, F.zPivot);
  const m = new THREE.Mesh(merge([geo, ...fl, stud, ball]), mat('housing'));
  m.userData.housing = true;
  return m;
}

export function buildClutch(spec = SPEC) {
  const group = new THREE.Group();
  group.name = 'clutch';
  const st = clutchStack(spec), d = spec.clutch.diaphragm;

  const flywheel = partGroup('flywheel', 'crank', 'Setrvačník');
  flywheel.add(buildFlywheel(spec));
  const pilotBearing = partGroup('pilotBearing', 'crank', 'Pilotní ložisko');
  pilotBearing.add(buildPilotBearing(spec));
  const cover = partGroup('clutchCover', 'crank', 'Štít spojky');
  cover.add(buildCover(spec));
  const plate = partGroup('pressurePlate', 'pressurePlate', 'Přítlačný kotouč');
  for (const m of buildPressurePlate(spec)) plate.add(m);
  const disc = partGroup('clutchDisc', 'clutchDisc', 'Spojková lamela');
  for (const m of buildDisc(spec)) disc.add(m);
  const bearing = partGroup('releaseBearing', 'releaseBearing', 'Vypínací ložisko');
  bearing.add(buildBearing(spec));
  const { xp } = forkLayout(spec);
  const fork = partGroup('releaseFork', 'releaseFork', 'Vypínací vidlice');
  fork.position.set(xp, 0, LOCAL.fork.zPivot);
  fork.add(buildFork(spec));
  const bell = partGroup('bellhousing', 'bellhousing', 'Zvon spojky', { static: true });
  bell.add(buildBellhousing(spec));

  const fingerGeo = buildFingerGeometry(spec);
  const spins = [], pivots = [];
  for (let k = 0; k < d.fingers; k++) {
    const id = 'finger' + String(k + 1).padStart(2, '0');
    const spin = new THREE.Group();
    const pivot = partGroup(id, id, 'Jazýček talířové pružiny');
    pivot.position.set(st.F.x, st.F.rho, 0);
    pivot.add(new THREE.Mesh(fingerGeo, mat('steelDark')));
    spin.add(pivot);
    spins.push(spin); pivots.push(pivot);
  }
  group.add(flywheel, pilotBearing, cover, plate, disc, bearing, fork, bell, ...spins);

  const L = LOCAL.fork;
  function update(pose) {
    const rk = releaseKin(pose.clutchPedal, spec);
    flywheel.rotation.x = pose.crank;
    pilotBearing.rotation.x = pose.crank;
    cover.rotation.x = pose.crank;
    plate.rotation.x = pose.crank;
    plate.position.x = rk.plateLift;
    disc.rotation.x = pose.input;
    disc.position.x = rk.discShift;
    bearing.position.x = bearingFaceX(pose.clutchPedal, spec);
    fork.rotation.y = Math.asin(rk.bearingTravel / L.zPivot);
    for (let k = 0; k < spins.length; k++) {
      spins[k].rotation.x = pose.crank + k * 2 * Math.PI / spins.length;
      pivots[k].rotation.z = -rk.fingerAngle;
    }
  }
  update({ crank: 0, input: 0, clutchPedal: 0 });
  return { group, update };
}
