import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPEC } from '../spec.js';
import { derive } from '../kin/derive.js';
import { throwAngle, pistonPinY, rodAngle } from '../kin/engine.js';
import { mat } from '../geo/materials.js';
import { partGroup, segs } from '../geo/parts.js';

// Dimensions that are not in SPEC (decorative / structural choices of this module).
const LOCAL = {
  webArmRadius: 32,            // radius of the web arm around the main journal and around the crankpin
  sealJournalRadius: 40, sealJournalStartX: 346.5,   // seal journal overlaps the last main journal by 0.5
  boreClear: 0.2,              // bulkhead main bore radial clearance over the journal
  noseClear: 0.3, sealClear: 0.3,   // end-wall bore clearances over nose / seal journal
  // OVERRIDES the task text "ring outer radius R - 0.15": 0.2 keeps the SPEC/common-rule minimum radial running gap
  // (the ring protrudes 0.05 beyond the piston body, which has R - 0.25).
  ringOuterGap: 0.2,
  ringGrooveDepth: 2.5, skirtWall: 3.5, bossRadius: 15, bossEndX: 39.8,
  ringAxialMargin: 0.05,
  rodBeamTopY: -13, rodBeamTopHalf: 7, rodBeamBottomOffset: 27, rodBeamBottomHalf: 12,
  bankHalfZ: 60, wallInnerZ: 88, wallOuterZ: 94, wallBottomY: -98,
  bulkheadBottomY: -38, bulkheadThinFromY: 60, bulkheadThinHalf: 4, bulkheadTopY: 90,
  shelfBottomY: 80, panFloorTop: -95, endWallThick: 2.5, frontEndWallX: -62,
};

const RING = (n, a0, a1, pt) => { for (let k = 0; k <= n; k++) pt(a0 + (a1 - a0) * k / n); };

// shape (x,y) / extrude z  ->  world (Y, Z, X): proper cyclic permutation. Used for outlines in the Y-Z plane
// extruded along X; the extrusion starts at X = 0 and runs to +depth.
const toYZX = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
// shape (x,y) / extrude z  ->  world (X, Z=-y, Y=z): outlines in the X-Z plane extruded along Y.
const toXZY = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);

function extrudeX(shape, x0, x1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
  g.applyMatrix4(toYZX);
  g.translate(x0, 0, 0);
  return g;
}
function extrudeY(shape, y0, y1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
  g.applyMatrix4(toXZY);
  g.translate(0, y0, 0);
  return g;
}
const merge = list => mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g)));
const cylAlongX = (x0, x1, r, n) => {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, n, 1);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
};
const rectShape = (y0, y1, z0, z1) => {   // in the (Y, Z) plane
  const s = new THREE.Shape();
  s.moveTo(y0, z0); s.lineTo(y1, z0); s.lineTo(y1, z1); s.lineTo(y0, z1); s.closePath();
  return s;
};
const circlePath = (cy, cz, r, n) => {
  const p = new THREE.Path();
  for (let k = 0; k < n; k++) {
    const a = -2 * Math.PI * k / n;   // clockwise (hole)
    const x = cy + r * Math.cos(a), y = cz + r * Math.sin(a);
    if (k === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
  return p;
};
const lathe = (profile, n) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), n);

export function buildBottomEnd(spec = SPEC) {
  const E = spec.engine, D = derive(spec);
  const { R, r, L, cylX } = D;
  const C = E.crank, P = E.piston, Rd = E.rod;
  const n = E.cylinders;
  const group = new THREE.Group();
  group.name = 'bottomEnd';

  // ───────────────────────────── crankshaft ─────────────────────────────
  const crankGroup = partGroup('crankshaft', 'crank', 'Klikový hřídel');
  {
    const geos = [];
    const nMain = segs(C.mainJournalDiameter / 2), nPin = segs(C.pinDiameter / 2);
    for (const mx of C.mainX) geos.push(cylAlongX(mx - C.mainJournalWidth / 2, mx + C.mainJournalWidth / 2, C.mainJournalDiameter / 2, nMain));
    const ra = LOCAL.webArmRadius, h = C.counterweightHalfAngleDeg * Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const a = D.throwPhase[i], cx = cylX[i];
      const pinG = cylAlongX(cx - C.pinWidth / 2, cx + C.pinWidth / 2, C.pinDiameter / 2, nPin);
      pinG.translate(0, r * Math.cos(a), r * Math.sin(a));
      geos.push(pinG);
      // arm = capsule around main-journal centre (0,0) and crankpin centre r*(cos a, sin a)
      const arm = new THREE.Shape();
      const pt = (cy, cz, t) => { const x = cy + ra * Math.cos(t), y = cz + ra * Math.sin(t); return [x, y]; };
      const py = r * Math.cos(a), pz = r * Math.sin(a);
      let first = true;
      const add = ([x, y]) => { if (first) { arm.moveTo(x, y); first = false; } else arm.lineTo(x, y); };
      RING(32, a + Math.PI / 2, a + 3 * Math.PI / 2, t => add(pt(0, 0, t)));
      RING(32, a - Math.PI / 2, a + Math.PI / 2, t => add(pt(py, pz, t)));
      arm.closePath();
      // counterweight: sector of radius counterweightRadius centred opposite the pin
      const cw = new THREE.Shape();
      cw.moveTo(0, 0);
      RING(24, a + Math.PI - h, a + Math.PI + h, t => cw.lineTo(C.counterweightRadius * Math.cos(t), C.counterweightRadius * Math.sin(t)));
      cw.closePath();
      for (const sgn of [-1, 1]) {
        const x0 = sgn < 0 ? cx - C.pinWidth / 2 - C.webThickness : cx + C.pinWidth / 2;
        geos.push(extrudeX(arm, x0, x0 + C.webThickness), extrudeX(cw, x0, x0 + C.webThickness));
      }
    }
    // nose (front)
    geos.push(cylAlongX(C.noseEndX, C.mainX[0] - C.mainJournalWidth / 2 + 1, C.noseDiameter / 2, segs(C.noseDiameter / 2)));
    // rear: seal journal + flange with pilot bore, revolved about X (profile = [radius, axial X])
    const rf = C.flangeDiameter / 2, rp = C.pilotBoreDiameter / 2;
    const profile = [[0, LOCAL.sealJournalStartX], [LOCAL.sealJournalRadius, LOCAL.sealJournalStartX],
      [LOCAL.sealJournalRadius, C.flangeX[0]], [rf, C.flangeX[0]], [rf, C.flangeX[1]], [rp, C.flangeX[1]],
      [rp, C.flangeX[1] - C.pilotBoreDepth], [0, C.flangeX[1] - C.pilotBoreDepth]];
    const rear = lathe(profile, 64);
    rear.rotateZ(-Math.PI / 2);
    geos.push(rear);
    const m = new THREE.Mesh(merge(geos), mat('steel'));
    m.name = 'crankshaft';
    crankGroup.add(m);
  }
  group.add(crankGroup);

  // ───────────────────────────── pistons ─────────────────────────────
  const Ro = R - P.radialClearance;
  const pistonGroups = [];
  const grooves = P.ringGrooves.map(g => ({ top: E.compressionHeight - g.below, bot: E.compressionHeight - g.below - g.height }));
  const buildPiston = () => {
    const nR = segs(R);
    const Ri = Ro - LOCAL.skirtWall, top = E.compressionHeight, under = top - P.crownThickness, bottom = -P.skirtBelowPin;
    const prof = [[0, under], [Ri, under], [Ri, bottom], [Ro, bottom]];
    for (const g of [...grooves].reverse()) prof.push([Ro, g.bot], [Ro - LOCAL.ringGrooveDepth, g.bot], [Ro - LOCAL.ringGrooveDepth, g.top], [Ro, g.top]);
    prof.push([Ro, top], [0, top]);
    const body = lathe(prof, nR);
    // pin bosses: rings about X
    const bosses = [];
    const rb = LOCAL.bossRadius, rpin = P.pinDiameter / 2;
    for (const s of [-1, 1]) {
      const x0 = P.pinBossGap / 2, x1 = LOCAL.bossEndX;
      const g = lathe([[rpin, x0], [rb, x0], [rb, x1], [rpin, x1]], 48);
      g.rotateZ(-Math.PI / 2);                      // axis Y -> X
      if (s < 0) { g.scale(-1, 1, 1); bosses.push(flip(g)); } else bosses.push(g);   // mirror + fix winding
    }
    const pin = cylAlongX(-P.pinLength / 2, P.pinLength / 2, rpin, 48);
    const rings = [];
    for (const g of grooves) {
      const m = LOCAL.ringAxialMargin;
      rings.push(lathe([[Ro - LOCAL.ringGrooveDepth + 0.1, g.bot + m], [R - LOCAL.ringOuterGap, g.bot + m],
        [R - LOCAL.ringOuterGap, g.top - m], [Ro - LOCAL.ringGrooveDepth + 0.1, g.top - m]], nR));
    }
    return { body, bosses: merge(bosses), pin, rings: merge(rings) };
  };
  function flip(g) {   // reverse triangle winding of a non-indexed copy
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    ng.deleteAttribute('normal'); ng.computeVertexNormals();
    return ng;
  }
  const pistonGeo = buildPiston();
  for (let i = 0; i < n; i++) {
    const pg = partGroup(`piston${i + 1}`, `piston${i + 1}`, `Píst ${i + 1}`);
    pg.add(new THREE.Mesh(merge([pistonGeo.body, pistonGeo.bosses]), mat('aluminium')));
    pg.add(new THREE.Mesh(pistonGeo.pin, mat('steel')));
    pg.add(new THREE.Mesh(pistonGeo.rings, mat('steelDark')));
    pg.position.set(cylX[i], pistonPinY(throwAngle(0, i)), 0);
    group.add(pg);
    pistonGroups.push(pg);
  }

  // ───────────────────────────── connecting rods ─────────────────────────────
  const rodGroups = [];
  {
    const rS = Rd.smallEndOD / 2, rB = Rd.bigEndOD / 2;
    const bS = P.pinDiameter / 2 + Rd.bearingClearance, bB = C.pinDiameter / 2 + Rd.bearingClearance;
    const mkRing = (cy, ro, rbore) => {
      const nn = segs(ro), s = new THREE.Shape();
      for (let k = 0; k < nn; k++) {
        const t = 2 * Math.PI * k / nn, x = cy + ro * Math.cos(t), y = ro * Math.sin(t);
        if (k === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
      s.closePath();
      s.holes.push(circlePath(cy, 0, rbore, segs(ro)));
      return s;
    };
    const w = Rd.smallEndWidth, wb = Rd.bigEndWidth;
    const beam = new THREE.Shape();
    const yb = -L + LOCAL.rodBeamBottomOffset;
    beam.moveTo(LOCAL.rodBeamTopY, -LOCAL.rodBeamTopHalf);
    beam.lineTo(yb, -LOCAL.rodBeamBottomHalf);
    beam.lineTo(yb, LOCAL.rodBeamBottomHalf);
    beam.lineTo(LOCAL.rodBeamTopY, LOCAL.rodBeamTopHalf);
    beam.closePath();
    const geo = merge([
      extrudeX(mkRing(0, rS, bS), -w / 2, w / 2),
      extrudeX(mkRing(-L, rB, bB), -wb / 2, wb / 2),
      extrudeX(beam, -Rd.beamThickness / 2, Rd.beamThickness / 2),
    ]);
    for (let i = 0; i < n; i++) {
      const rg = partGroup(`rod${i + 1}`, `rod${i + 1}`, `Ojnice ${i + 1}`);
      rg.add(new THREE.Mesh(geo, mat('steel')));
      group.add(rg);
      rodGroups.push(rg);
    }
  }

  // ───────────────────────────── block (static) ─────────────────────────────
  {
    const geos = [];
    const x0 = E.block.frontX, x1 = E.block.rearX, ly = E.block.linerBottomY;
    const Zi = LOCAL.wallInnerZ, Zo = LOCAL.wallOuterZ, yBot = LOCAL.wallBottomY, yTop = LOCAL.bulkheadTopY;
    // cylinder bank: top-view outline with four bores, extruded along Y
    const bank = new THREE.Shape();
    bank.moveTo(x0, LOCAL.bankHalfZ); bank.lineTo(x0, -LOCAL.bankHalfZ);
    bank.lineTo(x1, -LOCAL.bankHalfZ); bank.lineTo(x1, LOCAL.bankHalfZ); bank.closePath();
    const nR = segs(R);
    for (let i = 0; i < n; i++) {
      const hp = new THREE.Path();
      for (let k = 0; k < nR; k++) {
        const phi = -2 * Math.PI * k / nR;        // clockwise; vertex k sits at (R sin, R cos) like LatheGeometry
        const x = cylX[i] + R * Math.sin(phi), z = R * Math.cos(phi);
        if (k === 0) hp.moveTo(x, -z); else hp.lineTo(x, -z);
      }
      hp.closePath();
      bank.holes.push(hp);
    }
    geos.push(extrudeY(bank, ly, E.deckHeight));
    // crankcase side walls + shelves + pan floor
    for (const s of [-1, 1]) {
      const z0 = Math.min(s * Zi, s * Zo), z1 = Math.max(s * Zi, s * Zo);
      geos.push(boxG(x0, x1, yBot, ly + 1, z0, z1));
      const sz0 = s > 0 ? LOCAL.bankHalfZ - 1 : -Zo, sz1 = s > 0 ? Zo : -(LOCAL.bankHalfZ - 1);
      geos.push(boxG(x0, x1, LOCAL.shelfBottomY, ly + 1, sz0, sz1));
    }
    geos.push(boxG(x0, x1, yBot, LOCAL.panFloorTop, -Zo, Zo));
    // main-bearing bulkheads
    const rbore = C.mainJournalDiameter / 2 + LOCAL.boreClear;
    for (const mx of C.mainX) {
      const thick = new THREE.Shape(); // (Y,Z) outline with the main bore
      thick.moveTo(LOCAL.bulkheadBottomY, -Zo); thick.lineTo(LOCAL.bulkheadThinFromY, -Zo);
      thick.lineTo(LOCAL.bulkheadThinFromY, Zo); thick.lineTo(LOCAL.bulkheadBottomY, Zo); thick.closePath();
      thick.holes.push(circlePath(0, 0, rbore, segs(rbore)));
      const t = C.mainJournalWidth - 2;
      geos.push(extrudeX(thick, mx - t / 2, mx + t / 2));
      const th = LOCAL.bulkheadThinHalf;
      geos.push(boxG(mx - th, mx + th, LOCAL.bulkheadThinFromY - 1, yTop, -Zo, Zo));
    }
    // end walls with bores for the nose and for the rear seal journal
    const front = new THREE.Shape();
    front.moveTo(yBot, -Zo); front.lineTo(yTop, -Zo); front.lineTo(yTop, Zo); front.lineTo(yBot, Zo); front.closePath();
    front.holes.push(circlePath(0, 0, C.noseDiameter / 2 + LOCAL.noseClear, segs(C.noseDiameter / 2)));
    geos.push(extrudeX(front, LOCAL.frontEndWallX, LOCAL.frontEndWallX + LOCAL.endWallThick));
    const rear = new THREE.Shape();
    rear.moveTo(yBot, -Zo); rear.lineTo(yTop, -Zo); rear.lineTo(yTop, Zo); rear.lineTo(yBot, Zo); rear.closePath();
    rear.holes.push(circlePath(0, 0, LOCAL.sealJournalRadius + LOCAL.sealClear, segs(LOCAL.sealJournalRadius)));
    geos.push(extrudeX(rear, C.flangeX[0] - 0.2 - LOCAL.endWallThick, C.flangeX[0] - 0.2));
    const bg = new THREE.Mesh(merge(geos), mat('housing'));
    bg.name = 'block';
    bg.userData.housing = true;
    const blockGroup = partGroup('block', 'block', 'Blok motoru', { static: true });
    blockGroup.add(bg);
    group.add(blockGroup);
  }
  function boxG(x0, x1, y0, y1, z0, z1) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return g;
  }

  // ───────────────────────────── update ─────────────────────────────
  function update(pose) {
    crankGroup.rotation.x = pose.crank;
    for (let i = 0; i < n; i++) {
      const a = throwAngle(pose.crank, i);
      pistonGroups[i].position.y = pistonPinY(a);
      rodGroups[i].position.set(cylX[i], pistonPinY(a), 0);
      rodGroups[i].rotation.x = rodAngle(a);
    }
  }
  update({ crank: 0 });
  return { group, update };
}
