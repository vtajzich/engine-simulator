// Cylinder head geometry for src/model/topEnd.js: CSG deck with chambers, valve pockets, ports, guides, plug wells,
// plus the cam bearing pedestals. All coordinates are world coordinates (the head part sits at the origin).
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { SPEC } from '../spec.js';
import { derive } from '../kin/derive.js';
import { segs } from './parts.js';

const ev = new Evaluator();
ev.useGroups = false;

const brush = g => { const b = new Brush(g); b.updateMatrixWorld(); return b; };
const op = (a, b, o) => ev.evaluate(a, b, o);

/** Cylinder about local Y from y0 to y1. */
function cyl(r, y0, y1, n) {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, n ?? Math.max(48, segs(r)), 1, false);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}
const rotX = a => new THREE.Matrix4().makeRotationX(a);
const trans = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

export const headTopY = (spec = SPEC, L) => spec.engine.deckHeight + L.headTopAbove;

export function buildHeadGeometry(spec, L) {
  const D = derive(spec), E = spec.engine, V = E.valves, VT = E.valvetrain;
  const R = D.R, gamma = D.gamma, apex = D.roofApexY, deck = E.deckHeight;
  const topY = headTopY(spec, L);

  // ---- per-cylinder cutter (cylinder 1 at X = 0), built as a union of small brushes ----
  // combustion chamber = bore cylinder ∩ wedge below the two roof planes
  const wedgeShape = new THREE.Shape();
  const w = R + 2, zlo = deck - 2;
  const pts = [[-w, zlo], [w, zlo], [w, apex - w * Math.tan(gamma)], [0, apex], [-w, apex - w * Math.tan(gamma)]];
  pts.forEach(([u, v], i) => (i ? wedgeShape.lineTo(u, v) : wedgeShape.moveTo(u, v)));
  const wedge = new THREE.ExtrudeGeometry(wedgeShape, { depth: 2 * w, bevelEnabled: false });
  // shape (u, v, depth) -> world (X = -depth, Y = v, Z = u); proper rotation
  wedge.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  wedge.translate(w, 0, 0);
  let cutter = op(brush(cyl(R, deck - 1, apex + 1, segs(R))), brush(wedge), INTERSECTION);

  const add = g => { cutter = op(cutter, brush(g), ADDITION); };

  // plug hole through the roof, widening to the plug well
  add(cyl(E.head.sparkPlug.threadDiameter / 2 + 0.2, apex - 3, apex + L.wellStart + 1, 48));
  add(cyl(L.wellRadius, apex + L.wellStart, topY + 5, 48));

  for (const kind of ['in', 'ex']) {
    const vd = D.valve[kind], side = vd.side, rh = vd.headRadius;
    const rNeck = rh - 3, rGuide = V.stemDiameter / 2 + L.guideClearance;
    for (const which of [0, 1]) {
      const s = vd.seat(0, which);
      const frame = trans(s[0], s[1], s[2]).multiply(rotX(side * gamma));
      const place = (g, extra) => { if (extra) g.applyMatrix4(extra); g.applyMatrix4(frame); return g; };
      // pocket for the valve head (floor at headThickness), neck above it, tilted port, guide hole
      add(place(cyl(rh + L.pocketClearance, -3, V.headThickness, 64)));
      add(place(cyl(rNeck, 1, L.neckTop, 64)));
      add(place(cyl(rNeck - 0.7, 0, 95, 64), trans(0, L.portStart, 0).multiply(rotX(side * L.portTiltDeg * Math.PI / 180))));
      add(place(cyl(rGuide, L.neckTop - 2, 135, 48)));
    }
  }
  const unit = cutter;

  // ---- head body ----
  const x0 = E.block.frontX, x1 = E.block.rearX;
  const box = new THREE.BoxGeometry(x1 - x0, topY - deck, 2 * L.halfZ, 41, 6, 16);   // pre-subdivided: keeps the CSG classification robust
  box.translate((x0 + x1) / 2, (deck + topY) / 2, 0);
  let head = brush(box);
  for (const cx of D.cylX) {
    const c = new Brush(unit.geometry.clone());
    c.position.set(cx, 0, 0);
    c.updateMatrixWorld();
    head = op(head, c, SUBTRACTION);
  }
  const geom = head.geometry;
  geom.deleteAttribute('uv');
  return geom;
}

/** Cam bearing pedestals (5 per camshaft) as one merged geometry. */
export function buildPedestalGeometry(spec, L) {
  const D = derive(spec), VT = spec.engine.valvetrain;
  const topY = headTopY(spec, L);
  const geos = [];
  for (const kind of ['in', 'ex']) {
    const { y: cy, z: cz } = D.valve[kind].camAxis;
    const hz = L.pedHalfZ, y0 = topY - 2;
    const shape = new THREE.Shape();
    shape.moveTo(cz - hz, y0); shape.lineTo(cz + hz, y0); shape.lineTo(cz + hz, cy);
    for (let k = 1; k < 32; k++) { const a = Math.PI * k / 32; shape.lineTo(cz + hz * Math.cos(a), cy + hz * Math.sin(a)); }
    shape.lineTo(cz - hz, cy);
    const hole = new THREE.Path();
    const rb = VT.camShaftDiameter / 2 + L.pedBore, nh = 64;
    hole.setFromPoints(Array.from({ length: nh }, (_, k) => new THREE.Vector2(cz + rb * Math.cos(2 * Math.PI * k / nh), cy + rb * Math.sin(2 * Math.PI * k / nh))));
    shape.holes.push(hole);
    for (const x of spec.engine.crank.mainX) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: 2 * L.pedHalfLen, bevelEnabled: false });
      // shape (u, v, depth) -> world (X = -depth, Y = v, Z = u)
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
      g.translate(x + L.pedHalfLen, 0, 0);
      g.deleteAttribute('uv');
      geos.push(g);
    }
  }
  return geos;
}
