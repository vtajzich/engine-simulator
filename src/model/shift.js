import * as THREE from 'three';
import { SPEC } from '../spec.js';
import { derive } from '../kin/derive.js';
import { mat } from '../geo/materials.js';
import { partGroup } from '../geo/parts.js';
import {
  circlePts, roundedRect, sectorPts, extrudeX, boxX, slabX, mergeSolids, subtract,
} from '../geo/shiftGeo.js';

// Gear case (walls, shell, quill, idler pin), three shift rails with forks + gate lugs, reverse-idler fork, shift lever.
const LOCAL = {
  holeClr: 0.2,                 // radial clearance of wall bores over the shaft / rail radius
  cornerOuter: 22, cornerInner: 17,
  tailR: 26,                    // tail housing outer radius
  quillFlangeR: 24, quillFlangeT: 3,
  idlerPinX0: 676,
  // rail
  railX: [478, 832],
  // fork pad in the sleeve groove
  padWidth: 7.5, padIn: 40.4, padOut: 49, padHalfDeg: 65,
  armWidth: 10, armStart: 46, bossR: 11, bossHalfLen: 10,
  // gate lug (block on the rail top with a slot for the lever finger)
  slotWidth: 11, earT: 3.5, lugBottom: 89.5, slotFloor: 92.5, lugTop: 105, lugInner: 8.5, lugEdgeOuter: 35, lugMid: 6.5,
  // rear-wall window for the lug travel (lugs reach X 818.5 > rear wall start 805)
  windowY: 89, windowHalfZ: 37,
  // lever
  pivotBallR: 8, capHoleR: 8.7, stemR: 5, fingerStemR: 3, fingerBallR: 5, knobR: 22, towerR: 28, towerInnerR: 22,
  towerY: [114, 153], capY: [147, 153],
  // OVERRIDES SPEC.gearbox.shift.leverFingerY + 3 = 95: the Ø10 finger ball would then reach y = 90, below the top of the
  // Ø14 rails (y = 91), i.e. it would sit inside the middle rail. The ball centre is raised to 98 (0.5 mm over the slot floor).
  fingerBallY: 98,
  // reverse-idler fork
  revArmT: 8, revArmZ: 85, revArmW: 10, prongT: 3, prongGap: 0.3, prongReach: 5, yokeGap: 1.5, yokeDepth: 7, yokeHalfW: 14, prongHalfW: 12,
};

const hasMesh = (g, m, housing = false, name) => {
  const mesh = new THREE.Mesh(g, m);
  if (housing) mesh.userData.housing = true;
  if (name) mesh.name = name;
  return mesh;
};

export function buildShift(spec = SPEC) {
  const D = derive(spec);
  const gb = spec.gearbox, sh = gb.shift, W = gb.walls, cs = gb.case, rv = gb.reverse, hubs = gb.synchro.hubs;
  const L = LOCAL;
  const group = new THREE.Group();
  group.name = 'shift';
  const railNames = ['s12', 's34', 's5'];
  const railR = sh.railDiameter / 2, railHoleR = railR + L.holeClr;
  const [yBot, yTop] = cs.innerY, hz = cs.innerHalfWidthZ, wt = cs.wall;
  const px = sh.leverPivot[0], py = sh.leverPivot[1];
  const cAx = D.gearbox.counterAxis, iAx = D.gearbox.idlerAxis;
  const idlerG = D.gearbox.gears['rev.idler'];

  // ───────────────────────── gearCase ─────────────────────────
  const caseMat = mat('housing');
  const gearCase = partGroup('gearCase', 'gearCase', 'Skříň převodovky', { static: true });
  const outer = roundedRect(yBot - wt, yTop + wt, -(hz + wt), hz + wt, L.cornerOuter);
  const inner = roundedRect(yBot, yTop, -hz, hz, L.cornerInner);
  const towerCut = new THREE.CylinderGeometry(L.towerInnerR, L.towerInnerR, 30, 64).translate(px, yTop + 3, 0);

  const circ = (cy, cz, r) => circlePts(cy, cz, r, 96);
  const railHoles = railNames.map(s => circ(sh.railY, sh.railZ[s], railHoleR));
  const wallHoles = (mainR, withRails) => [circ(0, 0, mainR), circ(cAx.y, 0, gb.shafts.counterDiameter / 2 + L.holeClr),
    ...(withRails ? railHoles : [])];
  const mainRFront = gb.shafts.inputDiameter / 2 + L.holeClr, mainRMain = gb.shafts.mainDiameter / 2 + L.holeClr;
  gearCase.add(hasMesh(extrudeX(outer, W.front[0], W.front[1], wallHoles(mainRFront, true)), caseMat, true, 'wallFront'));
  gearCase.add(hasMesh(extrudeX(outer, W.centre[0], W.centre[1], wallHoles(mainRMain, true)), caseMat, true, 'wallCentre'));

  // rear wall: one window above y = windowY (room for the gate lugs) whose floor dips around each rail (saddle bearing)
  const win = [[yTop, -L.windowHalfZ], [L.windowY, -L.windowHalfZ]];
  for (const s of railNames) {
    const zr = sh.railZ[s], dy = L.windowY - sh.railY, hc = Math.sqrt(railHoleR ** 2 - dy ** 2);
    const phi0 = Math.PI - Math.asin(dy / railHoleR), phi1 = phi0 + Math.PI + 2 * Math.asin(dy / railHoleR);
    win.push([L.windowY, zr - hc]);
    for (let i = 1; i < 48; i++) { const f = phi0 + (phi1 - phi0) * i / 48; win.push([sh.railY + railHoleR * Math.sin(f), zr + railHoleR * Math.cos(f)]); }
    win.push([L.windowY, zr + hc]);
  }
  win.push([L.windowY, L.windowHalfZ], [yTop, L.windowHalfZ]);
  const rearWall = extrudeX(outer, W.rear[0], W.rear[1], [circ(0, 0, mainRMain), circ(cAx.y, 0, gb.shafts.counterDiameter / 2 + L.holeClr), win]);
  gearCase.add(hasMesh(subtract(rearWall, [towerCut]), caseMat, true, 'wallRear'));

  // shell between the front and rear wall, roof opening for the lever
  gearCase.add(hasMesh(subtract(extrudeX(outer, W.front[0], W.rear[1], [inner]), [towerCut]), caseMat, true, 'shell'));
  // tail housing around the mainshaft
  gearCase.add(hasMesh(extrudeX(circ(0, 0, L.tailR), W.rear[1], gb.shafts.mainEndX - 14, [circ(0, 0, mainRMain)]), caseMat, true, 'tail'));
  // lever tower: tube with a cap plate holding the ball joint
  {
    const [t0, t1] = L.towerY, [c0, c1] = L.capY;
    const prof = [[L.towerInnerR, t0], [L.towerR, t0], [L.towerR, t1], [L.capHoleR, t1], [L.capHoleR, c0], [L.towerInnerR, c0]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    prof.push(prof[0].clone());
    const g = new THREE.LatheGeometry(prof, 64);
    g.translate(px, 0, 0);
    gearCase.add(hasMesh(g, caseMat, true, 'tower'));
  }
  group.add(gearCase);

  const idlerShaft = partGroup('idlerShaft', 'gearCase', 'Čep vloženého kola', { static: true });
  idlerShaft.add(hasMesh(extrudeX(circlePts(iAx.y, iAx.z, rv.idlerShaftDiameter / 2, 64), L.idlerPinX0, (W.centre[0] + W.centre[1]) / 2), mat('steelDark'), false, 'idlerPin'));
  group.add(idlerShaft);

  const quillR = spec.clutch.quill.od / 2, quillRi = spec.clutch.quill.id / 2;
  const quill = partGroup('quill', 'gearCase', 'Vodicí trubka vypínacího ložiska', { static: true });
  quill.add(hasMesh(mergeSolids([
    extrudeX(circlePts(0, 0, quillR, 64), spec.clutch.quill.frontX, W.front[0] + 1, [circlePts(0, 0, quillRi, 64)]),
    extrudeX(circlePts(0, 0, L.quillFlangeR, 64), W.front[0] - L.quillFlangeT, W.front[0], [circlePts(0, 0, quillRi, 64)]),
  ]), mat('steel'), false, 'quillTube'));
  group.add(quill);

  // ───────────────────────── forks ─────────────────────────
  const steel = mat('shiftSteel');
  const forks = {};
  const lugX0 = px, hw = L.slotWidth / 2;
  const names = { s12: ['fork12', 'Řadicí vidlice 1–2'], s34: ['fork34', 'Řadicí vidlice 3–4'], s5: ['fork5', 'Řadicí vidlice 5–R'] };
  for (const s of railNames) {
    const zr = sh.railZ[s], hx = hubs[s].x, ar = Math.atan2(zr, sh.railY), rr = Math.hypot(sh.railY, zr);
    const list = [];
    list.push(extrudeX(circlePts(sh.railY, zr, railR, 48), L.railX[0], L.railX[1]));                       // rail
    list.push(extrudeX(sectorPts(L.padIn, L.padOut, ar - L.padHalfDeg * Math.PI / 180, ar + L.padHalfDeg * Math.PI / 180),
      hx - L.padWidth / 2, hx + L.padWidth / 2));                                                           // pad in the groove
    list.push(slabX(hx - L.padWidth / 2, hx + L.padWidth / 2,
      [L.armStart * Math.cos(ar), L.armStart * Math.sin(ar)], [sh.railY, zr], L.armWidth, 0));              // arm to the rail
    list.push(extrudeX(circlePts(sh.railY, zr, L.bossR, 48), hx - L.bossHalfLen, hx + L.bossHalfLen));     // boss
    // gate lug: floor plate + two ears with the finger slot between; outer lugs reach inward
    const zIn = s === 's34' ? -L.lugMid : s === 's12' ? -L.lugEdgeOuter : L.lugInner;
    const zOut = s === 's34' ? L.lugMid : s === 's12' ? -L.lugInner : L.lugEdgeOuter;
    const zc = (zIn + zOut) / 2, zh = (zOut - zIn) / 2;
    const bx = (x0, x1, y0, y1) => boxX(x0, x1, (y0 + y1) / 2, zc, 0, (y1 - y0) / 2, zh);
    list.push(bx(lugX0 - hw - L.earT, lugX0 + hw + L.earT, L.lugBottom, L.slotFloor));
    list.push(bx(lugX0 - hw - L.earT, lugX0 - hw, L.lugBottom, L.lugTop));
    list.push(bx(lugX0 + hw, lugX0 + hw + L.earT, L.lugBottom, L.lugTop));
    if (s === 's5') {
      // reverse-idler fork: arm from the rail out to the case side, down, and in to a yoke straddling the idler rim
      const xm = (rv.idlerNeutralX[0] + rv.idlerNeutralX[1]) / 2, hf = (rv.idlerNeutralX[1] - rv.idlerNeutralX[0]) / 2;
      const ax0 = xm - L.revArmT / 2, ax1 = xm + L.revArmT / 2;
      const mainDir = new THREE.Vector2(iAx.y, iAx.z).normalize();
      const cntDir = new THREE.Vector2(iAx.y - cAx.y, iAx.z - cAx.z).normalize();
      const u = mainDir.add(cntDir).normalize();               // outward: away from main and counter axes
      const ua = Math.atan2(u.y, u.x);                         // angle from +Y toward +Z
      const r0 = idlerG.ra + L.yokeGap, r1 = r0 + L.yokeDepth;
      const rc = (r0 + r1) / 2;
      const yc = [iAx.y + u.x * rc, iAx.z + u.y * rc];
      list.push(extrudeX(circlePts(sh.railY, zr, L.bossR - 0.5, 48), ax0, ax1));
      list.push(slabX(ax0, ax1, [sh.railY, zr], [sh.railY, L.revArmZ], L.revArmW));
      list.push(slabX(ax0, ax1, [sh.railY, L.revArmZ], [yc[0], L.revArmZ], L.revArmW));
      list.push(slabX(ax0, ax1, [yc[0], L.revArmZ], yc, L.revArmW, 0));   // ends inside the yoke web, outside the tip circle
      const f0 = xm - hf - L.prongGap - L.prongT, f1 = xm + hf + L.prongGap + L.prongT;     // outer faces of the prongs
      list.push(boxX(f0, f1, yc[0], yc[1], ua, L.yokeDepth / 2, L.yokeHalfW));                  // yoke web
      const pr0 = idlerG.ra - L.prongReach, pc = (pr0 + r1) / 2;
      const pcen = [iAx.y + u.x * pc, iAx.z + u.y * pc];
      list.push(boxX(f0, f0 + L.prongT, pcen[0], pcen[1], ua, (r1 - pr0) / 2, L.prongHalfW));
      list.push(boxX(f1 - L.prongT, f1, pcen[0], pcen[1], ua, (r1 - pr0) / 2, L.prongHalfW));
    }
    const [id, label] = names[s];
    const part = partGroup(id, id, label);
    part.add(hasMesh(mergeSolids(list), steel, false, id));
    group.add(part);
    forks[s] = part;
  }

  // ───────────────────────── shiftLever ─────────────────────────
  const lever = partGroup('shiftLever', 'shiftLever', 'Řadicí páka');
  const fingerLen = py - L.fingerBallY;                          // pivot -> finger ball centre
  const knobLen = sh.leverKnob[1] - py;
  lever.position.set(px, py, 0);
  lever.rotation.order = 'ZXY';
  const stem = new THREE.CylinderGeometry(L.stemR, L.stemR, knobLen, 32).translate(0, knobLen / 2, 0);
  const fstem = new THREE.CylinderGeometry(L.fingerStemR, L.fingerStemR, fingerLen, 32).translate(0, -fingerLen / 2, 0);
  lever.add(hasMesh(mergeSolids([new THREE.SphereGeometry(L.pivotBallR, 32, 24), stem, fstem]), steel, false, 'leverStem'));
  const fball = hasMesh(new THREE.SphereGeometry(L.fingerBallR, 32, 24), steel, false, 'fingerBall');
  fball.position.set(0, -fingerLen, 0);
  lever.add(fball);
  const knob = hasMesh(new THREE.SphereGeometry(L.knobR, 32, 24), mat('knob'), false, 'knob');
  knob.position.set(0, knobLen, 0);
  lever.add(knob);
  group.add(lever);

  const tri = (o) => { let n = 0; o.traverse(m => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return n; };

  return {
    group,
    parts: { gearCase, idlerShaft, quill, fork12: forks.s12, fork34: forks.s34, fork5: forks.s5, shiftLever: lever },
    triangles: tri(group),
    fingerLength: fingerLen,
    update(pose) {
      forks.s12.position.x = pose.sleeves.s12;
      forks.s34.position.x = pose.sleeves.s34;
      forks.s5.position.x = pose.sleeves.s5;
      // ball centre lands exactly at x = pivotX + row·railTravel, z = 13·col (see docs/plan/C3-shift-case.md)
      const { col, row } = pose.lever;
      const phi = -Math.asin(col * 13 / fingerLen);
      lever.rotation.x = phi;
      lever.rotation.z = Math.asin(row * sh.railTravel / (fingerLen * Math.cos(phi)));
    },
  };
}
